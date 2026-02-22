import { Icon } from "./Icon";

interface EmptyStateProps {
    icon: string;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
}

/**
 * Reusable empty state placeholder with icon, message, and optional CTA.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-6 py-20 text-center animate-in fade-in duration-500">
            <div className="rounded-3xl border border-slate-800 liquid-glass/40 p-6">
                <Icon name={icon} className="text-slate-500 text-[40px]" />
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-800">{title}</h3>
                <p className="max-w-sm text-sm font-medium text-slate-500">{description}</p>
            </div>
            {action && (
                <button
                    onClick={action.onClick}
                    className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-8 py-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-95"
                    type="button"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
