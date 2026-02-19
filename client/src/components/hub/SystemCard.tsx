import { useMemo } from "react";
import { Icon } from "../common/Icon";

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
        orange: {
            text: "text-orange-400",
            border: "border-orange-500/30",
            bg: "bg-orange-500/10",
            glow: "group-hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]",
            iconGlow: "drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]",
            barGradient: "from-orange-600 to-orange-400"
        },
        blue: {
            text: "text-blue-400",
            border: "border-blue-500/30",
            bg: "bg-blue-500/10",
            glow: "group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
            iconGlow: "drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]",
            barGradient: "from-blue-600 to-blue-400"
        },
        cyan: {
            text: "text-cyan-400",
            border: "border-cyan-500/30",
            bg: "bg-cyan-500/10",
            glow: "group-hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]",
            iconGlow: "drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]",
            barGradient: "from-cyan-600 to-cyan-400"
        },
        purple: {
            text: "text-purple-400",
            border: "border-purple-500/30",
            bg: "bg-purple-500/10",
            glow: "group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
            iconGlow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]",
            barGradient: "from-purple-600 to-purple-400"
        },
    }), []);

    const style = toneMap[tone];

    return (
        <article className={`group relative overflow-hidden rounded-[30px] border border-white/5 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/95 backdrop-blur-xl p-6 transition-all duration-500 hover:-translate-y-2 hover:border-white/10 ${style.glow}`}>
            <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl transition-opacity duration-500 opacity-0 group-hover:opacity-100 ${style.bg}`} />

            <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${style.border} ${style.bg} relative z-10 transition-transform duration-500 group-hover:scale-110`}>
                <Icon name={icon} className={`text-2xl ${style.text} ${style.iconGlow}`} />
            </div>

            <div className="relative z-10">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors group-hover:text-slate-400">{title}</div>
                <div data-testid={valueTestId} className="mt-2 text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 drop-shadow-sm">
                    {value}
                </div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500/80">{sub}</div>

                {showBar && (
                    <div className="mt-5 h-2 overflow-hidden rounded-full border border-white/5 bg-black/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] relative">
                        <div
                            className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${style.barGradient} transition-all duration-1000 ease-out`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {action && <div className="mt-4">{action}</div>}

                {footer && (
                    <div className="mt-4 border-t border-white/5 pt-4">
                        {footer}
                    </div>
                )}
            </div>
        </article>
    );
}
