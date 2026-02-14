import type { LucideIcon } from "lucide-react";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  icon?: LucideIcon;
}

export function Badge({
  children,
  color = "border-cyan-500/20 bg-cyan-500/10 text-cyan-500",
  icon: Icon,
}: BadgeProps) {
  return (
    <span className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${color}`}>
      {Icon && <Icon size={10} />}
      {children}
    </span>
  );
}