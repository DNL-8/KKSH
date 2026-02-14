import {
    Maximize,
    Minimize,
    Pause,
    Play,
    Settings,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { StoredVideo } from "../../lib/localVideosStore";

interface VideoPlayerProps {
    video: StoredVideo | null;
    videoUrl: string;
    onDurationChange: (duration: number) => void;
    onEnded?: () => void;
    autoPlay?: boolean;
}

const STORAGE_PREFIX = "cmd8_video_progress_";

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

export function VideoPlayer({
    video,
    videoUrl,
    onDurationChange,
    onEnded,
    autoPlay = false,
}: VideoPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Restore saved progress & speed
    useEffect(() => {
        const player = videoRef.current;
        if (!player || !video) return;

        const savedTime = localStorage.getItem(`${STORAGE_PREFIX}${video.id}`);
        if (savedTime) {
            const time = parseFloat(savedTime);
            if (Number.isFinite(time)) {
                player.currentTime = time;
                setCurrentTime(time);
            }
        }

        const savedSpeed = localStorage.getItem("cmd8_video_speed");
        if (savedSpeed) {
            const speed = parseFloat(savedSpeed);
            if (Number.isFinite(speed) && speed > 0 && speed <= 16) {
                player.playbackRate = speed;
                setPlaybackRate(speed);
            }
        }
    }, [video]);

    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (playing) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(() => { });
        }
    }, [playing]);

    const toggleFullscreen = useCallback(async () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            await containerRef.current.requestFullscreen();
            setFullscreen(true);
        } else {
            await document.exitFullscreen();
            setFullscreen(false);
        }
    }, []);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
        }
        setMuted(val === 0);
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        const newMuted = !muted;
        setMuted(newMuted);
        videoRef.current.muted = newMuted;
        if (newMuted) {
            setVolume(0);
        } else {
            setVolume(1);
            videoRef.current.volume = 1;
        }
    };



    const handleSpeedChange = (speed: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
        setPlaybackRate(speed);
        setSettingsOpen(false);
        localStorage.setItem("cmd8_video_speed", speed.toString());
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case " ":
                case "k":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "f":
                    e.preventDefault();
                    void toggleFullscreen();
                    break;
                case "m":
                    e.preventDefault();
                    toggleMute();
                    break;
                case "arrowleft":
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.currentTime -= 5;
                    break;
                case "arrowright":
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.currentTime += 5;
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [togglePlay, toggleFullscreen, toggleMute]);

    // Video Events
    const onTimeUpdate = () => {
        if (videoRef.current) {
            const t = videoRef.current.currentTime;
            setCurrentTime(t);
            if (video) {
                localStorage.setItem(`${STORAGE_PREFIX}${video.id}`, t.toString());
            }
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
            className={`group relative flex w-full items-center justify-center bg-black overflow-hidden ${fullscreen ? "h-screen" : "h-[320px] md:h-[440px]"}`}
            onContextMenu={(e) => e.preventDefault()}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            <video
                ref={videoRef}
                autoPlay={autoPlay}
                className="h-full w-full object-contain"
                onClick={togglePlay}
                onDurationChange={(e) => {
                    setDuration(e.currentTarget.duration);
                    onDurationChange(e.currentTarget.duration);
                }}
                onEnded={() => {
                    setPlaying(false);
                    onEnded?.();
                }}
                onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration);
                    onDurationChange(e.currentTarget.duration);
                }}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                onRateChange={(e) => {
                    // Sync state if changed externally
                    setPlaybackRate(e.currentTarget.playbackRate);
                }}
                onTimeUpdate={onTimeUpdate}
                playsInline
                src={videoUrl}
            />

            {/* Center Play Button Overlay (when paused or buffering) */}
            {!playing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in">
                        <Play className="ml-1 text-white" size={32} fill="white" />
                    </div>
                </div>
            )}

            {/* Bottom Controls Overlay */}
            <div
                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0"
                    }`}
            >
                {/* Progress Bar */}
                <div className="group/slider relative mb-4 h-1 w-full cursor-pointer bg-white/20 transition-all hover:h-1.5" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    if (Number.isFinite(pos) && videoRef.current) {
                        videoRef.current.currentTime = pos * duration;
                    }
                }}>
                    <div
                        className="absolute h-full bg-[hsl(var(--accent))] transition-all"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    >
                        <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 scale-0 rounded-full bg-[hsl(var(--accent))] transition-transform group-hover/slider:scale-100" />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="text-white hover:text-[hsl(var(--accent))]" onClick={togglePlay}>
                            {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                        </button>

                        <div className="group/vol flex items-center gap-2">
                            <button className="text-white hover:text-[hsl(var(--accent))]" onClick={toggleMute}>
                                {muted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
                            </button>
                            <input
                                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 accent-white transition-all group-hover/vol:w-20"
                                max="1"
                                min="0"
                                step="0.1"
                                type="range"
                                value={muted ? 0 : volume}
                                onChange={handleVolumeChange}
                            />
                        </div>

                        <span className="text-xs font-medium text-white">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Speed Settings */}
                        <div className="relative">
                            <button
                                className={`text-white transition-transform ${settingsOpen ? "rotate-90" : ""}`}
                                onClick={() => setSettingsOpen(!settingsOpen)}
                            >
                                <Settings size={20} />
                            </button>
                            {settingsOpen && (
                                <div className="absolute bottom-full right-0 mb-3 w-32 overflow-hidden rounded-xl bg-black/90 p-1 text-xs text-white backdrop-blur-md">
                                    {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                                        <button
                                            key={s}
                                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-white/10 ${playbackRate === s ? "text-[hsl(var(--accent))]" : ""}`}
                                            onClick={() => handleSpeedChange(s)}
                                        >
                                            <span>{s}x</span>
                                            {playbackRate === s && <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="text-white hover:text-[hsl(var(--accent))]" onClick={() => void toggleFullscreen()}>
                            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
