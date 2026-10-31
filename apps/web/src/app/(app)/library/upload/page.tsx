import { getEnv } from "@corniversity/db/env";
import { companionState, listPairings } from "@corniversity/db/services/library";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { LibraryHeader } from "../shared";
import { UploadForm } from "./UploadForm";

export const metadata = { title: "Upload" };

export default async function UploadPage() {
  const session = await requireSession("/library/upload");
  const pairings = await listPairings(db(), session.user.id);
  const env = getEnv();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <LibraryHeader
        title="Upload a file"
        lede="For files that are not on a paired desktop. The file is validated and held in quarantine; you then confirm what it is and decide, permission by permission, what may happen to it."
        active="/library/upload"
        sync={companionState(pairings)}
      />
      <Card>
        <UploadForm maxMb={env.MAX_UPLOAD_MB} />
      </Card>
      <Card className="mt-4" as="aside">
        <h2 className="text-lg text-ink">What happens next</h2>
        <ol className="mt-2 list-decimal pl-5 text-sm text-ink-2">
          <li>
            The file's signature, type and size are checked. Scripts, notebooks and executables are refused. Identical content already in
            your library is reported as a duplicate, not stored twice.
          </li>
          <li>You confirm the title, authors and edition (pre-filled from the PDF where possible) and attach the item to courses.</li>
          <li>
            You grant permissions separately: reading, extraction and indexing, tutor access, embeddings, sharing. Nothing is extracted or
            sent anywhere until you do.
          </li>
        </ol>
        <p className="mt-3 text-xs text-ink-3">
          Uploading a copy you own does not by itself settle what processing its licence permits; the permission step records the basis of
          each decision.
        </p>
      </Card>
    </div>
  );
}
