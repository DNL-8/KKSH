import { useCallback, useEffect, useRef, useState } from "react";
import { percentInt, widthPercentClass } from "../../lib/percentClasses";

interface HoldButtonProps {
    label: string;
    onComplete: () => void;
    loading?: boolean;
    className?: string;
    holdDuration?: number; // ms
    progressLabel?: string;
}

export function HoldButton({
    label,
    onComplete,
    loading = false,
    className = "",
    holdDuration = 1500,
    progressLabel = "MANTENHA",
}: HoldButtonProps) {
    const [progress, setProgress] = useState(0);
    const rafRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const holdingRef = useRef(false);
    const completedRef = useRef(false);

    const stopHold = useCallback((resetProgress = true) => {
        holdingRef.current = false;
        startTimeRef.current = null;
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (resetProgress) {
            setProgress(0);
        }
    }, []);

    const tick = useCallback(() => {
        if (!holdingRef.current || startTimeRef.current === null) {
            return;
        }

        const elapsed = performance.now() - startTimeRef.current;
        const nextProgress = Math.min(100, (elapsed / holdDuration) * 100);
        setProgress(nextProgress);

        if (nextProgress >= 100) {
            completedRef.current = true;
            stopHold(false);
            onComplete();
            return;
        }

        rafRef.current = requestAnimationFrame(tick);
    }, [holdDuration, onComplete, stopHold]);

    const startHold = useCallback(() => {
        if (loading || holdingRef.current) {
            return;
        }
        completedRef.current = false;
        setProgress(0);
        holdingRef.current = true;
        startTimeRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
    }, [loading, tick]);

    const endHold = useCallback(() => {
        if (!holdingRef.current) {
            return;
        }
        const completed = completedRef.current;
        stopHold(!completed);
        if (completed) {
            setProgress(0);
        }
    }, [stopHold]);

    useEffect(() => () => stopHold(), [stopHold]);

    return (
        <button
            className={`relative cursor-pointer select-none touch-none overflow-hidden ${className}`}
            onPointerDown={(event) => {
                if (event.pointerType === "mouse" && event.button !== 0) {
                    return;
                }
                try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                    // Ignore capture failures and continue with hold.
                }
                startHold();
            }}
            onPointerUp={(event) => {
                try {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                } catch {
                    // Ignore capture release failures.
                }
                endHold();
            }}
            onPointerCancel={(event) => {
                try {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                } catch {
                    // Ignore capture release failures.
                }
                endHold();
            }}
            onLostPointerCapture={endHold}
            onBlur={endHold}
            onKeyDown={(event) => {
                if (event.repeat) {
                    return;
                }
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    startHold();
                }
            }}
            onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    endHold();
                }
            }}
            type="button"
            disabled={loading}
        >
            <div
                className={`absolute bottom-0 left-0 top-0 bg-white/30 transition-all duration-75 ease-linear ${widthPercentClass(percentInt(progress))}`}
            />
            <span className="relative z-10">
                {progress > 0 && progress < 100 ? `${progressLabel} ${percentInt(progress)}%` : label}
            </span>
        </button>
    );
}
