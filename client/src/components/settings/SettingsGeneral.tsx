import { Icon } from "../common/Icon";
import { DetailedToggle } from "../common/DetailedToggle";
import type { ClientPreferences } from "../../contexts/PreferencesContext";

interface SettingsGeneralProps {
    preferences: ClientPreferences;
    updatePreference: <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => void;
}

export function SettingsGeneral({ preferences, updatePreference }: SettingsGeneralProps) {
    return (
        <>
            <section>
                <div className="mb-6 flex items-center gap-4">
                    <div className="rounded-xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] p-3 text-[hsl(var(--accent))] shadow-[0_0_15px_rgba(var(--glow),0.2)]">
                        <Icon name="palette" className="text-[24px]" />
                    </div>
                    <h2 className="text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                        Interface Visual
                    </h2>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <DetailedToggle
                        label="Efeitos Glitch"
                        desc="Artefatos visuais de instabilidade do sistema."
                        active={preferences.glitchEffects}
                        onClick={() => updatePreference("glitchEffects", !preferences.glitchEffects)}
                        icon="activity"
                    />
                    <DetailedToggle
                        label="Modo Furtivo"
                        desc="Oculta status online de outros caçadores."
                        active={preferences.stealthMode}
                        onClick={() => updatePreference("stealthMode", !preferences.stealthMode)}
                        icon="eye-crossed"
                    />
                </div>
            </section>

            <section>
                <div className="mb-6 flex items-center gap-4">
                    <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                        <Icon name="microchip" className="text-[24px]" />
                    </div>
                    <h2 className="text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                        Sistema
                    </h2>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <DetailedToggle
                        label="Notificacoes"
                        desc="Alertas de missoes e atualizacoes do sistema."
                        active={preferences.notifications}
                        onClick={() => updatePreference("notifications", !preferences.notifications)}
                    />
                    <DetailedToggle
                        label="Efeitos Sonoros"
                        desc="Feedback auditivo de interacoes e combate."
                        active={preferences.soundEffects}
                        onClick={() => updatePreference("soundEffects", !preferences.soundEffects)}
                    />
                </div>
            </section>
        </>
    );
}
