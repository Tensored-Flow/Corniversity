import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOptionalSession, safeNextPath } from "@/lib/session";
import { isBootstrapComplete } from "@corniversity/db/services/bootstrap";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getOptionalSession();
  const { next } = await searchParams;
  const target = safeNextPath(next);
  if (session) redirect(target);
  const bootstrapped = await isBootstrapComplete(db());

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-8">
      <h1 className="text-3xl text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-2">Welcome back. Your studies are where you left them.</p>
      <div className="mt-8">
        <SignInForm next={target} bootstrapped={bootstrapped} />
      </div>
    </div>
  );
}
