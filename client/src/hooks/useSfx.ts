import { useCallback, useRef } from "react";
import { usePreferences } from "../contexts/PreferencesContext";

/* ------------------------------------------------------------------ */
/*  Shared AudioContext singleton                                     */
/* ------------------------------------------------------------------ */

/** Internal singleton */
let _ctx: AudioContext | null = null;

/** 
 * Resumes the AudioContext on user gesture. 
 * Exported so AppShell can call it on first click.
 */
export function resumeAudioContext() {
    try {
        if (!_ctx) _ctx = new AudioContext();
        if (_ctx.state === "suspended") void _ctx.resume();
    } catch (e) {
        console.warn("Failed to resume AudioContext:", e);
    }
}

function ctx(): AudioContext | null {
    try {
        if (!_ctx) _ctx = new AudioContext();
        // If it's already running, we're good. 
        // If it's suspended, we try to resume (this usually happens during an event handler)
        if (_ctx.state === "suspended") void _ctx.resume();
        return _ctx;
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ */
/*  Pre-defined sound effects                                         */
/* ------------------------------------------------------------------ */

/** Short click / tick sound */
function _tick() {
    const c = ctx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(0.015, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.start(t);
    osc.stop(t + 0.05);
}

/** Navigation transition — soft ascending sweep */
function _navigate() {
    const c = ctx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.12);
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.18);
}

/** Toggle switch sound — two tones */
function _toggle() {
    const c = ctx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(900, t + 0.06);
    g.gain.setValueAtTime(0.025, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.14);
}

/** Boot / power-on sound — dramatic ascending chord */
function _boot() {
    const c = ctx();
    if (!c) return;
    const t = c.currentTime;

    // Base tone
    const o1 = c.createOscillator();
    const g1 = c.createGain();
    o1.connect(g1);
    g1.connect(c.destination);
    o1.type = "sine";
    o1.frequency.setValueAtTime(120, t);
    o1.frequency.exponentialRampToValueAtTime(220, t + 0.4);
    g1.gain.setValueAtTime(0.06, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    o1.start(t);
    o1.stop(t + 0.85);

    // Harmonic sweep
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.connect(g2);
    g2.connect(c.destination);
    o2.type = "triangle";
    o2.frequency.setValueAtTime(200, t + 0.1);
    o2.frequency.exponentialRampToValueAtTime(600, t + 0.5);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.04, t + 0.15);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o2.start(t + 0.1);
    o2.stop(t + 0.75);

    // High sparkle
    const o3 = c.createOscillator();
    const g3 = c.createGain();
    o3.connect(g3);
    g3.connect(c.destination);
    o3.type = "sine";
    o3.frequency.setValueAtTime(800, t + 0.25);
    o3.frequency.exponentialRampToValueAtTime(1200, t + 0.5);
    g3.gain.setValueAtTime(0, t);
    g3.gain.linearRampToValueAtTime(0.02, t + 0.3);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o3.start(t + 0.25);
    o3.stop(t + 0.65);
}

/** Level-up / power-up celebration sound */
function _powerUp(baseFreq = 300) {
    const c = ctx();
    if (!c) return;
    const t = c.currentTime;

    const osc = c.createOscillator();
    const g = c.createGain();
    const osc2 = c.createOscillator();
    const g2 = c.createGain();
    osc.connect(g);
    osc2.connect(g2);
    g.connect(c.destination);
    g2.connect(c.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 3, t + 0.25);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(baseFreq * 1.5, t);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 4, t + 0.2);
    g2.gain.setValueAtTime(0.03, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.35);
    osc2.stop(t + 0.3);
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export type SfxName = "tick" | "navigate" | "toggle" | "boot" | "powerUp";

const SFX_MAP: Record<SfxName, () => void> = {
    tick: _tick,
    navigate: _navigate,
    toggle: _toggle,
    boot: _boot,
    powerUp: _powerUp,
};

/**
 * Returns a stable `play` function that respects the user's
 * `soundEffects` preference. Use across any component.
 *
 * ```tsx
 * const sfx = useSfx();
 * <button onClick={() => sfx("tick")}>...</button>
 * ```
 */
export function useSfx() {
    const { preferences } = usePreferences();
    const prefsRef = useRef(preferences);
    prefsRef.current = preferences;

    return useCallback((name: SfxName) => {
        if (!prefsRef.current.soundEffects) return;
        SFX_MAP[name]();
    }, []);
}
