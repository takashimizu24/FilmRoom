"use client";

import { useEffect, useRef, useState } from "react";

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const u = url.trim();
  // A YouTube video id is 11 chars of [A-Za-z0-9_-]. Cover every share format:
  // watch?v= (v may not be the first param), youtu.be/, embed/, shorts/, v/, and
  // live/ (used by the YouTube app when sharing live streams / premieres).
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = u.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? m.toString().padStart(2, "0") : `${m}`;
  return h > 0
    ? `${h}:${mm}:${s.toString().padStart(2, "0")}`
    : `${mm}:${s.toString().padStart(2, "0")}`;
}

export function YouTubePlayer({
  url,
  startTime = 0,
  endTime = 0,
}: {
  url: string;
  startTime?: number;
  endTime?: number;
}) {
  const videoId = extractYoutubeId(url);
  if (!videoId) return <p className="text-red-400 text-sm">Invalid YouTube URL</p>;

  let embedUrl = `https://www.youtube.com/embed/${videoId}?`;
  const params: string[] = [];
  if (startTime > 0) params.push(`start=${startTime}`);
  if (endTime > 0) params.push(`end=${endTime}`);
  embedUrl += params.join("&");

  const timeLabel =
    startTime > 0 || endTime > 0
      ? `${formatTime(startTime)} – ${endTime > 0 ? formatTime(endTime) : "end"}`
      : null;

  return (
    <div>
      {timeLabel && (
        <div className="text-xs text-neutral-500 mb-1">Clip: {timeLabel}</div>
      )}
      {/* Browser view: iframe */}
      <div className="relative w-full pt-[56.25%] bg-black rounded-xl overflow-hidden print:hidden">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {/* PDF view: thumbnail */}
      <div className="hidden print:block rounded-xl overflow-hidden border border-gray-200">
        <img
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
          alt="YouTube thumbnail"
          className="w-full"
        />
        <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600">
          YouTube: {url}
          {timeLabel && ` (${timeLabel})`}
        </div>
      </div>
    </div>
  );
}

