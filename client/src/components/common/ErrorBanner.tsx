
import { Icon } from "./Icon";

interface ErrorBannerProps {
    message: string | null;
    onClose: () => void;
}

export function ErrorBanner({ message, onClose }: ErrorBannerProps) {
    if (!message) {
        return null;
    }

    return (
        <div className="files-alert files-alert-error mb-4 flex items-start gap-4">
            <div className="rounded-full bg-red-500/20 p-2 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <Icon name="exclamation" className="shrink-0 text-[18px]" />
            </div>
            <div className="flex-1">
                <p className="files-display mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-300">Erro do Sistema</p>
                <p className="text-sm font-medium leading-relaxed">{message}</p>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="rounded-lg liquid-glass-inner p-2 text-red-300 transition-all hover:liquid-glass-inner hover:text-slate-900"
                aria-label="Fechar mensagem de erro"
            >
                <Icon name="cross" className="text-[16px]" />
            </button>
        </div>
    );
}
