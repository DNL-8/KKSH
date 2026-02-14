import {
    type ReactNode,
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error" | "info";

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return ctx;
}

/* ------------------------------------------------------------------ */
/*  Auto-dismiss duration (ms)                                        */
/* ------------------------------------------------------------------ */

const TOAST_DURATION = 4000;

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counterRef = useRef(0);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string, type: ToastType = "info") => {
            counterRef.current += 1;
            const id = counterRef.current;
            setToasts((prev) => [...prev, { id, message, type }]);
            setTimeout(() => removeToast(id), TOAST_DURATION);
        },
        [removeToast],
    );

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}

            {/* Toast container – bottom-right */}
            <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex flex-col-reverse items-end gap-3">
                {toasts.map((toast) => (
                    <ToastNotification key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

/* ------------------------------------------------------------------ */
/*  Single toast notification                                         */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<ToastType, typeof Info> = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
    success: "border-emerald-500/40 bg-emerald-950/90 text-emerald-200",
    error: "border-red-500/40 bg-red-950/90 text-red-200",
    info: "border-cyan-500/40 bg-cyan-950/90 text-cyan-200",
};

function ToastNotification({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
    const Icon = ICON_MAP[toast.type];

    return (
        <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-10 duration-300 ${COLOR_MAP[toast.type]}`}
        >
            <Icon size={18} className="shrink-0" />
            <p className="flex-1 text-sm font-semibold">{toast.message}</p>
            <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1 transition-colors hover:bg-white/10"
                type="button"
                aria-label="Fechar notificacao"
            >
                <X size={14} />
            </button>
        </div>
    );
}
