import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import os from "os";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";
import { getR2Client, r2Enabled, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { needsMp4Conversion, convertMovToMp4 } from "@/lib/transcode";

// Store a file that already exists on local disk (a transcoded temp file) to R2
// when configured, otherwise to the local uploads dir. Returns the public URL.
async function storeLocalFile(
  localPath: string,
  key: string,
  contentType: string
): Promise<string> {
  if (r2Enabled) {
    const upload = new Upload({
      client: getR2Client(),
      params: {
        Bucket: R2_BUCKET,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentType,
      },
    });
    await upload.done();
    return r2PublicUrl(key);
  }
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await pipeline(createReadStream(localPath), createWriteStream(path.join(uploadDir, key)));
  return `/uploads/${key}`;
}

// Videos from phones can be hundreds of MB, and the app container has limited
// RAM — never buffer the whole upload in memory. The raw request body is
// streamed straight to storage. Uploaded files live on Cloudflare R2 when it's
// configured (see src/lib/r2.ts); otherwise they fall back to the local disk.
//
// iPhone videos (HEVC in a .mov container) don't play in Chrome/Android/Windows,
// so those are transcoded to H.264 MP4 first (see src/lib/transcode.ts); only
// the MP4 is kept, so we don't double-store.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  if (!request.body) {
    return Response.json({ error: "No file data received" }, { status: 400 });
  }

  const originalName = decodeURIComponent(request.headers.get("x-filename") ?? "");
  const ext = path.extname(originalName);
  const baseId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const contentType = request.headers.get("content-type") || "application/octet-stream";

  const bodyStream = Readable.fromWeb(request.body as import("stream/web").ReadableStream);

  // --- QuickTime/HEVC videos: transcode to H.264 MP4 before storing. ---
  if (needsMp4Conversion(originalName, contentType)) {
    const tmpIn = path.join(os.tmpdir(), `${baseId}-in${ext || ".mov"}`);
    const tmpOut = path.join(os.tmpdir(), `${baseId}.mp4`);
    try {
      await pipeline(bodyStream, createWriteStream(tmpIn));

      let storePath = tmpOut;
      let key = `${baseId}.mp4`;
      let storeType = "video/mp4";
      try {
        await convertMovToMp4(tmpIn, tmpOut);
      } catch (convErr) {
        // Never lose the upload: if conversion fails, keep the original file.
        console.error("mov→mp4 conversion failed, storing original:", convErr);
        storePath = tmpIn;
        key = `${baseId}${ext || ".mov"}`;
        storeType = contentType === "application/octet-stream" ? "video/quicktime" : contentType;
      }

      const url = await storeLocalFile(storePath, key, storeType);
      return Response.json({ url });
    } catch (err) {
      console.error("Upload failed (video conversion path):", err);
      return Response.json({ error: "Upload failed on the server" }, { status: 500 });
    } finally {
      await unlink(tmpIn).catch(() => {});
      await unlink(tmpOut).catch(() => {});
    }
  }

  // --- Everything else: stream straight through (no buffering). ---
  const filename = `${baseId}${ext}`;

  if (r2Enabled) {
    try {
      const upload = new Upload({
        client: getR2Client(),
        params: {
          Bucket: R2_BUCKET,
          Key: filename,
          Body: bodyStream,
          ContentType: contentType,
        },
      });
      await upload.done();
      return Response.json({ url: r2PublicUrl(filename) });
    } catch (err) {
      console.error("R2 upload failed:", err);
      return Response.json({ error: "Upload failed on the server" }, { status: 500 });
    }
  }

  // Local-disk fallback (development, or when R2 isn't configured).
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const uploadPath = path.join(uploadDir, filename);
  try {
    await mkdir(uploadDir, { recursive: true });
    await pipeline(bodyStream, createWriteStream(uploadPath));
    return Response.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("Upload failed:", err);
    await unlink(uploadPath).catch(() => {});
    return Response.json({ error: "Upload failed on the server" }, { status: 500 });
  }
}
