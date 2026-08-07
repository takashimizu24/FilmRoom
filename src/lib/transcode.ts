import { spawn } from "child_process";
import { stat } from "fs/promises";

/**
 * iPhone videos are HEVC (H.265) in a QuickTime (.mov) container. Safari plays
 * them, but Chrome / Android / Windows cannot — the container isn't supported and
 * HEVC can't be decoded. We normalise these to H.264 MP4 so they play everywhere.
 *
 * Only .mov / .qt (QuickTime) files are treated as conversion targets: the app's
 * other videos are already H.264 MP4 and are left untouched (no re-encode, no
 * quality loss, no wasted CPU).
 */
export function needsMp4Conversion(filename: string, contentType: string): boolean {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  return ext === "mov" || ext === "qt" || contentType === "video/quicktime";
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 16000) err = err.slice(-16000); // keep the tail only
    });
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`));
    });
  });
}

/** The video codec of a file (e.g. "h264", "hevc"), or null if it can't be read. */
export async function probeVideoCodec(input: string): Promise<string | null> {
  try {
    const out = await run(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name",
        "-of", "default=nw=1:nk=1",
        input,
      ],
      30_000
    );
    const name = out.trim().split("\n")[0]?.trim();
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Produce an H.264 MP4 at `output` from a QuickTime/HEVC `input`.
 *
 * - If the source video is already H.264, we only re-wrap it into an MP4
 *   container (`-c copy`): instant, lossless, and no size increase.
 * - Otherwise we re-encode to H.264, capped at 1080p (long side) with CRF 26,
 *   which keeps coaching footage light on storage while playing everywhere.
 */
export async function convertMovToMp4(
  input: string,
  output: string,
  // Transcoding runs in the background (never inside an HTTP request), so this
  // is generous: a long clip from a PC can legitimately take many minutes, and
  // cutting it short would leave an unplayable QuickTime file behind.
  timeoutMs = 45 * 60_000
): Promise<void> {
  const codec = await probeVideoCodec(input);

  if (codec === "h264") {
    // Same bytes, MP4 container. Audio copied too; +faststart for web streaming.
    await run(
      "ffmpeg",
      ["-y", "-i", input, "-c", "copy", "-movflags", "+faststart", output],
      timeoutMs
    );
  } else {
    await run(
      "ffmpeg",
      [
        "-y",
        // Two threads: enough to keep long clips from crawling, but far below
        // the per-thread frame buffers that got 4K HEVC (Dolby Vision) decodes
        // OOM-killed on this container when ffmpeg used every core.
        "-threads", "2",
        "-i", input,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "26",
        // Fit within 1920x1920 (only downscales), keeping aspect and even dimensions.
        "-vf", "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:a", "aac",
        "-b:a", "128k",
        "-threads", "2",
        "-movflags", "+faststart",
        output,
      ],
      timeoutMs
    );
  }

  // Sanity check: a successful exit with an empty/tiny output means the encode
  // effectively failed. Treat it as an error so callers keep the original file.
  const { size } = await stat(output);
  if (size < 1024) {
    throw new Error(`transcode produced a ${size}-byte file`);
  }
}
