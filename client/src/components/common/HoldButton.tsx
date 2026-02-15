import { useRef, useState } from "react";
import { percentInt, widthPercentClass } from "../../lib/percentClasses";

interface HoldButtonProps {
    label: string;
    onComplete: () => void;
    loading?: boolean;
    className?: string;
    holdDuration?: number; // ms
}

export function HoldButton({
    label,
    onComplete,
    loading = false,
    className = "",
    holdDuration = 1500,
}: HoldButtonProps) {
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);

    const clearTimer = () => {
        if (intervalRef.current) {
            cancelAnimationFrame(intervalRef.current);
            intervalRef.current = null;
        }
        startTimeRef.current = null;
        setProgress(0);
    };

    const handleStart = () => {
        if (loading) return;
        clearTimer();
        startTimeRef.current = Date.now();

        const frame = () => {
            if (!startTimeRef.current) return;
            const elapsed = Date.now() - startTimeRef.current;
            const newProgress = Math.min(100, (elapsed / holdDuration) * 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                onComplete();
                clearTimer();
            } else {
                intervalRef.current = requestAnimationFrame(frame);
            }
        };

        intervalRef.current = requestAnimationFrame(frame);
    };

    const handleEnd = () => {
        if (progress < 100) {
            clearTimer();
        }
    };

    return (
        <button
            className={`relative overflow-hidden ${className}`}
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            type="button"
            disabled={loading}
        >
            <div
                className={`absolute bottom-0 left-0 top-0 bg-white/20 transition-all duration-75 ease-linear ${widthPercentClass(percentInt(progress))}`}
            />
            <span className="relative z-10">{label}</span>
        </button>
    );
}
