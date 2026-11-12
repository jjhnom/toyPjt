import { MAX_SOUND_VOICES, SOUND_DEFINITIONS } from '../config/soundData';
import type { SoundGroup, SoundId } from '../config/soundData';
export type { SoundGroup, SoundId } from '../config/soundData';
export interface SoundSettings {
    enabled: boolean;
    masterVolume: number;
    sfxVolume: number;
    uiVolume: number;
}
interface SoundOptions {
    createContext?: () => AudioContext | null;
    now?: () => number;
    resumeTimeoutMs?: number;
}
interface Voice {
    id: SoundId;
    priority: number;
    osc: OscillatorNode;
    gain: GainNode;
    finished: boolean;
}
const volume = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
/** Owns audio only. Playback never waits for activation and cannot gate a game event. */
export class SoundManager {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private groups: Record<SoundGroup, GainNode> | null = null;
    private settings: SoundSettings = { enabled: true, masterVolume: 1, sfxVolume: 1, uiVolume: 1 };
    private readonly voices = new Set<Voice>();
    private readonly lastStart: Partial<Record<SoundId, number>> = {};
    private readonly backgrounds = new Set<string>();
    private unlocked = false;
    private disposed = false;
    private resumePending: Promise<boolean> | null = null;
    private cancelResume: (() => void) | null = null;
    private suspendPending: Promise<void> | null = null;
    private foregroundPending: Promise<boolean> | null = null;
    private disposal: Promise<void> | null = null;
    private readonly counters = { requested: 0, played: 0, skippedCooldown: 0, skippedVoiceLimit: 0, skippedDisabled: 0, skippedState: 0, unlockFailures: 0, audioErrors: 0, peakVoices: 0 };
    constructor(private readonly options: SoundOptions = {}) { }
    public isEnabled(): boolean { return this.settings.enabled; }
    public getSettings(): Readonly<SoundSettings> { return { ...this.settings }; }
    public getDiagnostics() {
        const activeBySound: Record<SoundId, number> = { shoot: 0, hit: 0, explosion: 0, powerup: 0 };
        for (const voice of this.voices)
            activeBySound[voice.id]++;
        return { ...this.counters, activeVoices: this.voices.size, activeBySound, contextState: this.ctx?.state ?? 'uninitialized', background: this.backgrounds.size > 0, unlocked: this.unlocked, disposed: this.disposed };
    }
    public setEnabled(enabled: boolean): void {
        this.settings.enabled = enabled;
        this.applyMix();
        if (!enabled)
            this.stopVoices(true);
    }
    public setMasterVolume(value: number): void {
        this.settings.masterVolume = volume(value);
        this.applyMix();
        if (this.settings.masterVolume === 0)
            this.stopVoices(true);
    }
    public setGroupVolume(group: SoundGroup, value: number): void {
        if (group !== 'sfx' && group !== 'ui')
            return;
        this.settings[group === 'sfx' ? 'sfxVolume' : 'uiVolume'] = volume(value);
        this.applyMix();
    }
    private allowed(): boolean { return !this.disposed && this.settings.enabled && this.settings.masterVolume > 0 && this.backgrounds.size === 0; }
    private createContext(): AudioContext | null {
        if (this.ctx?.state === 'closed')
            this.releaseGraph();
        if (this.ctx)
            return this.ctx;
        let ctx: AudioContext | null = null, master: GainNode | undefined, sfx: GainNode | undefined, ui: GainNode | undefined;
        try {
            if (this.options.createContext)
                ctx = this.options.createContext();
            else if (typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || (window as unknown as {
                    webkitAudioContext?: typeof AudioContext;
                }).webkitAudioContext;
                if (AudioCtx)
                    ctx = new AudioCtx();
            }
            if (!ctx)
                return null;
            master = ctx.createGain();
            sfx = ctx.createGain();
            ui = ctx.createGain();
            master.gain.setValueAtTime(0, ctx.currentTime);
            sfx.connect(master);
            ui.connect(master);
            master.connect(ctx.destination);
            this.ctx = ctx;
            this.master = master;
            this.groups = { sfx, ui };
            this.unlocked = false;
            const owned = ctx;
            ctx.onstatechange = () => {
                if (this.ctx !== owned || this.disposed)
                    return;
                if (owned.state !== 'running')
                    this.stopVoices(false);
                this.applyMix();
                if (owned.state === 'running' && this.backgrounds.size > 0)
                    void this.suspendContext(owned);
            };
            this.applyMix();
            return ctx;
        }
        catch {
            this.counters.audioErrors++;
            for (const node of [ui, sfx, master]) {
                try {
                    node?.disconnect();
                }
                catch { /* Partial graph. */ }
            }
            if (ctx) {
                try {
                    void Promise.resolve(ctx.close()).catch(() => { });
                }
                catch { /* Unsupported close. */ }
            }
            return null;
        }
    }
    /** Invoke synchronously in an input callback. No sound requests are queued for a later unlock. */
    public unlockFromUserGesture(): Promise<boolean> {
        if (!this.allowed() || (this.settings.sfxVolume === 0 && this.settings.uiVolume === 0))
            return Promise.resolve(false);
        const ctx = this.createContext();
        if (!ctx) {
            this.counters.unlockFailures++;
            return Promise.resolve(false);
        }
        // Never defer the first resume outside its gesture while a suspension is pending.
        if (this.suspendPending)
            return Promise.resolve(false);
        return this.resumeContext(ctx);
    }
    private resumeContext(ctx: AudioContext): Promise<boolean> {
        if (!this.allowed() || ctx !== this.ctx || ctx.state === 'closed')
            return Promise.resolve(false);
        if (this.resumePending)
            return this.resumePending;
        if (ctx.state === 'running') {
            this.unlocked = true;
            this.applyMix();
            return Promise.resolve(true);
        }
        let resume: Promise<void>;
        try {
            resume = ctx.resume();
        }
        catch {
            this.counters.unlockFailures++;
            return Promise.resolve(false);
        }
        let finish!: (ok: boolean) => void;
        const result = new Promise<boolean>(resolve => { finish = resolve; });
        let settled = false;
        const complete = (ok: boolean, failed = false) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (failed)
                this.counters.unlockFailures++;
            if (this.resumePending === result) {
                this.resumePending = null;
                this.cancelResume = null;
            }
            finish(ok);
        };
        const timer = setTimeout(() => complete(false, true), Math.max(1, this.options.resumeTimeoutMs ?? 1500));
        this.resumePending = result;
        this.cancelResume = () => complete(false);
        Promise.resolve(resume).then(() => {
            if (ctx !== this.ctx || this.disposed) {
                complete(false);
                return;
            }
            const running = ctx.state === 'running';
            if (running)
                this.unlocked = true;
            this.applyMix();
            if (this.backgrounds.size > 0)
                void this.suspendContext(ctx);
            complete(running && this.allowed(), !running);
        }, () => complete(false, true));
        return result;
    }
    public suspendForBackground(reason = 'app'): Promise<void> {
        this.backgrounds.add(reason);
        this.applyMix();
        this.stopVoices(false);
        for (const id of Object.keys(this.lastStart) as SoundId[])
            delete this.lastStart[id];
        return this.ctx ? this.suspendContext(this.ctx) : Promise.resolve();
    }
    private suspendContext(ctx: AudioContext): Promise<void> {
        if (ctx !== this.ctx || ctx.state === 'closed')
            return Promise.resolve();
        if (this.suspendPending)
            return this.suspendPending;
        let request: Promise<void>;
        try {
            request = ctx.suspend();
        }
        catch {
            this.counters.audioErrors++;
            return Promise.resolve();
        }
        const pending = Promise.resolve(request).catch(() => { this.counters.audioErrors++; }).then(() => { if (this.suspendPending === pending)
            this.suspendPending = null; });
        this.suspendPending = pending;
        return pending;
    }
    public resumeAfterForeground(reason = 'app'): Promise<boolean> {
        this.backgrounds.delete(reason);
        const ctx = this.ctx;
        if (!this.allowed() || !ctx || !this.unlocked || ctx.state === 'closed')
            return Promise.resolve(false);
        if (!this.suspendPending)
            return this.resumeContext(ctx);
        if (this.foregroundPending)
            return this.foregroundPending;
        const pending = this.suspendPending.then(() => this.resumeContext(ctx)).then(ok => { if (this.foregroundPending === pending)
            this.foregroundPending = null; return ok; });
        this.foregroundPending = pending;
        return pending;
    }
    private ramp(param: AudioParam, target: number, now: number): void {
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(target, now + .01);
    }
    private applyMix(): void {
        if (!this.ctx || !this.master || !this.groups)
            return;
        try {
            const now = this.ctx.currentTime;
            this.ramp(this.master.gain, this.allowed() && this.unlocked && this.ctx.state === 'running' ? this.settings.masterVolume : 0, now);
            this.ramp(this.groups.sfx.gain, this.settings.sfxVolume, now);
            this.ramp(this.groups.ui.gain, this.settings.uiVolume, now);
        }
        catch {
            this.counters.audioErrors++;
        }
    }
    public playShoot(tier: number): void { this.playSound('shoot', tier); }
    public playHit(): void { this.playSound('hit'); }
    public playExplosion(): void { this.playSound('explosion'); }
    public playPowerup(): void { this.playSound('powerup'); }
    private playSound(id: SoundId, tier = 1): void {
        this.counters.requested++;
        const def = SOUND_DEFINITIONS[id], ctx = this.ctx;
        if (!this.settings.enabled || this.settings.masterVolume === 0 || this.settings[def.group === 'sfx' ? 'sfxVolume' : 'uiVolume'] === 0) {
            this.counters.skippedDisabled++;
            return;
        }
        if (!this.allowed() || !this.unlocked || !ctx || ctx.state !== 'running' || !this.groups) {
            this.counters.skippedState++;
            return;
        }
        let osc: OscillatorNode | undefined, gain: GainNode | undefined, voice: Voice | undefined;
        try {
            const time = this.options.now?.() ?? performance.now(), last = this.lastStart[id];
            if (last !== undefined && time - last < def.intervalMs) {
                this.counters.skippedCooldown++;
                return;
            }
            let same = 0, victim: Voice | undefined;
            for (const current of this.voices) {
                if (current.id === id)
                    same++;
                if (current.priority < def.priority && (!victim || current.priority < victim.priority))
                    victim = current;
            }
            if (same >= def.maxVoices) {
                this.counters.skippedVoiceLimit++;
                return;
            }
            if (this.voices.size >= MAX_SOUND_VOICES) {
                if (!victim) {
                    this.counters.skippedVoiceLimit++;
                    return;
                }
                this.stopVoice(victim, false);
            }
            osc = ctx.createOscillator();
            gain = ctx.createGain();
            const now = ctx.currentTime;
            osc.type = id === 'shoot' && tier === 3 ? 'sawtooth' : def.wave;
            const hz = id === 'shoot' ? (tier === 3 ? 920 : tier === 2 ? 760 : 620) : def.startHz;
            osc.frequency.setValueAtTime(hz, now);
            osc.frequency.exponentialRampToValueAtTime(def.endHz, now + def.sweepMs / 1000);
            gain.gain.setValueAtTime(.001, now);
            gain.gain.linearRampToValueAtTime(def.gain, now + .003);
            gain.gain.exponentialRampToValueAtTime(.001, now + def.envelopeMs / 1000);
            osc.connect(gain);
            gain.connect(this.groups[def.group]);
            voice = { id, priority: def.priority, osc, gain, finished: false };
            const current = voice;
            osc.onended = () => this.releaseVoice(current);
            this.voices.add(voice);
            osc.start(now);
            osc.stop(now + def.stopMs / 1000);
            this.lastStart[id] = time;
            this.counters.played++;
            this.counters.peakVoices = Math.max(this.counters.peakVoices, this.voices.size);
        }
        catch {
            this.counters.audioErrors++;
            if (voice)
                this.stopVoice(voice, false);
            else {
                try {
                    osc?.stop();
                }
                catch { /* Not started. */ }
                try {
                    osc?.disconnect();
                    gain?.disconnect();
                }
                catch { /* Partial voice. */ }
            }
        }
    }
    private releaseVoice(voice: Voice): void {
        if (voice.finished)
            return;
        voice.finished = true;
        this.voices.delete(voice);
        voice.osc.onended = null;
        try {
            voice.osc.disconnect();
        }
        catch { /* Already disconnected. */ }
        try {
            voice.gain.disconnect();
        }
        catch { /* Already disconnected. */ }
    }
    private stopVoice(voice: Voice, fade: boolean): void {
        try {
            voice.osc.stop((this.ctx?.currentTime ?? 0) + (fade ? .01 : 0));
        }
        catch { /* Already stopped. */ }
        if (!fade)
            this.releaseVoice(voice);
    }
    private stopVoices(fade: boolean): void {
        const tail = fade && this.ctx?.state === 'running';
        for (const voice of this.voices)
            this.stopVoice(voice, tail);
    }
    private releaseGraph(): void {
        this.cancelResume?.();
        this.stopVoices(false);
        if (this.ctx)
            this.ctx.onstatechange = null;
        for (const node of [this.groups?.sfx, this.groups?.ui, this.master]) {
            try {
                node?.disconnect();
            }
            catch { /* Partial graph. */ }
        }
        this.ctx = null;
        this.master = null;
        this.groups = null;
        this.unlocked = false;
        this.suspendPending = null;
        this.foregroundPending = null;
        for (const id of Object.keys(this.lastStart) as SoundId[])
            delete this.lastStart[id];
    }
    public dispose(): Promise<void> {
        if (this.disposal)
            return this.disposal;
        this.disposed = true;
        const ctx = this.ctx;
        this.releaseGraph();
        let close: Promise<void> | undefined;
        try {
            if (ctx && ctx.state !== 'closed')
                close = ctx.close();
        }
        catch {
            this.counters.audioErrors++;
        }
        this.disposal = Promise.resolve(close).catch(() => { this.counters.audioErrors++; });
        return this.disposal;
    }
}
export const soundManager = new SoundManager();
