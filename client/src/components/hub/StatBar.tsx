import { percentInt } from "../../lib/percentClasses";

interface StatBarProps {
    label: string;
    percent: number;
    gradientClass: string;
    sub: string;
    valueTestId?: string;
}

export function StatBar({ label, percent, gradientClass, sub, valueTestId }: StatBarProps) {
    const shadowColor = gradientClass.includes("blue") ? "rgba(59,130,246,0.6)" :
        gradientClass.includes("cyan") ? "rgba(34,211,238,0.6)" :
            gradientClass.includes("emerald") ? "rgba(16,185,129,0.6)" :
                "rgba(245,158,11,0.6)";

    return (
        <div className="space-y-2 group">
            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white transition-colors">{label}</span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">{sub}</span>
                </div>
                <span data-testid={valueTestId} className="text-xs font-mono font-bold" style={{ color: shadowColor, textShadow: `0 0 10px ${shadowColor}` }}>{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-black/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] relative">
                <div
                    className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-700 ease-out`}
                    style={{
                        width: `${percentInt(percent)}%`,
                        boxShadow: `0 0 12px ${shadowColor}, inset 0 0 4px rgba(255,255,255,0.5)`
                    }}
                />
            </div>
        </div>
    );
}
