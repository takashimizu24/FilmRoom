import { S3Client, DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-compatible. These come from Railway service variables.
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "";
// Public base URL used to serve uploaded media (no trailing slash).
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

// True only when every required R2 setting is present. When false, the app
// falls back to writing uploads to the local disk/volume (legacy behaviour).
export const r2Enabled = Boolean(
  accountId && accessKeyId && secretAccessKey && R2_BUCKET && R2_PUBLIC_URL
);

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

// Public URL for an object key stored in the bucket.
export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

// The object key for a URL that points at our R2 bucket, or null for URLs that
// live elsewhere (local /uploads, YouTube, etc.) and must not be deleted.
export function r2KeyFromUrl(url: string): string | null {
  if (!R2_PUBLIC_URL) return null;
  const prefix = `${R2_PUBLIC_URL}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/**
 * The object's user metadata, or null if it can't be read (missing, or R2 is
 * unreachable). Used to tell a file we've already transcoded from one we
 * haven't, without keeping that state in the database.
 */
export async function r2ObjectMetadata(key: string): Promise<Record<string, string> | null> {
  if (!r2Enabled) return null;
  try {
    const head = await getR2Client().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return head.Metadata ?? {};
  } catch {
    return null;
  }
}

// Best-effort delete of objects from the bucket. Never throws — a failed
// cleanup should not break the user action that triggered it.
export async function deleteR2Objects(keys: string[]): Promise<void> {
  if (!r2Enabled || keys.length === 0) return;
  try {
    await getR2Client().send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      })
    );
  } catch (err) {
    console.error("R2 delete failed:", err);
  }
}
