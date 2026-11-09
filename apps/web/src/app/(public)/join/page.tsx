import { getEnv } from "@corniversity/db/env";
import { isBootstrapComplete } from "@corniversity/db/services/bootstrap";
import { redirect } from "next/navigation";
import { LinkButton, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { getOptionalSession } from "@/lib/session";
import { createOwnerAccount } from "./actions";
import { JoinForm } from "./JoinForm";

export const metadata = { title: "Create the owner account" };

export default async function JoinPage() {
  const session = await getOptionalSession();
  if (session) redirect("/campus");
  const bootstrapped = await isBootstrapComplete(db());

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-8">
      <h1 className="text-3xl text-ink">Create the owner account</h1>
      {bootstrapped ? (
        <div className="mt-6 flex flex-col gap-4">
          <Notice tone="neutral" title="Sign-up is closed">
            This institution already has its owner account. Corniversity is a single-learner university; there is nothing to join.
          </Notice>
          <LinkButton href="/sign-in" variant="secondary">
            Go to sign in
          </LinkButton>
        </div>
      ) : !getEnv().OWNER_BOOTSTRAP_CODE ? (
        <div className="mt-6">
          <Notice tone="rust" title="Setup is not available">
            The server has no bootstrap code configured, so the owner account cannot be created. Whoever runs the hosting sets
            OWNER_BOOTSTRAP_CODE and restarts the service.
          </Notice>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-2">
            One-time setup. Use the owner email and the one-time bootstrap code set on the server (on Railway, the web service&apos;s
            OWNER_BOOTSTRAP_CODE variable; locally, the .env file). After this, sign-up closes permanently.
          </p>
          <div className="mt-8">
            <JoinForm action={createOwnerAccount} />
          </div>
        </>
      )}
    </div>
  );
}
