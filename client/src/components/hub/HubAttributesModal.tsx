
import { Icon } from "../common/Icon";
import type { AttributeKey, TechnicalAttributes } from "../../lib/hub/attributes";
import { useTheme } from "../../contexts/ThemeContext";

interface HubAttributesModalProps {
    draftAttributes: TechnicalAttributes;
    onDraftChange: (key: AttributeKey, value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export function HubAttributesModal({ draftAttributes, onDraftChange, onSave, onClose }: HubAttributesModalProps) {
    const { isIosTheme } = useTheme();
    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isIosTheme ? "ios26-section" : "liquid-glass"}`}>
            <div
                data-testid="hub-attributes-modal"
                role="dialog"
                aria-modal="true"
                className={`w-full max-w-md rounded-3xl p-6 ${isIosTheme ? "ios26-section-hero ios26-sheen" : "border border-blue-500/30 bg-[#0a0b10]"}`}
            >
                <div className={`mb-5 flex items-center justify-between border-b pb-3 ${isIosTheme ? "ios26-divider" : "border-slate-300/50"}`}>
                    <h3 className={`text-lg font-black uppercase italic ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>Configuracao de Status</h3>
                    <button type="button" onClick={onClose} aria-label="Fechar modal de atributos" className={`rounded-full p-2 ${isIosTheme ? "ios26-control ios26-focusable" : "text-slate-300 hover:bg-white/[0.10] hover:text-slate-100"}`}>
                        <Icon name="cross" className="text-lg" />
                    </button>
                </div>
                {(["python", "sql", "excel", "etl"] as AttributeKey[]).map((key) => (
                    <div key={key} className="mb-4 space-y-1.5">
                        <label htmlFor={`hub-attr-${key}`} className={`text-[10px] font-black uppercase tracking-wider ${isIosTheme ? "text-slate-800" : "text-slate-300"}`}>
                            {key.toUpperCase()}
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                id={`hub-attr-${key}`}
                                data-testid={`hub-attr-${key}`}
                                type="range"
                                min={0}
                                max={100}
                                value={draftAttributes[key]}
                                onChange={(event) => onDraftChange(key, event.currentTarget.value)}
                                className={`h-2 w-full cursor-pointer rounded ${isIosTheme ? "ios26-field ios26-focusable" : "liquid-glass-inner"}`}
                            />
                            <div data-testid={`hub-attr-${key}-value`} className="w-12 text-right font-mono text-cyan-400">
                                {draftAttributes[key]}%
                            </div>
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    data-testid="hub-attributes-save"
                    onClick={onSave}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider ${isIosTheme
                        ? "ios26-control ios26-focusable text-slate-800"
                        : "bg-blue-600 text-slate-900 hover:bg-blue-500"
                        }`}
                >
                    <Icon name="disk" className="mr-2" /> Salvar Alteracoes
                </button>
            </div>
        </div>
    );
}

