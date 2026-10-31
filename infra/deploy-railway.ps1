<#
.SYNOPSIS
  Deploys Corniversity to a dedicated Railway project: PostgreSQL, a web service and a worker.

.DESCRIPTION
  Prerequisites: `railway login` has been run on this machine (the script refuses otherwise).
  Nothing here purchases a domain or upgrades a plan; a Railway Hobby plan with one Postgres,
  one web and one worker service is the expected cost basis (see docs/QA_REPORT.md).

  What it does, in order, printing each command before running it:
    1. Creates (or links) the project named by -Project.
    2. Adds a PostgreSQL database service.
    3. Creates the `web` and `worker` services and points each at its Dockerfile.
    4. Generates BETTER_AUTH_SECRET and OWNER_BOOTSTRAP_CODE locally and sets every variable;
       the owner email is taken from the local .env (OWNER_EMAIL) or -OwnerEmail.
    5. Deploys both services (`railway up`), requests a Railway-provided domain for the web
       service, sets BETTER_AUTH_URL to that https URL and redeploys the web service.
    6. Prints the URL, the bootstrap code (shown once) and the post-deploy health command.

  Use -DryRun to print the plan without changing anything.

.EXAMPLE
  pwsh -File infra/deploy-railway.ps1 -DryRun
  pwsh -File infra/deploy-railway.ps1 -Project corniversity
#>
param(
  [string]$Project = "corniversity",
  [string]$OwnerEmail = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Invoke-Step([string]$Description, [scriptblock]$Action) {
  Write-Host ""
  Write-Host "== $Description" -ForegroundColor Cyan
  if ($DryRun) { Write-Host "   (dry run: skipped)"; return }
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "Step failed: $Description" }
}

function New-Secret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  throw "The Railway CLI is not installed. Install it (https://docs.railway.com/guides/cli) and run 'railway login' first."
}
$who = railway whoami 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Not logged in to Railway. Run 'railway login' in this terminal, then run this script again."
}
Write-Host "Railway account: $who"

if (-not $OwnerEmail) {
  if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match "^OWNER_EMAIL=" } | Select-Object -First 1
    if ($line) { $OwnerEmail = $line.Substring("OWNER_EMAIL=".Length).Trim() }
  }
}
if (-not $OwnerEmail) { throw "Pass -OwnerEmail you@example.com (the only account that will be able to sign up)." }

$authSecret = New-Secret 48
$bootstrapCode = New-Secret 18
Write-Host "Project: $Project"
Write-Host "Owner email: $OwnerEmail"
Write-Host "Secrets: generated locally; the bootstrap code is printed once at the end."

Invoke-Step "Create or link the project" {
  railway init --name $Project 2>$null
  if ($LASTEXITCODE -ne 0) { railway link --project $Project }
}

Invoke-Step "Add PostgreSQL" {
  railway add --database postgres
}

Invoke-Step "Create the web and worker services" {
  railway add --service web
  railway add --service worker
}

Invoke-Step "Configure the web service" {
  railway variables --service web --set "RAILWAY_DOCKERFILE_PATH=Dockerfile.web" `
    --set "RAILWAY_CONFIG_FILE=infra/railway.web.json" `
    --set "DEPLOYMENT_MODE=production" `
    --set "INSTITUTION_NAME=Corniversity" `
    --set "DEFAULT_TIMEZONE=Europe/London" `
    --set "DATABASE_URL=`${{Postgres.DATABASE_URL}}" `
    --set "BETTER_AUTH_SECRET=$authSecret" `
    --set "BETTER_AUTH_URL=https://placeholder.invalid" `
    --set "OWNER_EMAIL=$OwnerEmail" `
    --set "OWNER_BOOTSTRAP_CODE=$bootstrapCode" `
    --set "CORNIVERSITY_DATA_ROOT=/data" `
    --set "BLOB_STORE=pg" `
    --set "AI_PROVIDER=fixture" `
    --set "MAX_UPLOAD_MB=200" `
    --set "PORT=3000"
}

Invoke-Step "Configure the worker service" {
  railway variables --service worker --set "RAILWAY_DOCKERFILE_PATH=Dockerfile.worker" `
    --set "RAILWAY_CONFIG_FILE=infra/railway.worker.json" `
    --set "DEPLOYMENT_MODE=production" `
    --set "INSTITUTION_NAME=Corniversity" `
    --set "DEFAULT_TIMEZONE=Europe/London" `
    --set "DATABASE_URL=`${{Postgres.DATABASE_URL}}" `
    --set "BETTER_AUTH_SECRET=$authSecret" `
    --set "BETTER_AUTH_URL=https://placeholder.invalid" `
    --set "OWNER_EMAIL=$OwnerEmail" `
    --set "OWNER_BOOTSTRAP_CODE=$bootstrapCode" `
    --set "CORNIVERSITY_DATA_ROOT=/data" `
    --set "BLOB_STORE=pg" `
    --set "AI_PROVIDER=fixture" `
    --set "WORKER_HEALTH_PORT=3100" `
    --set "WORKER_CONCURRENCY=2"
}

Invoke-Step "Deploy the worker (it applies the database migrations on start)" {
  railway up --service worker --detach
}

Invoke-Step "Deploy the web service" {
  railway up --service web --detach
}

$domain = ""
Invoke-Step "Request a Railway domain for the web service" {
  $output = railway domain --service web 2>&1 | Out-String
  Write-Host $output
  if ($output -match "https?://([a-zA-Z0-9.-]+\.up\.railway\.app)") { $script:domain = $Matches[1] }
}

if ($domain) {
  Invoke-Step "Set BETTER_AUTH_URL to https://$domain and redeploy the web service" {
    railway variables --service web --set "BETTER_AUTH_URL=https://$domain"
    railway variables --service worker --set "BETTER_AUTH_URL=https://$domain"
    railway up --service web --detach
  }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
if ($DryRun) {
  Write-Host "Dry run: no project, service or variable was created."
} else {
  if ($domain) { Write-Host "Private site: https://$domain" } else { Write-Host "Domain not detected; run 'railway domain --service web' and set BETTER_AUTH_URL on both services." }
  Write-Host "Owner email: $OwnerEmail"
  Write-Host "One-time bootstrap code (shown once; create the owner account at /join): $bootstrapCode"
  Write-Host "Check health: pnpm health --web https://$domain   (the worker is internal; its health shows in Railway logs)"
  Write-Host "Then run the deployed journeys: E2E_BASE_URL=https://$domain E2E_BOOTSTRAP_CODE=<code> pnpm exec playwright test tests/e2e/01-arrival-and-onboarding.spec.ts"
}
