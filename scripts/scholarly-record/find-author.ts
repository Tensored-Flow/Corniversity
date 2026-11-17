// Recording group "find-author" (`pnpm library:live-check --record-group find-author`): Find papers'
// Author filter (OpenAlex `raw_author_name.search`) for the research-library journey
// (tests/e2e/17-research-library.spec.ts) and the OpenAlex contract tests. Two OpenAlex requests in
// the shape `searchPapers` sends (packages/db/src/services/paper-lists.ts, pages of FIND_PAGE_SIZE
// 25): an author with no words, and words with an author and years. No Crossref or arXiv request.
import type { RecordGroup } from "./types";

const FIND_PAGE_SIZE = 25;

const findAuthor: RecordGroup = async (client, { check }) => {
  await check(
    "OpenAlex author only (Claude Shannon)",
    () => client.openalexSearch({ filters: { author: "Claude Shannon" }, page: 1, perPage: FIND_PAGE_SIZE }),
    (l) => `${l.items.length} of ${l.count ?? "?"}`,
  );
  await check(
    "OpenAlex words with author and years (direct preference optimization, Rafailov, 2023 to 2024)",
    () =>
      client.openalexSearch({
        search: "direct preference optimization",
        filters: { publicationYear: { from: 2023, to: 2024 }, author: "Rafailov" },
        page: 1,
        perPage: FIND_PAGE_SIZE,
      }),
    (l) => `${l.items.length} of ${l.count ?? "?"}`,
  );
};

export default findAuthor;
