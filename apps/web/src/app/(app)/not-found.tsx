import { NotFoundMessage } from "../_not-found/NotFoundMessage";

/**
 * The 404 of a signed-in page that called `notFound()` (another owner's id, a deleted record, an
 * address that names nothing). It renders inside the app layout's `main`, so it adds none.
 */
export default function AppNotFound() {
  return <NotFoundMessage />;
}
