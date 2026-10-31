import "server-only";
import { type BlobStore, createBlobStore } from "@corniversity/db/blob";
import { getEnv } from "@corniversity/db/env";
import { db } from "./db";

let store: BlobStore | undefined;

/** The private store for original files: on disk under the data root locally, bytea rows in production. */
export function blobs(): BlobStore {
  if (!store) {
    const env = getEnv();
    store = createBlobStore(env.BLOB_STORE, db(), env.CORNIVERSITY_DATA_ROOT);
  }
  return store;
}
