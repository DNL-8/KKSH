
import { useMemo } from "react";
import { Icon } from "../common/Icon";
import { widthPercentClass } from "../../lib/percentClasses";

interface SystemCardProps {
    icon: string;
    title: string;
    value: string;
    sub: string;
    tone: "orange" | "blue" | "cyan" | "purple";
    showBar?: boolean;
    progress?: number;
    valueTestId?: string;
    action?: React.ReactNode;
    footer?: React.ReactNode;
}

export function SystemCard({
    icon,
    title,
    value,
    sub,
    tone,
    showBar = false,
    progress = 0,
    valueTestId,
    action,
    footer,
}: SystemCardProps) {
    const toneMap = useMemo(() => ({
        orange: "text-orange-400 border-orange-500/30 bg-orange-500/10",
        blue: "text-blue-400 border-blue-500/30 bg-blue-500/10",
        cyan: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
        purple: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    }), []);

    return (
        <article className="group rounded-3xl border border-white/10 bg-[#0a0b10]/90 p-6 transition-all hover:-translate-y-1">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${toneMap[tone]}`}>
                <Icon name={icon} className="text-xl" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{title}</div>
            <div data-testid={valueTestId} className="mt-1 text-2xl font-black text-white">
                {value}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{sub}</div>
            {showBar && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
                    <div
                        className={`h-full rounded-full bg-blue-500 transition-all ${widthPercentClass(progress)}`}
                    />
                </div>
            )}
            {action}
            {footer}
        </article>
    );
}
