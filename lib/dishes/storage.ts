import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import type { Dish } from "./types";
import seed from "@/data/dishes.json";

/**
 * Where the dish list lives.
 *
 *  - Cloudflare R2 (production): one JSON object, written through R2's
 *    S3-compatible API. Used whenever the R2_* credentials are set. Serverless
 *    hosts like Vercel have a read-only, per-instance file system, so writing
 *    data/dishes.json there fails (EROFS) and nothing would persist.
 *  - Local file (development): data/dishes.json, as before.
 *
 * The first read from an empty bucket seeds it from data/dishes.json (bundled
 * at build time). Writes are conditional on the ETag that was read, so two
 * admins saving at once can't silently overwrite each other (see store.ts).
 */

export type Snapshot = { dishes: Dish[]; version: string | null };

export interface DishStorage {
  readonly kind: "r2" | "file";
  read(): Promise<Snapshot>;
  /** Throws ConflictError if the data changed since `version` was read. */
  write(dishes: Dish[], version: string | null): Promise<void>;
}

export class ConflictError extends Error {
  constructor() {
    super("conflict");
  }
}

/** Saving isn't possible on this host (read-only file system, no R2 configured). */
export class ReadOnlyStorageError extends Error {
  constructor() {
    super("storage_readonly");
  }
}

const json = (dishes: Dish[]) => JSON.stringify(dishes, null, 2) + "\n";

// --- Cloudflare R2 ------------------------------------------------------------
function r2Storage(): DishStorage | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  // A common slip: pasting the S3 endpoint URL instead of the bucket's name.
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error(
      `R2_BUCKET must be the bucket's name (e.g. "my-bucket"), not a URL — got "${bucket.slice(0, 60)}".`,
    );
  }

  const endpoint = (process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const key = (process.env.R2_DISHES_KEY || "data/dishes.json").replace(/^\/+/, "");
  const url = `${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

  return {
    kind: "r2",
    async read() {
      // Uncompressed on purpose: R2 gzips JSON for clients that accept it and
      // then returns a weak ETag (W/"…"), which never matches the If-Match on
      // the next write — every save after the first would look like a conflict.
      const res = await client.fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: { "accept-encoding": "identity" },
      });
      if (res.status === 404) return { dishes: structuredClone(seed) as Dish[], version: null }; // not seeded yet
      if (!res.ok) throw new Error(`R2 read failed: ${res.status} ${await res.text().catch(() => "")}`);
      const etag = res.headers.get("etag")?.replace(/^W\//, "") ?? null; // belt and braces
      return { dishes: (await res.json()) as Dish[], version: etag };
    },
    async write(dishes, version) {
      const put = (conditional: boolean) =>
        client.fetch(url, {
          method: "PUT",
          body: json(dishes),
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            // Optimistic concurrency: only replace what we read (or create if absent).
            ...(conditional ? (version ? { "if-match": version } : { "if-none-match": "*" }) : {}),
          },
        });
      let res = await put(true);
      // An endpoint without conditional-write support: fall back to a plain PUT.
      if (res.status === 501) res = await put(false);
      if (res.status === 412) throw new ConflictError();
      if (!res.ok) throw new Error(`R2 write failed: ${res.status} ${await res.text().catch(() => "")}`);
    },
  };
}

// --- Local JSON file ------------------------------------------------------------
function fileStorage(): DishStorage {
  const file = path.join(process.cwd(), "data", "dishes.json");
  return {
    kind: "file",
    async read() {
      try {
        return { dishes: JSON.parse(await fs.readFile(file, "utf8")) as Dish[], version: null };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return { dishes: structuredClone(seed) as Dish[], version: null };
        throw err;
      }
    },
    async write(dishes) {
      const tmp = `${file}.${process.pid}.tmp`;
      try {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(tmp, json(dishes), "utf8");
        await fs.rename(tmp, file);
      } catch (err) {
        await fs.unlink(tmp).catch(() => undefined); // don't leave a half-written temp file
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EROFS" || code === "EACCES" || code === "EPERM") throw new ReadOnlyStorageError();
        throw err;
      }
    },
  };
}

let storage: DishStorage | undefined;

export function getStorage(): DishStorage {
  if (!storage) {
    storage = r2Storage() ?? fileStorage();
    if (storage.kind === "file" && process.env.VERCEL) {
      console.warn(
        "[dishes] R2_* env vars are not set: on Vercel the dish list is read-only (changes can't be saved).",
      );
    }
  }
  return storage;
}
