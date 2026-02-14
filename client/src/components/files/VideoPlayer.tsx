import { useEffect, useRef } from "react";
import { StoredVideo } from "../../lib/localVideosStore";

interface VideoPlayerProps {
    video: StoredVideo | null;
    videoUrl: string;
    onDurationChange: (duration: number) => void;
    onEnded?: () => void;
    autoPlay?: boolean;
}

const STORAGE_PREFIX = "cmd8_video_progress_";

export function VideoPlayer({
    video,
    videoUrl,
    onDurationChange,
    onEnded,
    autoPlay = false,
}: VideoPlayerProps) {
    const playerRef = useRef<HTMLVideoElement | null>(null);

    // Load saved progress when video changes
    useEffect(() => {
        const player = playerRef.current;
        if (!player || !video) return;

        const savedTime = localStorage.getItem(`${STORAGE_PREFIX}${video.id}`);
        if (savedTime) {
            const time = parseFloat(savedTime);
            if (Number.isFinite(time)) {
                player.currentTime = time;
            }
        }
    }, [video]);

    // Save progress on time update
    const handleTimeUpdate = () => {
        const player = playerRef.current;
        if (!player || !video) return;

        // Save every 5 seconds or so to avoid thrashing? 
        // LocalStorage is sync, so maybe throttle or just save on pause/cleanup?
        // Use a simple approach first: save on every update (it fires every 250ms usually)
        // Check performance impact. For now, let's throttle slightly or just save.
        // Actually, let's just save.
        localStorage.setItem(`${STORAGE_PREFIX}${video.id}`, player.currentTime.toString());
    };

    const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        const duration = event.currentTarget.duration;
        if (Number.isFinite(duration) && duration > 0) {
            onDurationChange(duration);
        }
    };

    const handleDurationChange = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        const duration = event.currentTarget.duration;
        if (Number.isFinite(duration) && duration > 0) {
            onDurationChange(duration);
        }
    };

    // Load saved speed
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        const savedSpeed = localStorage.getItem("cmd8_video_speed");
        if (savedSpeed) {
            const speed = parseFloat(savedSpeed);
            if (Number.isFinite(speed) && speed > 0 && speed <= 16) {
                player.playbackRate = speed;
            }
        }
    }, [video]); // Re-apply on video change? Or just mount? Usually persistent across app session. Re-apply on video change is safer if browser resets it.

    // Save speed on change
    const handleRateChange = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        const speed = event.currentTarget.playbackRate;
        localStorage.setItem("cmd8_video_speed", speed.toString());
    };

    if (!video) {
        return (
            <div className="flex h-[320px] items-center justify-center text-sm font-semibold text-slate-500 md:h-[440px]">
                Nenhuma aula selecionada.
            </div>
        );
    }

    return (
        <video
            key={video.id}
            ref={playerRef}
            className="h-[320px] w-full bg-black object-contain md:h-[440px]"
            controls
            autoPlay={autoPlay}
            onDurationChange={handleDurationChange}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onRateChange={handleRateChange}
            onEnded={onEnded}
            playsInline
            preload="metadata"
            src={videoUrl}
        />
    );
}
