import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import path from "path";

// Videos from phones can be hundreds of MB, and this container only has ~512MB
// of RAM — buffering the whole upload in memory (e.g. via request.formData())
// can OOM-crash the server. Stream the raw request body straight to disk instead.
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
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const uploadPath = path.join(uploadDir, filename);

  try {
    await mkdir(uploadDir, { recursive: true });
    await pipeline(Readable.fromWeb(request.body as import("stream/web").ReadableStream), createWriteStream(uploadPath));
    return Response.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("Upload failed:", err);
    await unlink(uploadPath).catch(() => {});
    return Response.json({ error: "Upload failed on the server" }, { status: 500 });
  }
}
