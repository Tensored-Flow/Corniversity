"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ next, bootstrapped }: { next: string; bootstrapped: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(
        result.error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : "That email and password did not match.",
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error ? <Notice tone="rust">{error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {!bootstrapped ? (
        <p className="text-sm text-ink-2">
          No account yet?{" "}
          <Link href="/join" className="text-brass underline underline-offset-4">
            Create the owner account
          </Link>
          .
        </p>
      ) : (
        <p className="text-xs text-ink-3">
          Forgotten your password? Run <code className="font-mono">pnpm owner:reset-password</code> on
          the machine that hosts Corniversity. Email delivery is not configured.
        </p>
      )}
    </form>
  );
}
