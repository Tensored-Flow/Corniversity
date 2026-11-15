import { NotFoundMessage } from "../_not-found/NotFoundMessage";

/**
 * The reader's 404: the address names no Document of the owner's (it was deleted, it is someone
 * else's, or the address is wrong). It renders inside the reader layout's `main`, so it adds none,
 * and scrolls inside that full-height frame.
 */
export default function ReaderNotFound() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <NotFoundMessage
        title="No document here."
        body="This address names no file or paper in your library: it was deleted, or the address is wrong."
        links={[
          { href: "/library", label: "Library" },
          { href: "/notebook?library=1", label: "Library notes" },
        ]}
      />
    </div>
  );
}
