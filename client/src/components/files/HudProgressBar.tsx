import { widthPercentClass } from "../../lib/percentClasses";

export type HudTone = "red" | "blue" | "yellow" | "green" | "purple";

export interface HudProgressBarProps {
  value: number;
  max: number;
  tone: HudTone;
  label: string;
  textValue: string;
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

export function HudProgressBar({ value, max, tone, label, textValue }: HudProgressBarProps) {
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className="min-w-[126px]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="files-display text-[9px] uppercase tracking-widest text-slate-600">{label}</span>
        <span className={`text-[10px] font-black uppercase ${HUD_TEXT_TONE_CLASS[tone]}`}>{textValue}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-cyan-950/80 bg-[#071323]">
        <div className={`h-full rounded-full transition-all duration-700 ${HUD_BAR_TONE_CLASS[tone]} ${widthPercentClass(percentage)}`} />
      </div>
    </div>
  );
}
