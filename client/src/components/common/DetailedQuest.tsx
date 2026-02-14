import { CheckCircle2 } from "lucide-react";

interface DetailedQuestProps {
  title: string;
  xp: string;
  type: string;
  progress: number;
  total: number;
  color?: string;
  completed?: boolean;
}

export function DetailedQuest({
  title,
  xp,
  type,
  progress,
  total,
  color = "bg-orange-500",
  completed = false,
}: DetailedQuestProps) {
  return (
    <div
      className={`rounded-3xl border p-5 transition-all duration-300 ${completed
          ? "border-emerald-900/20 bg-emerald-950/5 opacity-60"
          : "group border-slate-800 bg-[#0f1116] shadow-lg hover:border-slate-700"
        }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${completed ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-800 text-slate-500"
                }`}
            >
              {type}
            </span>
            <span className="text-[10px] font-black text-yellow-500">+{xp} XP</span>
          </div>
          <h4
            className={`text-sm font-black tracking-tight transition-colors ${completed ? "text-slate-500 line-through" : "text-white group-hover:text-orange-400"
              }`}
          >
            {title}
          </h4>
        </div>
        {completed ? (
          <CheckCircle2 size={18} className="text-emerald-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border border-slate-700" />
        )}
      </div>
      {!completed && (
        <div className="space-y-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(progress / total) * 100}%` }} />
          </div>
          <div className="text-right font-mono text-[10px] uppercase text-slate-400">
            {progress} / {total}
          </div>
        </div>
      )}
    </div>
  );
}