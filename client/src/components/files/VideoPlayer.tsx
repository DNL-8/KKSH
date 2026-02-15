import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../common/Icon";
import { widthPercentClass } from "../../lib/percentClasses";
import type { StoredVideo } from "../../lib/localVideosStore";

interface VideoPlayerProps {
  video: StoredVideo | null;
  videoUrl: string;
  onDurationChange: (duration: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
}

const STORAGE_PREFIX = "cmd8_video_progress_";
const CONTROLS_HIDE_DELAY_MS = 2200;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function chapterLabelFromName(name: string): string {
  const raw = name.replace(/\.[^.]+$/, "").trim();
  if (!raw) return "Parte 1 e 2";
  if (raw.length <= 14) return raw;
  return `${raw.slice(0, 14)}...`;
}

export function VideoPlayer({
  video,
  videoUrl,
  onDurationChange,
  onEnded,
  autoPlay = false,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const progressPercent = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
  const controlsVisible = showControls || !playing || settingsOpen;
  const chapterLabel = useMemo(() => chapterLabelFromName(video?.name ?? ""), [video?.name]);

  const pipSupported = useMemo(() => {
    if (typeof document === "undefined") return false;
    return Boolean(
      document.pictureInPictureEnabled &&
      typeof document.exitPictureInPicture === "function" &&
      typeof HTMLVideoElement !== "undefined" &&
      "requestPictureInPicture" in HTMLVideoElement.prototype,
    );
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    clearHideTimer();
    if (playing) {
      hideTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
        hideTimerRef.current = null;
      }, CONTROLS_HIDE_DELAY_MS);
    }
  }, [clearHideTimer, playing]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  // Restore saved progress and speed.
  useEffect(() => {
    const player = videoRef.current;
    if (!player || !video) return;

    clearHideTimer();
    setShowControls(true);
    setSettingsOpen(false);

    const savedTime = localStorage.getItem(`${STORAGE_PREFIX}${video.id}`);
    if (savedTime) {
      const time = Number.parseFloat(savedTime);
      if (Number.isFinite(time)) {
        player.currentTime = time;
        setCurrentTime(time);
      }
    } else {
      setCurrentTime(0);
    }

    const savedSpeed = localStorage.getItem("cmd8_video_speed");
    if (savedSpeed) {
      const speed = Number.parseFloat(savedSpeed);
      if (Number.isFinite(speed) && speed > 0 && speed <= 16) {
        player.playbackRate = speed;
        setPlaybackRate(speed);
      }
    }
  }, [clearHideTimer, video]);

  useEffect(() => {
    if (autoPlay && videoRef.current && !playing) {
      videoRef.current.play().catch(() => {
        // Browser may block autoplay.
      });
    }
  }, [autoPlay, playing, videoUrl]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const player = videoRef.current;
    if (!player) return;
    if (playing) {
      player.pause();
    } else {
      player.play().catch(() => {
        // Ignore blocked play attempts.
      });
    }
    revealControls();
  }, [playing, revealControls]);

