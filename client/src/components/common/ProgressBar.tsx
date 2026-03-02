import { percentInt, widthPercentClass } from "../../lib/percentClasses";
import { useTheme } from "../../contexts/ThemeContext";

interface ProgressBarProps {
  label: string;
  value: number;
  color: string;
  glow?: string;
  showValue?: boolean;
  subLabel?: string;
}

export function ProgressBar({
  label,
  value,
  color,
  glow = "",
  showValue = true,
  subLabel = "",
}: ProgressBarProps) {
  const { isIosTheme } = useTheme();

  return (
    <div className="group w-full space-y-1.5">
      <div className="flex items-end justify-between text-[10px] font-black uppercase tracking-widest">
        <span className={`flex items-center gap-1.5 transition-colors ${isIosTheme ? "text-slate-500 group-hover:text-slate-800" : "text-slate-400 group-hover:text-slate-200"}`}>
          <span className={`h-3 w-1.5 rounded-full ${color}`} />
          {label}
        </span>
        <div className="text-right">
          {showValue && <span className={`block font-mono leading-none ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>{value}%</span>}
          {subLabel && <span className={`text-[8px] leading-none ${isIosTheme ? "text-slate-600" : "text-slate-400"}`}>{subLabel}</span>}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-slate-800/50 liquid-glass p-0.5 shadow-inner">
        <div
          className={`relative h-full rounded-full transition-all duration-700 ease-out ${color} ${glow} ${widthPercentClass(percentInt(value))}`}
        >
          <div className="absolute inset-0 animate-pulse bg-white/20" />
        </div>
      </div>
    </div>
  );
}

