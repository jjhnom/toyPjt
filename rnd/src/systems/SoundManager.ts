import { MAX_SOUND_VOICES, SOUND_DEFINITIONS,COMBAT_SOUND_IDS,ATTACK_SOUNDS,enemyDeathSound } from '../config/soundData';
import type {CombatSoundId} from '../config/soundData';
import { BOSS_SOUND_IDS } from '../config/bossSoundData';
import type { BossSoundId, BossLoopId, BossSoundBus } from '../config/bossSoundData';
import type {DroneArchetype,EnemyArchetype} from '../types/game';
import type { SoundGroup, SoundId } from '../config/soundData';
import { createAudioOutputGuard } from './audioMix';
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
    loadSample?: (url:string)=>Promise<ArrayBuffer>;
}
interface Voice {
    id: SoundId;
    priority: number;
    osc: OscillatorNode|AudioBufferSourceNode;
    gain: GainNode;
    finished: boolean;
    stopping?: boolean;
    gainScale: number;
}
const volume = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
/** Owns audio only. Playback never waits for activation and cannot gate a game event. */
export class SoundManager {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private outputGuard?: WaveShaperNode;
    private groups: Record<SoundGroup, GainNode> | null = null;
    private settings: SoundSettings = { enabled: true, masterVolume: 1, sfxVolume: 1, uiVolume: 1 };
    private readonly voices = new Set<Voice>();
    private readonly lastStart: Partial<Record<SoundId, number>> = {};
    private readonly lastCategory:Partial<Record<'attack'|'impact'|'death',{time:number;priority:number}>>={};
    private readonly encoded=new Map<SoundId,ArrayBuffer>();
    private readonly buffers=new Map<SoundId,AudioBuffer>();
    private readonly decoding=new Map<SoundId,Promise<void>>();
    private sampleLoad:Promise<void>|null=null;
    private bossSampleLoad: Promise<void> | null = null;
    private readonly bossVolumes: Record<BossSoundBus, number> = { bossCast: 1, bossLoop: 1, bossUI: 1 };
    private readonly settingsListeners = new Set<(settings: Readonly<SoundSettings>) => void>();
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
    public subscribeSettings(listener: (settings: Readonly<SoundSettings>) => void): () => void {
        this.settingsListeners.add(listener);
        listener(this.getSettings());
        return () => { this.settingsListeners.delete(listener); };
    }
    private notifySettings(): void {
        const settings = this.getSettings();
        for (const listener of this.settingsListeners) {
            try { listener(settings); } catch { this.counters.audioErrors++; }
        }
    }
    public getDiagnostics() {
        const activeBySound = Object.fromEntries(Object.keys(SOUND_DEFINITIONS).map(id=>[id,0])) as Record<SoundId,number>;
        for (const voice of this.voices)
            activeBySound[voice.id]++;
        return { ...this.counters, outputGuard:!!this.outputGuard, loadedSamples:this.encoded.size,decodedSamples:this.buffers.size,activeVoices: this.voices.size, activeBySound, contextState: this.ctx?.state ?? 'uninitialized', background: this.backgrounds.size > 0, unlocked: this.unlocked, disposed: this.disposed };
    }
    /** Fetch during boot without creating an AudioContext. Never queue past combat events. */
    public preloadCombatSounds():Promise<void> {
        if(this.disposed)return Promise.resolve();
        return this.sampleLoad ??= this.preloadSamples(COMBAT_SOUND_IDS, 'sfx');
    }
    public preloadBossSounds(): Promise<void> {
        if (this.disposed) return Promise.resolve();
        return this.bossSampleLoad ??= this.preloadSamples(BOSS_SOUND_IDS, 'boss');
    }
    private preloadSamples(ids: readonly SoundId[], folder: string): Promise<void> {
        return Promise.all(ids.map(async id=>{
            try{
                const path=`audio/${folder}/${id}.ogg`,url=typeof document==='undefined'?path:new URL(path,document.baseURI).href;
                const data=this.options.loadSample?await this.options.loadSample(url):await fetch(url).then(r=>{if(!r.ok)throw Error('Audio load failed');return r.arrayBuffer();});
                if(this.disposed)return;this.encoded.set(id,data);if(this.ctx)await this.decodeSample(id,data,this.ctx);
            }catch{this.counters.audioErrors++;}
        })).then(()=>{});
    }
    private decodeSample(id:SoundId,data:ArrayBuffer,ctx:AudioContext):Promise<void> {
        if(this.buffers.has(id))return Promise.resolve();
        const current=this.decoding.get(id);if(current)return current;
        const pending=Promise.resolve().then(()=>ctx.decodeAudioData(data.slice(0))).then(buffer=>{if(!this.disposed&&this.ctx===ctx)this.buffers.set(id,buffer);}).catch(()=>{this.counters.audioErrors++;}).finally(()=>{if(this.decoding.get(id)===pending)this.decoding.delete(id);});
        this.decoding.set(id,pending);return pending;
    }
    public setEnabled(enabled: boolean): void {
        this.settings.enabled = enabled;
        this.notifySettings();
        this.applyMix();
        if (!enabled)
            this.stopVoices(true);
    }
    public setMasterVolume(value: number): void {
        this.settings.masterVolume = volume(value);
        this.notifySettings();
        this.applyMix();
        if (this.settings.masterVolume === 0)
            this.stopVoices(true);
    }
    public setGroupVolume(group: SoundGroup, value: number): void {
        if (group !== 'sfx' && group !== 'ui')
            return;
        this.settings[group === 'sfx' ? 'sfxVolume' : 'uiVolume'] = volume(value);
        this.applyMix();
        if (group === 'sfx' && this.settings.sfxVolume === 0) this.stopAllBossAudio(0);
    }
    public setBossVolume(bus: BossSoundBus, value: number): void {
        if (!(bus in this.bossVolumes)) return;
        this.bossVolumes[bus] = volume(value);
        try {
            for (const voice of this.voices) {
                const def = SOUND_DEFINITIONS[voice.id];
                if (def.bossBus !== bus || voice.stopping) continue;
                if (this.bossVolumes[bus] === 0) this.stopVoice(voice, false);
                else this.ramp(voice.gain.gain, (def.sampleGain ?? def.gain) * voice.gainScale * this.bossVolumes[bus], this.ctx?.currentTime ?? 0);
            }
        } catch { this.counters.audioErrors++; }
    }
    private allowed(): boolean { return !this.disposed && this.settings.enabled && this.settings.masterVolume > 0 && this.backgrounds.size === 0; }
    private createContext(): AudioContext | null {
        if (this.ctx?.state === 'closed')
            this.releaseGraph();
        if (this.ctx)
            return this.ctx;
        let ctx: AudioContext | null = null, master: GainNode | undefined, sfx: GainNode | undefined, ui: GainNode | undefined, outputGuard: WaveShaperNode | undefined;
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
            outputGuard = createAudioOutputGuard(ctx);
            if (outputGuard) {
                master.connect(outputGuard);
                outputGuard.connect(ctx.destination);
            } else master.connect(ctx.destination);
            this.ctx = ctx;
            this.master = master;
            this.outputGuard = outputGuard;
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
            for(const [id,data]of this.encoded)void this.decodeSample(id,data,ctx);
            return ctx;
        }
        catch {
            this.counters.audioErrors++;
            for (const node of [ui, sfx, master, outputGuard]) {
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
        for(const category of ['attack','impact','death'] as const)delete this.lastCategory[category];
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
    public playCombat(id:CombatSoundId):void {this.playSound(id);}
    public playUnitAttack(id:DroneArchetype):void {this.playSound(ATTACK_SOUNDS[id]);}
    public playEnemyDeath(id:EnemyArchetype):void {this.playSound(enemyDeathSound(id));}
    public playBoss(id: BossSoundId, options?: { gainScale?: number; restart?: boolean }): void {
        if (SOUND_DEFINITIONS[id].loop) return;
        const gainScale = volume(options?.gainScale ?? 1);
        if (gainScale === 0) return;
        if (options?.restart) this.stopBossSound(id, 20);
        this.playSound(id, 1, gainScale);
    }
    public startBossLoop(id: BossLoopId): void {
        for (const voice of this.voices) {
            if (voice.id !== id) continue;
            if (!voice.stopping) return;
            this.stopVoice(voice, false);
        }
        this.playSound(id);
    }
    public stopBossLoop(id: BossLoopId, fadeMs = 150): void {
        this.stopBossSound(id, fadeMs);
    }
    public stopBossSound(id: BossSoundId, fadeMs = 30): void {
        for (const voice of this.voices) if (voice.id === id) this.fadeBossVoice(voice, fadeMs);
    }
    public stopAllBossAudio(fadeMs = 150, preserveDeath = false): void {
        for (const voice of this.voices) {
            if (SOUND_DEFINITIONS[voice.id].bossBus && !(preserveDeath && voice.id === 'boss_death'))
                this.fadeBossVoice(voice, fadeMs);
        }
    }
    private fadeBossVoice(voice: Voice, fadeMs: number): void {
        if (!this.ctx || this.ctx.state !== 'running' || fadeMs <= 0) { this.stopVoice(voice, false); return; }
        if (voice.stopping) return;
        try {
            const now = this.ctx.currentTime;
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
            voice.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
            voice.osc.stop(now + fadeMs / 1000);
            voice.stopping = true;
        } catch { this.stopVoice(voice, false); }
    }
    private playSound(id: SoundId, tier = 1, gainScale = 1): void {
        this.counters.requested++;
        const def = SOUND_DEFINITIONS[id], ctx = this.ctx;
        if (!this.settings.enabled || this.settings.masterVolume === 0 || this.settings[def.group === 'sfx' ? 'sfxVolume' : 'uiVolume'] === 0 || (def.bossBus && this.bossVolumes[def.bossBus] === 0)) {
            this.counters.skippedDisabled++;
            return;
        }
        // Missing boss assets stay silent; never synthesize or replay a delayed spell.
        if (def.bossBus && !this.buffers.has(id)) { this.counters.skippedState++; return; }
        if (!this.allowed() || !this.unlocked || !ctx || ctx.state !== 'running' || !this.groups) {
            this.counters.skippedState++;
            return;
        }
        let osc: OscillatorNode|AudioBufferSourceNode|undefined, gain: GainNode | undefined, voice: Voice | undefined;
        try {
            const time = this.options.now?.() ?? performance.now(), last = this.lastStart[id];
            const category=def.category?this.lastCategory[def.category]:undefined;
            if(category&&time-category.time<def.intervalMs&&def.priority<=category.priority){this.counters.skippedCooldown++;return;}
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
            const buffer=this.buffers.get(id);
            osc=buffer?ctx.createBufferSource():ctx.createOscillator();
            gain = ctx.createGain();
            const now = ctx.currentTime;
            if(buffer){
                (osc as AudioBufferSourceNode).buffer=buffer;
                (osc as AudioBufferSourceNode).loop = def.loop ?? false;
                const level = (def.sampleGain ?? def.gain) * gainScale * (def.bossBus ? this.bossVolumes[def.bossBus] : 1);
                gain.gain.setValueAtTime(def.loop ? 0 : level,now);
                if (def.loop) gain.gain.linearRampToValueAtTime(level, now + .03);
            }else{
            const tone=osc as OscillatorNode;
            tone.type = id === 'shoot' && tier === 3 ? 'sawtooth' : def.wave;
            const hz = id === 'shoot' ? (tier === 3 ? 920 : tier === 2 ? 760 : 620) : def.startHz;
            tone.frequency.setValueAtTime(hz, now);
            tone.frequency.exponentialRampToValueAtTime(def.endHz, now + def.sweepMs / 1000);
            gain.gain.setValueAtTime(.001, now);
            gain.gain.linearRampToValueAtTime(def.gain, now + .003);
            gain.gain.exponentialRampToValueAtTime(.001, now + def.envelopeMs / 1000);
            }
            osc.connect(gain);
            gain.connect(this.groups[def.group]);
            voice = { id, priority: def.priority, osc, gain, gainScale, finished: false };
            const current = voice;
            osc.onended = () => this.releaseVoice(current);
            this.voices.add(voice);
            osc.start(now);
            if (!def.loop) osc.stop(now + (buffer?buffer.duration:def.stopMs/1000));
            this.lastStart[id] = time;
            if(def.category)this.lastCategory[def.category]={time,priority:def.priority};
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
        for (const node of [this.groups?.sfx, this.groups?.ui, this.master, this.outputGuard]) {
            try {
                node?.disconnect();
            }
            catch { /* Partial graph. */ }
        }
        this.ctx = null;
        this.master = null;
        this.outputGuard = undefined;
        this.groups = null;
        this.unlocked = false;
        this.buffers.clear();this.decoding.clear();
        for(const category of ['attack','impact','death'] as const)delete this.lastCategory[category];
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
        this.encoded.clear();
        this.settingsListeners.clear();
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
