import { percentInt } from "../../lib/percentClasses";
import { useTheme } from "../../contexts/ThemeContext";

interface StatBarProps {
    label: string;
    percent: number;
    gradientClass: string;
    sub: string;
    valueTestId?: string;
}

export function StatBar({ label, percent, gradientClass, sub, valueTestId }: StatBarProps) {
    const { isIosTheme } = useTheme();
    const shadowColor = gradientClass.includes("blue") ? "rgba(59,130,246,0.6)" :
        gradientClass.includes("cyan") ? "rgba(34,211,238,0.6)" :
            gradientClass.includes("emerald") ? "rgba(16,185,129,0.6)" :
                "rgba(245,158,11,0.6)";

    return (
        <div className={`space-y-2 group ${isIosTheme ? "ios26-text-secondary" : ""}`}>
            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <span className={`text-[11px] font-black uppercase tracking-widest transition-colors ${isIosTheme ? "text-slate-800" : "text-slate-800 group-hover:text-slate-900"}`}>{label}</span>
                    <span className={`text-[9px] uppercase tracking-widest ${isIosTheme ? "ios26-text-tertiary" : "text-slate-500"}`}>{sub}</span>
                </div>
                <span data-testid={valueTestId} className="text-xs font-mono font-bold" style={{ color: shadowColor, textShadow: `0 0 10px ${shadowColor}` }}>{percent}%</span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full relative ${isIosTheme ? "ios26-kpi" : "border border-slate-300/50 liquid-glass/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]"}`}>
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
