import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { widthPercentClass } from "../../lib/percentClasses";

/**
 * Thin progress bar at the top of the page that animates
 * on every route change (similar to NProgress).
 */
export function RouteProgressBar() {
    const { pathname } = useLocation();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Start
        setVisible(true);
        setProgress(30);

        timerRef.current = setTimeout(() => {
            setProgress(70);
        }, 80);

        const finishTimer = setTimeout(() => {
            setProgress(100);
        }, 200);

        const hideTimer = setTimeout(() => {
            setVisible(false);
            setProgress(0);
        }, 500);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            clearTimeout(finishTimer);
            clearTimeout(hideTimer);
        };
    }, [pathname]);

    if (!visible && progress === 0) return null;

    return (
        <div
            className="fixed left-0 right-0 top-0 z-[999] h-[2px]"
            aria-hidden="true"
        >
            <div
                className={`route-progress-fill h-full rounded-r-full transition-all duration-300 ease-out ${widthPercentClass(progress)} ${visible ? "opacity-100" : "opacity-0"}`}
            />
        </div>
    );
}
