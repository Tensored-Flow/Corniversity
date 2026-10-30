import { createDb } from "@corniversity/db/client";
import { getEnv } from "@corniversity/db/env";
import { defaultContentRoot, loadContent } from "./load";
import { seedContent } from "./seed";
import { formatReport, validateContent } from "./validate";

const command = process.argv[2] ?? "validate";
const root = process.argv[3] ?? defaultContentRoot();

async function main() {
  const bundle = loadContent(root);
  const report = validateContent(bundle);
  console.log(formatReport(report));
  const errors = report.issues.filter((i) => i.level === "error").length;
  if (command === "validate") {
    process.exit(errors > 0 ? 1 : 0);
  }
  if (errors > 0) {
    console.error("refusing to seed content with validation errors");
    process.exit(1);
  }
  const env = getEnv();
  const handle = createDb(env.DATABASE_URL, { max: 2 });
  try {
    if (command === "seed") {
      const result = await seedContent(handle.db, bundle);
      console.log(JSON.stringify(result, null, 2));
    } else if (command === "seed-demo") {
      const { seedDemoLearner } = await import("./demo");
      const result = await seedDemoLearner(handle.db);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`unknown command ${command}`);
      process.exit(1);
    }
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
