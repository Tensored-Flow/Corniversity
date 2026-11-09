<#
.SYNOPSIS
  Deploys Corniversity to a dedicated Railway project: PostgreSQL, a web service and a worker.

.DESCRIPTION
  Runs under Windows PowerShell 5.1 and PowerShell 7. Prerequisites for a real run: the Railway
  CLI is installed and `railway login` has been run on this machine (the script refuses
  otherwise). Nothing here purchases a domain or upgrades a plan; a Railway Hobby plan with one
  Postgres, one web and one worker service is the expected cost basis (see docs/HANDOFF.md).

  What it does, in order, printing each step's commands before running them:
    1. Creates (or links) the project named by -Project, in -Workspace when one is given.
    2. Adds a PostgreSQL database service.
    3. Creates the `web` and `worker` services and points each at its Dockerfile.
    4. Generates BETTER_AUTH_SECRET and OWNER_BOOTSTRAP_CODE locally and sets every variable
       without deploying; the owner email is taken from the local .env (OWNER_EMAIL) or -OwnerEmail.
    5. Builds and starts the worker first: on start it applies the database migrations and seeds
       the institution's content (SEED_CONTENT_ON_START=1). Then builds and starts the web service.
    6. Requests a Railway-provided domain for the web service, sets BETTER_AUTH_URL to that https
       URL and redeploys the web service with it.
    7. Prints the URL and where to find the one-time bootstrap code (the web service's
       OWNER_BOOTSTRAP_CODE variable in the Railway dashboard); no secret is printed.

  It is for a first deployment only: it refuses to run in a folder already linked to a Railway
  project, because running it again would create a second project with new secrets. Later
  changes ship with `railway up --service worker --ci` and `railway up --service web --ci`.

  Use -DryRun to print the plan without changing anything; it needs neither the CLI nor a login.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File infra/deploy-railway.ps1 -DryRun
  powershell -NoProfile -ExecutionPolicy Bypass -File infra/deploy-railway.ps1 -Project corniversity
#>
param(
  [string]$Project = "corniversity",
  [string]$Workspace = "",
  [string]$OwnerEmail = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

# Runs a native command and returns its combined output as text. Windows PowerShell 5.1 turns
# anything a native command writes to stderr into an error record, which the Stop preference
# above would promote to a crash, so the preference is relaxed for the duration of the call and
# the caller judges success by $LASTEXITCODE instead.
function Invoke-Native([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $Command 2>&1 | ForEach-Object { if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { $_ } }
    return ($output | Out-String).Trim()
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Invoke-Step([string]$Description, [scriptblock]$Action) {
  Write-Host ""
  Write-Host "== $Description" -ForegroundColor Cyan
  foreach ($line in ($Action.ToString() -split "`r?`n")) {
    if ($line.Trim()) { Write-Host ("   " + $line.Trim()) -ForegroundColor DarkGray }
  }
  if ($DryRun) { Write-Host "   (dry run: skipped)"; return }
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "Step failed: $Description" }
}

function New-Secret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

if ($DryRun) {
  Write-Host "Dry run: printing the plan. Nothing is created, deployed or changed." -ForegroundColor Yellow
} else {
  if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    throw "The Railway CLI is not installed. Install it (https://docs.railway.com/guides/cli) and run 'railway login' first."
  }
  $who = Invoke-Native { railway whoami }
  if ($LASTEXITCODE -ne 0) {
    throw "Not logged in to Railway. Run 'railway login' in this terminal, then run this script again."
  }
  Write-Host "Railway account: $who"
  $linked = Invoke-Native { railway status }
  if ($LASTEXITCODE -eq 0 -and $linked -match "Project:\s*(\S+)") {
    throw "This folder is already linked to the Railway project '$($Matches[1])'. This script is for a first deployment only; running it again would create a second project with new secrets. Ship changes with 'railway up --service worker --ci' and 'railway up --service web --ci'."
  }
}

if (-not $OwnerEmail) {
  if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match "^OWNER_EMAIL=" } | Select-Object -First 1
    if ($line) { $OwnerEmail = $line.Substring("OWNER_EMAIL=".Length).Trim() }
  }
}
if (-not $OwnerEmail) {
  if ($DryRun) { $OwnerEmail = "<OWNER_EMAIL from .env or -OwnerEmail>" }
  else { throw "Pass -OwnerEmail you@example.com (the only account that will be able to sign up)." }
}

$authSecret = New-Secret 48
$bootstrapCode = New-Secret 18
Write-Host "Project: $Project"
Write-Host "Owner email: $OwnerEmail"
Write-Host "Secrets: generated locally and stored only as Railway variables; none is printed."

Invoke-Step "Create or link the project" {
  if ($Workspace) { $created = Invoke-Native { railway init --name $Project --workspace $Workspace } }
  else { $created = Invoke-Native { railway init --name $Project } }
  Write-Host $created
  if ($LASTEXITCODE -ne 0) { railway link --project $Project }
}

Invoke-Step "Add PostgreSQL" {
  railway add --database postgres
}

Invoke-Step "Create the web and worker services" {
  railway add --service web
  railway add --service worker
}

Invoke-Step "Configure the web service (no deploy yet)" {
  railway variables --service web --skip-deploys --set "RAILWAY_DOCKERFILE_PATH=Dockerfile.web" `
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

Invoke-Step "Configure the worker service (no deploy yet)" {
  railway variables --service worker --skip-deploys --set "RAILWAY_DOCKERFILE_PATH=Dockerfile.worker" `
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
    --set "SEED_CONTENT_ON_START=1" `
    --set "WORKER_HEALTH_PORT=3100" `
    --set "PORT=3100"
}

Invoke-Step "Build and start the worker (it applies the migrations and seeds the content on start)" {
  railway up --service worker --ci
}

Invoke-Step "Build and start the web service" {
  railway up --service web --ci
}

$domain = ""
Invoke-Step "Request a Railway domain for the web service" {
  $output = Invoke-Native { railway domain --service web --port 3000 --json }
  Write-Host $output
  if ($output -match "([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.up\.railway\.app)") { $script:domain = $Matches[1] }
}

if ($domain) {
  Invoke-Step "Set BETTER_AUTH_URL to https://$domain and redeploy the web service" {
    railway variables --service worker --skip-deploys --set "BETTER_AUTH_URL=https://$domain"
    railway variables --service web --skip-deploys --set "BETTER_AUTH_URL=https://$domain"
    railway redeploy --service web --yes
  }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
if ($DryRun) {
  Write-Host "Dry run: no project, service or variable was created."
} else {
  if ($domain) { Write-Host "Private site: https://$domain" } else { Write-Host "Domain not detected; run 'railway domain --service web' and set BETTER_AUTH_URL on both services." }
  Write-Host "Owner email: $OwnerEmail"
  Write-Host "One-time bootstrap code: the OWNER_BOOTSTRAP_CODE variable of the web service (Railway dashboard, project $Project, service web, Variables). It is not printed here."
  Write-Host "After the owner account exists, delete OWNER_BOOTSTRAP_CODE from both services; it is no longer needed."
  Write-Host "Check health: pnpm health --web https://$domain   (the worker is internal; its health shows in Railway logs)"
  Write-Host "Then open https://$domain/join in a browser and create the owner account with the code above. Do not run the test journeys against the live site: they would create the owner with the test password."
}
