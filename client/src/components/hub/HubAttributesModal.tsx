
import { Save, X } from "lucide-react";
import type { AttributeKey, TechnicalAttributes } from "../../lib/hub/attributes";

interface HubAttributesModalProps {
    draftAttributes: TechnicalAttributes;
    onDraftChange: (key: AttributeKey, value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export function HubAttributesModal({ draftAttributes, onDraftChange, onSave, onClose }: HubAttributesModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div
                data-testid="hub-attributes-modal"
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-3xl border border-blue-500/30 bg-[#0a0b10] p-6"
            >
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-lg font-black uppercase italic text-white">Configuracao de Status</h3>
                    <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>
                {(["python", "sql", "excel", "etl"] as AttributeKey[]).map((key) => (
                    <div key={key} className="mb-4 space-y-1.5">
                        <label htmlFor={`hub-attr-${key}`} className="text-[10px] font-black uppercase tracking-wider text-slate-300">
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
                                className="h-2 w-full cursor-pointer rounded bg-slate-800"
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
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black uppercase tracking-wider text-white hover:bg-blue-500"
                >
                    <Save size={15} /> Salvar Alteracoes
                </button>
            </div>
        </div>
    );
}
