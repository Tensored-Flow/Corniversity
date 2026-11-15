import Link from "next/link";

/**
 * What every 404 says. It holds no landmark of its own: each not-found file renders it inside exactly
 * one `main` (the root's own for an address no route matches, the group layout's for a page that
 * called `notFound()`), so a 404 never nests a second `main` or repeats `id="main"`.
 */
export function NotFoundMessage({
  title = "There is no room here.",
  body = "The page you asked for does not exist or has moved.",
  links = [{ href: "/campus", label: "Back to Campus" }],
}: {
  title?: string;
  body?: string;
  links?: { href: string; label: string }[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col justify-center py-10">
      <p className="text-sm uppercase tracking-[0.18em] text-brass">Not found</p>
      <h1 className="mt-2 text-3xl text-ink">{title}</h1>
      <p className="mt-3 text-ink-2">{body}</p>
      <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-brass underline underline-offset-4">
            {link.label}
          </Link>
        ))}
      </p>
    </div>
  );
}
