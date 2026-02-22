interface StatPillProps {
  label: string;
  value: string;
  color?: string;
}

export function StatPill({ label, value, color = "text-slate-900" }: StatPillProps) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-800/50 bg-slate-950/50 px-3 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
      <span className={`font-mono text-xs font-black ${color}`}>{value}</span>
    </div>
  );
}