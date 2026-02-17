
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
        <div className="mb-4 rounded-lg bg-red-500/10 p-4 text-red-400 border border-red-500/20 flex items-start gap-3">
            <Icon name="alert-circle" className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="flex-1 text-sm">{message}</p>
            <button
                type="button"
                onClick={onClose}
                className="text-red-400 hover:text-red-300 transition-colors"
                aria-label="Fechar mensagem de erro"
            >
                <Icon name="x" className="w-5 h-5" />
            </button>
        </div>
    );
}
