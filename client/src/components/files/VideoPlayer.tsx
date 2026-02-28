import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../common/Icon";
import { usePreferences } from "../../contexts/PreferencesContext";
import { useTheme } from "../../contexts/ThemeContext";
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

function describeMediaError(error: MediaError | null): string {
  if (!error) {
    return "Nao foi possivel reproduzir este arquivo de video.";
  }

  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Reproducao interrompida antes do fim do arquivo.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "Falha de rede ao carregar o video.";
    case MediaError.MEDIA_ERR_DECODE:
      return "Falha ao decodificar o video. Arquivo pode estar corrompido.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "Formato/codec nao suportado neste navegador. Tente MP4 (H264/AAC) ou WebM (VP9/Opus).";
    default:
      return "Nao foi possivel reproduzir este arquivo de video.";
  }
}

export function VideoPlayer({
  video,
  videoUrl,
  onDurationChange,
  onEnded,
  autoPlay = false,
}: VideoPlayerProps) {
  const { preferences } = usePreferences();
  const { isIosTheme } = useTheme();
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
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const hasSource = videoUrl.trim().length > 0;

  const updateDuration = useCallback((value: number) => {
    const safeDuration = Number.isFinite(value) && value > 0 ? value : 0;
    setDuration(safeDuration);
    onDurationChange(safeDuration);
  }, [onDurationChange]);

  const progressPercent = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
  const controlsVisible = showControls || !playing || settingsOpen;
  const chapterLabel = useMemo(() => chapterLabelFromName(video?.name ?? ""), [video?.name]);
  const soundLocked = !preferences.soundEffects;

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

  useEffect(() => {
    if (!showHotkeys) {
      return;
    }
    const timer = window.setTimeout(() => {
      setShowHotkeys(false);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [showHotkeys]);

  useEffect(() => {
    if (!video || hasSource) {
      return;
    }
    setPlaying(false);
    setCurrentTime(0);
    setPlayerError(null);
    updateDuration(0);
  }, [hasSource, updateDuration, video]);

  // Restore saved progress and speed.
  useEffect(() => {
    const player = videoRef.current;
    if (!player || !video) return;

    clearHideTimer();
    setShowControls(true);
    setSettingsOpen(false);
    setShowHotkeys(false);
    setPlayerError(null);

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
    const player = videoRef.current;
    if (!player) {
      return;
    }
    if (soundLocked) {
      player.muted = true;
      setMuted(true);
      setVolume(0);
    }
  }, [soundLocked]);

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
    if (!player || playerError || !hasSource) return;
    if (playing) {
      player.pause();
    } else {
      player.play().catch(() => {
        // Ignore blocked play attempts.
      });
    }
    revealControls();
  }, [hasSource, playerError, playing, revealControls]);

  const toggleMute = useCallback(() => {
    if (soundLocked) {
      return;
    }
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
  }, [muted, revealControls, soundLocked]);

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
    if (!hasSource) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / Math.max(1, rect.width);
    if (!Number.isFinite(pos)) return;
    seekTo(pos * duration);
  }, [duration, hasSource, seekTo]);

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
      <div className={`flex h-[320px] items-center justify-center rounded-[26px] text-sm font-semibold md:h-[440px] ${isIosTheme ? "ios26-section ios26-text-secondary" : "files-panel text-slate-600"}`}>
        Nenhuma aula selecionada.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`group relative flex w-full items-center justify-center overflow-hidden rounded-[26px] ${isIosTheme ? "ios26-section" : "bg-[#03060d]"} ${fullscreen ? "h-screen" : "h-[320px] md:h-[440px]"}`}
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
      <div className={`pointer-events-none absolute inset-0 ${isIosTheme ? "bg-[radial-gradient(circle_at_20%_8%,rgba(255,255,255,0.6),transparent_40%),linear-gradient(to_right,rgba(208,225,248,0.4),rgba(208,225,248,0.05),rgba(208,225,248,0.4))]" : "bg-[radial-gradient(circle_at_30%_15%,rgba(34,211,238,0.16),transparent_40%),linear-gradient(to_right,rgba(2,6,23,0.78),rgba(2,6,23,0.2),rgba(2,6,23,0.78))]"}`} />

      <video
        ref={videoRef}
        autoPlay={autoPlay}
        className="relative z-10 h-full w-full object-contain"
        onClick={togglePlay}
        onCanPlay={() => setPlayerError(null)}
        onDurationChange={(event) => {
          updateDuration(event.currentTarget.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setShowControls(true);
          onEnded?.();
        }}
        onLoadedMetadata={(event) => {
          setPlayerError(null);
          updateDuration(event.currentTarget.duration);
        }}
        onError={(event) => {
          if (!hasSource) {
            return;
          }
          setPlayerError(describeMediaError(event.currentTarget.error));
          setPlaying(false);
          updateDuration(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
        onTimeUpdate={onTimeUpdate}
        playsInline
        src={hasSource ? videoUrl : undefined}
      />

      {!playing && !playerError && hasSource && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/35 liquid-glass/60 backdrop-blur-sm">
            <Icon name="play" className="ml-1 text-slate-900 text-[32px]" />
          </div>
        </div>
      )}

      {!playerError && !hasSource && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-cyan-500/30 bg-[#041022]/80 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-cyan-100 backdrop-blur-md">
            Carregando fonte do video...
          </div>
        </div>
      )}

      {playerError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="max-w-xl rounded-2xl border border-red-500/45 bg-[#2a0d11]/80 p-4 text-center text-sm text-red-100 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-center gap-2 text-red-300">
              <Icon name="exclamation" className="text-[16px]" />
              <span className="font-black uppercase tracking-wider">Erro no player</span>
            </div>
            <p>{playerError}</p>
          </div>
        </div>
      )}

      <button
        className={`absolute right-4 top-4 z-30 rounded-2xl p-2 transition-all ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "border border-slate-300/50 liquid-glass-inner text-slate-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:border-cyan-500/40 hover:liquid-glass/60 hover:text-cyan-300"}`}
        onClick={() => {
          setShowHotkeys((current) => !current);
          revealControls();
        }}
        title={showHotkeys ? "Ocultar atalhos" : "Ver atalhos"}
        type="button"
      >
        <Icon name="info" className="text-[15px]" />
      </button>

      {showHotkeys && (
        <div className={`absolute right-4 top-16 z-30 w-64 rounded-[20px] p-5 text-[11px] font-bold shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${isIosTheme ? "ios26-section-hero text-slate-700" : "border border-cyan-500/30 bg-[#040a17]/80 text-cyan-100 backdrop-blur-2xl"}`}>
          <p className={`mb-4 text-[10px] font-black uppercase tracking-[0.2em] ${isIosTheme ? "ios26-text-secondary" : "text-cyan-400"}`}>Atalhos do Sistema</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center"><span className="text-cyan-600">K / Espaco</span><span>Play/Pause</span></div>
            <div className="flex justify-between items-center"><span className="text-cyan-600">F</span><span>Tela Cheia</span></div>
            <div className="flex justify-between items-center"><span className="text-cyan-600">M</span><span>Mutar/Vol</span></div>
            <div className="flex justify-between items-center"><span className="text-cyan-600">Setas L/R</span><span>-/+ 5 Segs</span></div>
          </div>
        </div>
      )}

      <button
        className={`absolute right-4 top-1/2 z-30 hidden md:block -translate-y-1/2 rounded-2xl p-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-45 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "border border-slate-300/50 liquid-glass-inner text-slate-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:border-cyan-500/40 hover:liquid-glass/60 hover:text-cyan-300"}`}
        disabled={!hasSource}
        onClick={() => void togglePictureInPicture()}
        title="Mini player"
        type="button"
      >
        <Icon name="compress" className="text-[16px]" />
      </button>

      <div
        className={`absolute bottom-0 left-0 right-0 z-30 pt-16 px-4 pb-4 md:px-6 md:pb-6 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isIosTheme ? "bg-gradient-to-t from-white/55 via-white/20 to-transparent" : "bg-gradient-to-t from-[#01030a]/95 via-[#030d1f]/60 to-transparent"} ${controlsVisible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-6"}`}
      >
        <div className={`group/slider relative mb-4 h-1.5 w-full cursor-pointer rounded-full hover:h-2.5 transition-all ${isIosTheme ? "ios26-kpi" : "border border-cyan-500/20 liquid-glass/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"}`} onClick={onProgressClick}>
          <div className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.5)] ${widthPercentClass(progressPercent)}`}>
            <div className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 scale-0 rounded-full bg-cyan-100 shadow-[0_0_12px_rgba(34,211,238,1)] transition-transform group-hover/slider:scale-100" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`flex items-center gap-1 rounded-[16px] px-2 py-1.5 transition-all ${isIosTheme ? "ios26-kpi" : "border border-cyan-500/20 bg-[#040f25]/40 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:bg-[#040f25]/70"}`}>
              <button
                className={`rounded-xl p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "text-cyan-100 hover:bg-cyan-500/20 hover:text-slate-900"}`}
                disabled={!hasSource}
                onClick={togglePlay}
                type="button"
              >
                {playing ? <Icon name="pause" className="text-[16px]" /> : <Icon name="play" className="ml-0.5 text-[16px]" />}
              </button>
              <button
                className={`rounded-xl p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "text-cyan-100 hover:bg-cyan-500/20 hover:text-slate-900"}`}
                onClick={toggleMute}
                disabled={soundLocked || !hasSource}
                title={soundLocked ? "Efeitos sonoros desativados em Configuracoes" : "Som"}
                type="button"
              >
                {muted || volume === 0 ? <Icon name="volume-mute" className="text-[15px]" /> : volume < 0.5 ? <Icon name="volume-down" className="text-[15px]" /> : <Icon name="volume" className="text-[15px]" />}
              </button>
              <input
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-cyan-700/50 accent-cyan-400 transition-all focus:outline-none group-hover:w-20"
                disabled={soundLocked || !hasSource}
                max="1"
                min="0"
                step="0.05"
                type="range"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
              />
            </div>

            <div className={`rounded-[14px] px-4 py-2.5 font-mono text-[11px] font-black tracking-widest hidden sm:block ${isIosTheme ? "ios26-kpi text-slate-700" : "border border-cyan-500/20 bg-[#020b17]/50 text-cyan-50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"}`}>
              <span className="text-cyan-300">{formatTime(currentTime)}</span><span className="mx-2 text-cyan-800">|</span><span className="text-cyan-600">{formatTime(duration)}</span>
            </div>

            <div className={`hidden flex-1 items-center gap-3 rounded-[14px] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest sm:flex ${isIosTheme ? "ios26-kpi text-slate-700" : "border border-cyan-400/10 bg-cyan-950/20 text-cyan-200 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"}`}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="truncate max-w-[200px]">{chapterLabel}</span>
            </div>
          </div>

          <div className={`flex items-center gap-1 rounded-[16px] px-2 py-1.5 transition-all ${isIosTheme ? "ios26-kpi" : "border border-cyan-500/20 bg-[#040f25]/40 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:bg-[#040f25]/70"}`}>
            <button
              className={`rounded-xl p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "text-cyan-100 hover:bg-cyan-500/20 hover:text-slate-900"}`}
              title="Legenda indisponivel para este arquivo"
              disabled
              type="button"
            >
              <Icon name="closed-captioning" className="text-[15px]" />
            </button>

            <div className="relative">
              <button
                className={`rounded-xl p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : `hover:bg-cyan-500/20 hover:text-slate-900 ${settingsOpen ? "bg-cyan-500/30 text-slate-900" : "text-cyan-100"}`}`}
                disabled={!hasSource}
                onClick={() => setSettingsOpen((current) => !current)}
                title="Velocidade e configuracoes"
                type="button"
              >
                <Icon name="settings" className="text-[15px]" />
              </button>
              {settingsOpen && (
                <div className={`absolute bottom-full right-0 mb-3 w-36 overflow-hidden rounded-[16px] p-1.5 text-[11px] font-bold uppercase tracking-wider shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${isIosTheme ? "ios26-section text-slate-700" : "border border-cyan-500/30 bg-[#040a17]/90 text-cyan-100 backdrop-blur-2xl"}`}>
                  {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-cyan-500/20 ${playbackRate === speed ? "bg-cyan-500/10 text-cyan-300" : "text-cyan-100"}`}
                      onClick={() => handleSpeedChange(speed)}
                      type="button"
                    >
                      <span>{speed}x</span>
                      {playbackRate === speed && <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pipSupported && (
              <button
                className={`rounded-xl p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "text-cyan-100 hover:bg-cyan-500/20 hover:text-slate-900"}`}
                disabled={!hasSource}
                onClick={() => void togglePictureInPicture()}
                title="Picture in Picture"
                type="button"
              >
                <Icon name="picture" className="text-[15px]" />
              </button>
            )}

            <button
              className={`rounded-xl p-2.5 transition-colors ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "text-cyan-100 hover:bg-cyan-500/20 hover:text-slate-900"}`}
              onClick={() => void toggleFullscreen()}
              title="Tela cheia"
              type="button"
            >
              {fullscreen ? <Icon name="compress" className="text-[15px]" /> : <Icon name="expand" className="text-[15px]" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
