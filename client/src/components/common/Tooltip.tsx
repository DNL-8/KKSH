import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type Placement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
    /** Content to display inside the tooltip */
    content: ReactNode;
    /** Element that triggers the tooltip (must accept mouse/focus props) */
    children: ReactNode;
    /** Preferred placement – auto-adjusts if clipped */
    placement?: Placement;
    /** Delay before showing (ms) */
    delay?: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function Tooltip({ content, children, placement = "top", delay = 200 }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback(() => {
        timerRef.current = setTimeout(() => setVisible(true), delay);
    }, [delay]);

    const hide = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setVisible(false);
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const positionClasses: Record<Placement, string> = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {children}
            {visible && (
                <div
                    role="tooltip"
                    className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-slate-700 liquid-glass px-3 py-1.5 text-[11px] font-semibold text-slate-200 shadow-xl animate-in fade-in duration-200 ${positionClasses[placement]}`}
                >
                    {content}
                </div>
            )}
        </div>
    );
}