/* ---------- Icons (inherit currentColor) ---------- */
const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PlayIcon = () => (
  <svg {...iconProps} fill="currentColor" stroke="none"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = () => (
  <svg {...iconProps} fill="currentColor" stroke="none"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
);
const VolumeIcon = () => (
  <svg {...iconProps}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18 6a9 9 0 0 1 0 12" /></svg>
);
const MutedIcon = () => (
  <svg {...iconProps}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></svg>
);
const GearIcon = () => (
  <svg {...iconProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
);
const SpeedIcon = () => (
  <svg {...iconProps}><path d="M12 20a8 8 0 1 0-8-8" /><path d="M4 12H2" /><path d="m12 12 4-2" /></svg>
);
const PipIcon = () => (
  <svg {...iconProps}><rect x="3" y="4" width="18" height="14" rx="2" /><rect x="12" y="10" width="7" height="6" rx="1" fill="currentColor" stroke="none" /></svg>
);
const DownloadIcon = () => (
  <svg {...iconProps}><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></svg>
);
const FullscreenIcon = () => (
  <svg {...iconProps}><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
);
const CheckIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
);
const ChevronLeftIcon = () => (
  <svg {...iconProps}><path d="m15 18-6-6 6-6" /></svg>
);

const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

export function UploadedVideo({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [holdPaused, setHoldPaused] = useState(false);
  // A file that has gone missing from storage otherwise plays as a silent black
  // box, which reads as "the app is broken" rather than "this clip is gone".
  const [loadFailed, setLoadFailed] = useState(false);

  // Gesture bookkeeping for tap-to-toggle-controls and press-and-hold-to-pause.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = useRef(false);
  const movedRef = useRef(false);
  const activeRef = useRef(false);
  const downPos = useRef({ x: 0, y: 0 });
  const keepVisible = useRef(false); // settings menu open => never auto-hide

  useEffect(() => {
    keepVisible.current = menuOpen || speedOpen;
  }, [menuOpen, speedOpen]);

  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" &&
        "pictureInPictureEnabled" in document &&
        document.pictureInPictureEnabled
    );
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  // Close the settings menu when clicking outside the player.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSpeedOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !keepVisible.current) setControlsVisible(false);
    }, 1600);
  }

  // Reveal the controls; while playing, arm the auto-hide so they fade again.
  function bumpControls() {
    setControlsVisible(true);
    if (videoRef.current && !videoRef.current.paused) scheduleHide();
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  // ----- pointer gestures on the video surface (SNS short-video feel) -----
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    activeRef.current = true;
    movedRef.current = false;
    holdingRef.current = false;
    downPos.current = { x: e.clientX, y: e.clientY };
    // Press-and-hold pauses (touch only, and only while actually playing).
    if (e.pointerType !== "mouse" && videoRef.current && !videoRef.current.paused) {
      holdTimer.current = setTimeout(() => {
        const v = videoRef.current;
        if (v && !v.paused) {
          v.pause();
          holdingRef.current = true;
          setHoldPaused(true);
        }
      }, 220);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (
      Math.abs(e.clientX - downPos.current.x) > 12 ||
      Math.abs(e.clientY - downPos.current.y) > 12
    ) {
      movedRef.current = true;
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
    }
  }

  function onPointerEnd() {
    if (!activeRef.current) return; // guard against pointerup + pointerleave both firing
    activeRef.current = false;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdingRef.current) {
      // Was a press-and-hold: resume playback on release.
      holdingRef.current = false;
      setHoldPaused(false);
      videoRef.current?.play();
      return;
    }
    if (movedRef.current) return; // a scroll/drag, not a tap
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); // tapping a paused video starts it
    else if (controlsVisible) setControlsVisible(false); // tap hides shown controls
    else bumpControls(); // tap reveals controls (they auto-hide again)
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (v) v.currentTime = Number(e.target.value);
    bumpControls();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function applySpeed(rate: number) {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    setSpeed(rate);
    setSpeedOpen(false);
    setMenuOpen(false);
  }

  async function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* ignore */
    }
    setMenuOpen(false);
  }

  function toggleFullscreen() {
    const c = containerRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (c?.requestFullscreen) {
      c.requestFullscreen();
    } else if (v?.webkitEnterFullscreen) {
      // iOS Safari fallback
      v.webkitEnterFullscreen();
    }
  }

  const rowClass =
    "flex items-center gap-3 w-full px-3 py-2.5 text-left text-neutral-200 hover:bg-neutral-800 transition";
  const ctrlBtn =
    "inline-flex items-center justify-center h-8 w-8 rounded text-neutral-200 hover:text-white hover:bg-white/10 transition shrink-0";

  return (
    <div>
      {/* Browser view: custom controls */}
      <div
        ref={containerRef}
        className="relative w-full bg-black rounded-xl overflow-hidden print:hidden select-none [-webkit-touch-callout:none]"
      >
        <video
          ref={videoRef}
          src={url}
          playsInline
          onPlay={() => {
            setPlaying(true);
            scheduleHide();
          }}
          onPause={() => {
            setPlaying(false);
            setControlsVisible(true);
            if (hideTimer.current) clearTimeout(hideTimer.current);
          }}
          onEnded={() => setControlsVisible(true)}
          onTimeUpdate={() => setCurrent(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => {
            setDuration(videoRef.current?.duration ?? 0);
            setLoadFailed(false);
          }}
          onError={() => setLoadFailed(true)}
          onVolumeChange={() => setMuted(videoRef.current?.muted ?? false)}
          className="w-full max-h-[500px] block"
        />

        {/* The file couldn't be loaded at all — say so instead of showing a
            black rectangle with dead controls. */}
        {loadFailed && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1 bg-black/80 px-6 text-center">
            <p className="text-sm text-neutral-200">この動画を読み込めませんでした</p>
            <p className="text-xs text-neutral-500">
              ファイルが見つかりません。もう一度アップロードしてください。
            </p>
          </div>
        )}

        {/* Gesture surface: tap toggles controls, press-and-hold pauses. */}
        <div
          className="absolute inset-0 z-10"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Centre play control when paused. It's a real button (not just an
            indicator) so tapping the big circle always starts playback, rather
            than relying on the gesture layer underneath. While held-paused it
            stays a passive indicator — releasing the press resumes. */}
        {!playing && (
          <div className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none">
            {holdPaused ? (
              <div className="h-16 w-16 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white [&_svg]:h-8 [&_svg]:w-8">
                <PauseIcon />
              </div>
            ) : (
              <button
                type="button"
                aria-label="Play"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  videoRef.current?.play();
                }}
                className="pointer-events-auto h-16 w-16 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition [&_svg]:h-8 [&_svg]:w-8"
              >
                <PlayIcon />
              </button>
            )}
          </div>
        )}

        {/* Control bar */}
        <div
          onPointerDown={() => bumpControls()}
          className={`absolute inset-x-0 bottom-0 z-20 px-3 pt-10 pb-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={current}
            onChange={onSeek}
            aria-label="Seek"
            className="w-full h-1 mb-2 cursor-pointer accent-white"
          />
          <div className="flex items-center gap-1 text-neutral-100 [&_svg]:block">
            <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className={ctrlBtn}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <span className="text-xs tabular-nums leading-none text-neutral-200 select-none px-1.5 shrink-0">
              {formatTime(current)} / {formatTime(duration)}
            </span>
            <div className="flex-1" />
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className={ctrlBtn}>
              {muted ? <MutedIcon /> : <VolumeIcon />}
            </button>

            {/* Settings menu */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setSpeedOpen(false);
                }}
                aria-label="Settings"
                className={ctrlBtn}
              >
                <GearIcon />
              </button>

              {menuOpen && (
                <div className="absolute bottom-9 right-0 z-10 w-56 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden text-sm">
                  {!speedOpen ? (
                    <>
                      <button type="button" onClick={() => setSpeedOpen(true)} className={rowClass}>
                        <SpeedIcon />
                        <span className="flex-1">Playback speed</span>
                        <span className="text-xs text-neutral-400">{speed === 1 ? "Normal" : `${speed}x`}</span>
                      </button>
                      {pipSupported && (
                        <button type="button" onClick={togglePip} className={rowClass}>
                          <PipIcon />
                          <span className="flex-1">Picture in picture</span>
                        </button>
                      )}
                      <a
                        href={url}
                        download
                        onClick={() => setMenuOpen(false)}
                        className={rowClass}
                      >
                        <DownloadIcon />
                        <span className="flex-1">Download</span>
                      </a>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSpeedOpen(false)}
                        className={`${rowClass} text-neutral-400 border-b border-neutral-800`}
                      >
                        <ChevronLeftIcon />
                        <span className="flex-1">Playback speed</span>
                      </button>
                      {SPEEDS.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => applySpeed(rate)}
                          className={rowClass}
                        >
                          <span className="w-4 flex justify-center text-neutral-100">
                            {rate === speed ? <CheckIcon /> : null}
                          </span>
                          <span className="flex-1">{rate === 1 ? "Normal" : `${rate}x`}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <button type="button" onClick={toggleFullscreen} aria-label="Fullscreen" className={ctrlBtn}>
              <FullscreenIcon />
            </button>
          </div>
        </div>
      </div>

      {/* PDF view */}
      <div className="hidden print:block rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-sm text-gray-600">[Video file] {url}</div>
      </div>
    </div>
  );
}