  const toggleMute = useCallback(() => {
    const player = videoRef.current;
    if (!player) return;
    const nextMuted = !muted;
    setMuted(nextMuted);
    player.muted = nextMuted;
    if (nextMuted) {
      setVolume(0);
    } else {
      setVolume(1);
      player.volume = 1;
    }
    revealControls();
  }, [muted, revealControls]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number.parseFloat(event.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setMuted(val === 0);
    revealControls();
  };

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      revealControls();
    } catch {
      // Ignore fullscreen errors.
    }
  }, [revealControls]);

  const togglePictureInPicture = useCallback(async () => {
    const player = videoRef.current as (HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
    }) | null;
    if (!player || !pipSupported) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (typeof player.requestPictureInPicture === "function") {
        await player.requestPictureInPicture();
      }
      revealControls();
    } catch {
      // Ignore PiP API failures.
    }
  }, [pipSupported, revealControls]);

  const seekTo = useCallback((time: number) => {
    if (!videoRef.current) return;
    const safeDuration = Math.max(0, duration);
    const clamped = Math.max(0, Math.min(time, safeDuration));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    revealControls();
  }, [duration, revealControls]);

  const onProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / Math.max(1, rect.width);
    if (!Number.isFinite(pos)) return;
    seekTo(pos * duration);
  }, [duration, seekTo]);

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setPlaybackRate(speed);
    setSettingsOpen(false);
    localStorage.setItem("cmd8_video_speed", speed.toString());
    revealControls();
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "f":
          event.preventDefault();
          void toggleFullscreen();
          break;
        case "m":
          event.preventDefault();
          toggleMute();
          break;
        case "arrowleft":
          event.preventDefault();
          if (videoRef.current) seekTo(videoRef.current.currentTime - 5);
          break;
        case "arrowright":
          event.preventDefault();
          if (videoRef.current) seekTo(videoRef.current.currentTime + 5);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [seekTo, toggleFullscreen, toggleMute, togglePlay]);

  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    const next = videoRef.current.currentTime;
    setCurrentTime(next);
    if (video) {
      localStorage.setItem(`${STORAGE_PREFIX}${video.id}`, next.toString());
    }
  };

  if (!video) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm font-semibold text-slate-500 md:h-[440px]">
        Nenhuma aula selecionada.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`group relative flex w-full items-center justify-center overflow-hidden bg-[#0a0a0b] ${fullscreen ? "h-screen" : "h-[320px] md:h-[440px]"}`}
      onContextMenu={(event) => event.preventDefault()}
      onMouseEnter={revealControls}
      onMouseLeave={() => {
        clearHideTimer();
        if (playing && !settingsOpen) {
          setShowControls(false);
        }
      }}
      onMouseMove={revealControls}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/15 to-black/70" />

      <video
        ref={videoRef}
        autoPlay={autoPlay}
        className="relative z-10 h-full w-full object-contain"
        onClick={togglePlay}
        onDurationChange={(event) => {
          setDuration(event.currentTarget.duration);
          onDurationChange(event.currentTarget.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setShowControls(true);
          onEnded?.();
        }}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          onDurationChange(event.currentTarget.duration);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
        onTimeUpdate={onTimeUpdate}
        playsInline
        src={videoUrl}
      />

      {!playing && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
            <Icon name="play" className="ml-1 text-white text-[32px]" />
          </div>
        </div>
      )}

      <button
        className="absolute right-4 top-4 z-30 rounded-full bg-black/40 p-1.5 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60"
        title="Atalhos: K/espaco, F, M, setas esquerda/direita"
        type="button"
      >
        <Icon name="info" className="text-[18px]" />
      </button>

      <button
        className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-md bg-black/40 p-2 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60"
        onClick={() => void togglePictureInPicture()}
        title="Mini player"
        type="button"
      >
        <Icon name="compress" className="text-[18px]" />
      </button>

      <div
        className={`absolute bottom-0 left-0 right-0 z-30 px-3 pb-3 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div className="group/slider relative mb-2 h-1.5 w-full cursor-pointer rounded-full bg-white/30" onClick={onProgressClick}>
          <div className={`absolute left-0 top-0 h-full rounded-full bg-rose-500 ${widthPercentClass(progressPercent)}`}>
            <div className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.75)]" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-1 backdrop-blur-sm">
              <button
                className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
                onClick={togglePlay}
                type="button"
              >
                {playing ? <Icon name="pause" className="text-[20px]" /> : <Icon name="play" className="ml-0.5 text-[20px]" />}
              </button>
              <button
                className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
                onClick={toggleMute}
                type="button"
              >
                {muted || volume === 0 ? <Icon name="volume-mute" className="text-[19px]" /> : volume < 0.5 ? <Icon name="volume-down" className="text-[19px]" /> : <Icon name="volume" className="text-[19px]" />}
              </button>
              <input
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/35 accent-white transition-all group-hover:w-20"
                max="1"
                min="0"
                step="0.05"
                type="range"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
              />
            </div>

            <div className="rounded-full bg-black/55 px-3 py-2 text-xl font-semibold tracking-tight text-white">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <button
              className="flex items-center gap-1 rounded-full bg-white/35 px-4 py-2 text-xl font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/45"
              type="button"
            >
              {chapterLabel}
              <Icon name="angle-right" className="text-[18px]" />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-1 backdrop-blur-sm">
            <button
              className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
              title="Legenda"
              type="button"
            >
              <Icon name="closed-captioning" className="text-[19px]" />
            </button>

            <div className="relative">
              <button
                className={`rounded-full p-2 text-white transition-colors hover:bg-white/10 ${settingsOpen ? "bg-white/10" : ""}`}
                onClick={() => setSettingsOpen((current) => !current)}
                title="Velocidade e configuracoes"
                type="button"
              >
                <Icon name="settings" className="text-[19px]" />
              </button>
              {settingsOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-32 overflow-hidden rounded-xl border border-white/10 bg-black/85 p-1 text-xs text-white backdrop-blur-md">
                  {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/10 ${playbackRate === speed ? "text-rose-300" : "text-white"}`}
                      onClick={() => handleSpeedChange(speed)}
                      type="button"
                    >
                      <span>{speed}x</span>
                      {playbackRate === speed && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pipSupported && (
              <button
                className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
                onClick={() => void togglePictureInPicture()}
                title="Picture in Picture"
                type="button"
              >
                <Icon name="picture" className="text-[19px]" />
              </button>
            )}

            <button
              className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
              onClick={() => void toggleFullscreen()}
              title="Tela cheia"
              type="button"
            >
              {fullscreen ? <Icon name="compress" className="text-[19px]" /> : <Icon name="expand" className="text-[19px]" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
