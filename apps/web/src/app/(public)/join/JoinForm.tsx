"use client";
import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { JoinState } from "./actions";

export function JoinForm({
  action,
}: {
  action: (prev: JoinState, formData: FormData) => Promise<JoinState>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as JoinState);
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label="Your name" htmlFor="name" error={state.fieldErrors?.name} hint="How faculty will address you.">
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Owner email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint="At least 12 characters. There is no email reset, so keep it somewhere safe."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <Field
        label="Bootstrap code"
        htmlFor="code"
        error={state.fieldErrors?.code}
        hint="OWNER_BOOTSTRAP_CODE in the environment file on the hosting machine."
      >
        <Input id="code" name="code" autoComplete="off" required />
      </Field>
      {state.error ? <Notice tone="rust">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create account and begin"}
      </Button>
    </form>
  );
}
