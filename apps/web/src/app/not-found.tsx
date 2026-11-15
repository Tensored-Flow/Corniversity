import { NotFoundMessage } from "./_not-found/NotFoundMessage";

/**
 * The 404 for an address no route matches, rendered in the root layout alone, which has no `main`:
 * this one is the page's only main. Pages under (app) and (reader) have their own not-found files,
 * rendered inside their layout's main.
 */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col justify-center px-4 py-16">
      <NotFoundMessage />
    </main>
  );
}
