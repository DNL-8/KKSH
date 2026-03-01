import { widthPercentClass } from "../../lib/percentClasses";

export type HudTone = "red" | "blue" | "yellow" | "green" | "purple";

export interface HudProgressBarProps {
  value: number;
  max: number;
  tone: HudTone;
  label: string;
  textValue: string;
  detail?: string;
}

const HUD_BAR_TONE_CLASS: Record<HudTone, string> = {
  red: "bg-gradient-to-r from-red-500 to-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.45)]",
  blue: "bg-gradient-to-r from-cyan-500 to-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.45)]",
  yellow: "bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_10px_rgba(245,158,11,0.45)]",
  green: "bg-gradient-to-r from-emerald-500 to-lime-300 shadow-[0_0_10px_rgba(16,185,129,0.45)]",
  purple: "bg-gradient-to-r from-violet-500 to-fuchsia-300 shadow-[0_0_10px_rgba(168,85,247,0.45)]",
};

const HUD_TEXT_TONE_CLASS: Record<HudTone, string> = {
  red: "text-red-300",
  blue: "text-cyan-200",
  yellow: "text-amber-200",
  green: "text-emerald-200",
  purple: "text-violet-200",
};

export function HudProgressBar({ value, max, tone, label, textValue, detail }: HudProgressBarProps) {
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const tooltip = detail && detail.trim().length > 0 ? detail.trim() : `${label}: ${textValue}`;

  return (
    <div className="group relative min-w-[126px]" title={tooltip}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="files-display text-[9px] uppercase tracking-widest text-slate-600">{label}</span>
        <span className={`text-[10px] font-black uppercase ${HUD_TEXT_TONE_CLASS[tone]}`}>{textValue}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-cyan-950/80 bg-[#071323]">
        <div className={`h-full rounded-full transition-all duration-700 ${HUD_BAR_TONE_CLASS[tone]} ${widthPercentClass(percentage)}`} />
      </div>
      <div className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-40 w-[230px] rounded-lg border border-slate-200/20 bg-slate-950/90 px-2.5 py-2 text-[10px] font-semibold text-slate-100 opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
        <p className="text-[9px] uppercase tracking-[0.12em] text-slate-300">{label} · {textValue}</p>
        <p className="mt-1 leading-relaxed text-slate-200">{tooltip}</p>
      </div>
    </div>
  );
}
