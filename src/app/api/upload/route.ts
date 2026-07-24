import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";
import { getR2Client, r2Enabled, R2_BUCKET, r2PublicUrl } from "@/lib/r2";

// Videos from phones can be hundreds of MB, and the app container has limited
// RAM — never buffer the whole upload in memory. The raw request body is
// streamed straight to storage. Uploaded files live on Cloudflare R2 when it's
// configured (see src/lib/r2.ts); otherwise they fall back to the local disk.
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
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const contentType = request.headers.get("content-type") || "application/octet-stream";

  const bodyStream = Readable.fromWeb(request.body as import("stream/web").ReadableStream);

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
