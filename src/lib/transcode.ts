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
  return (await probeVideo(input))?.codec ?? null;
}

export type VideoInfo = { codec: string; width: number; height: number; bitrate: number };

/** Codec, frame size and overall bitrate, or null if the file can't be read. */
export async function probeVideo(input: string): Promise<VideoInfo | null> {
  try {
    const out = await run(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height:format=bit_rate",
        "-of", "default=nw=1",
        input,
      ],
      30_000
    );
    const get = (k: string) => out.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
    const codec = get("codec_name");
    if (!codec) return null;
    return {
      codec,
      width: Number(get("width")) || 0,
      height: Number(get("height")) || 0,
      bitrate: Number(get("bit_rate")) || 0,
    };
  } catch {
    return null;
  }
}

// Above 1080p, or above this bitrate, a clip is re-encoded rather than just
// re-wrapped: a 4K phone/camera file is tens of Mbps, which stalls constantly on
// a phone over mobile data even though the browser can decode it.
const MAX_LONG_SIDE = 1920;
const MAX_BITRATE = 12_000_000;

/**
 * What has to happen to a stored video before it plays well everywhere:
 *   "encode"  — wrong codec, too big, or too heavy to stream
 *   "remux"   — fine as it is, but needs the MP4 container and its index moved
 *               to the front (`+faststart`) so playback can start before the
 *               whole file has downloaded
 *   "none"    — unreadable; leave it alone rather than risk breaking it
 */
export function plannedFix(info: VideoInfo | null): "encode" | "remux" | "none" {
  if (!info) return "none";
  if (info.codec !== "h264") return "encode";
  if (Math.max(info.width, info.height) > MAX_LONG_SIDE) return "encode";
  if (info.bitrate > MAX_BITRATE) return "encode";
  return "remux";
}

/**
 * Grab a single frame as a JPEG, for use as a video's poster.
 *
 * `-ss` before `-i` seeks by keyframe without decoding what comes before, which
 * keeps this quick even when reading the file over the network. A clip shorter
 * than the requested point yields nothing, so the caller retries at 0.
 */
export async function extractPoster(
  input: string,
  output: string,
  atSeconds: number,
  timeoutMs = 2 * 60_000
): Promise<void> {
  await run(
    "ffmpeg",
    [
      "-y",
      "-ss", String(atSeconds),
      "-i", input,
      "-frames:v", "1",
      // Wide enough to stay sharp on a phone, small enough to be nearly free.
      "-vf", "scale='min(960,iw)':-2",
      "-q:v", "4",
      output,
    ],
    timeoutMs
  );
  const { size } = await stat(output);
  if (size < 256) throw new Error(`poster came out ${size} bytes`);
}

/**
 * Produce a web-ready H.264 MP4 at `output`.
 *
 * - `remux`: keep the video stream untouched and only rebuild the container
 *   with `+faststart`. Instant, lossless, no size change — but it moves the
 *   index to the start of the file, without which a browser can't begin playing
 *   until it has fetched the end of the file.
 * - `encode`: re-encode to H.264, capped at 1080p with CRF 26, which keeps
 *   coaching footage light enough to stream on mobile data.
 */
export async function convertMovToMp4(
  input: string,
  output: string,
  plan: "encode" | "remux" | null = null,
  // Transcoding runs in the background (never inside an HTTP request), so this
  // is generous: a long clip from a PC can legitimately take many minutes, and
  // cutting it short would leave an unplayable QuickTime file behind.
  timeoutMs = 45 * 60_000
): Promise<void> {
  const action = plan ?? plannedFix(await probeVideo(input));

  if (action === "remux") {
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
        // Four threads. The 1-thread limit existed because 4K HEVC (Dolby
        // Vision) decodes were OOM-killed on the old 1GB container; the plan now
        // allows 8GB/8vCPU, so this is safe and converts long clips much faster.
        "-threads", "4",
        "-i", input,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "26",
        // Fit within 1920x1920 (only downscales), keeping aspect and even dimensions.
        "-vf", "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:a", "aac",
        "-b:a", "128k",
        "-threads", "4",
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
