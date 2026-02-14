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
  return (
    <div className="group w-full space-y-1.5">
      <div className="flex items-end justify-between text-[10px] font-black uppercase tracking-widest">
        <span className="flex items-center gap-1.5 text-slate-500 transition-colors group-hover:text-slate-300">
          <span className={`h-3 w-1.5 rounded-full ${color}`} />
          {label}
        </span>
        <div className="text-right">
          {showValue && <span className="block font-mono leading-none text-white">{value}%</span>}
          {subLabel && <span className="text-[8px] leading-none text-slate-600">{subLabel}</span>}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-slate-800/50 bg-slate-900/50 p-0.5 shadow-inner">
        <div
          className={`relative h-full rounded-full transition-all duration-700 ease-out ${color} ${glow}`}
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        >
          <div className="absolute inset-0 animate-pulse bg-white/20" />
        </div>
      </div>
    </div>
  );
}