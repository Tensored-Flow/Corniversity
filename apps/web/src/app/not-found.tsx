import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Not found</p>
      <h1 className="mt-2 text-3xl text-ink">There is no room here.</h1>
      <p className="mt-3 text-ink-2">The page you asked for does not exist or has moved.</p>
      <Link href="/campus" className="mt-6 text-brass underline underline-offset-4">
        Back to Campus
      </Link>
    </main>
  );
}
