
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
  red: "bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_10px_rgba(225,29,72,0.5)]",
  blue: "bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]",
  yellow: "bg-gradient-to-r from-yellow-500 to-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
  green: "bg-gradient-to-r from-emerald-600 to-green-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
  purple: "bg-gradient-to-r from-violet-600 to-fuchsia-400 shadow-[0_0_10px_rgba(139,92,246,0.5)]",
};

const HUD_TEXT_TONE_CLASS: Record<HudTone, string> = {
  red: "text-red-400",
  blue: "text-blue-400",
  yellow: "text-yellow-400",
  green: "text-emerald-400",
  purple: "text-violet-400",
};

export function HudProgressBar({ value, max, tone, label, textValue }: HudProgressBarProps) {
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className="w-36">
      <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className={HUD_TEXT_TONE_CLASS[tone]}>{textValue}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-slate-700/40 bg-slate-800/50">
        <div className={`h-full rounded-full transition-all duration-700 ${HUD_BAR_TONE_CLASS[tone]} ${widthPercentClass(percentage)}`} />
      </div>
    </div>
  );
}
