import type Phaser from 'phaser';
import { BGM_TRACKS, BGM_FADE_MS } from '../config/bgmData';
import type { BgmKey } from '../config/bgmData';
import type { SoundSettings } from './SoundManager';

type MusicSound = Phaser.Sound.HTML5AudioSound;
interface Track { key: BgmKey; sound: MusicSound; gain: number; from: number }
const clamp = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Game-owned music; scene pauses do not stop the global crossfade clock. */
export class BgmManager {
    private game?: Phaser.Game;
    private cache?: Phaser.Cache.BaseCache;
    private desired?: BgmKey;
    private current?: Track;
    private retiring?: Track;
    private elapsed = BGM_FADE_MS;
    private volume = 1;
    private master = 1;
    private enabled = true;
    private muted = false;
    private gestureSeen = false;
    private disposed = false;
    private readonly backgrounds = new Set<string>();
    private readonly loads = new Map<HTMLAudioElement, () => void>();
    private readonly failed = new Set<BgmKey>();
    private errors = 0;
    private starts = 0;
    private readonly step = (_time: number, delta: number) => this.update(delta);
    private readonly unlocked = () => this.reconcile();

    public play(scene: Pick<Phaser.Scene, 'game' | 'cache'>, key: BgmKey): void {
        if (this.disposed) return;
        if (!this.game) {
            this.game = scene.game;
            this.cache = scene.cache.audio;
            // The shared application lifecycle owns hidden/visible; avoid Phaser auto-resuming a muted track.
            this.game.sound.pauseOnBlur = false;
            const manager = this.game.sound as Phaser.Sound.HTML5AudioSoundManager;
            manager.loopEndOffset = 0;
            manager.on('unlocked', this.unlocked);
            this.game.events.on('step', this.step);
        }
        this.desired = key;
        this.reconcile();
    }
    public syncSettings(settings: Readonly<SoundSettings>): void {
        this.enabled = settings.enabled;
        this.master = clamp(settings.masterVolume);
        this.reconcile();
    }
    public setVolume(value: number): void { this.volume = clamp(value); this.reconcile(); }
    public setMuted(muted: boolean): void { this.muted = muted; this.reconcile(); }
    private allowed(): boolean {
        return !this.disposed && this.enabled && !this.muted && this.master > 0 && this.volume > 0
            && this.gestureSeen && this.backgrounds.size === 0;
    }
    public unlockFromUserGesture(): void {
        if (!this.enabled || this.muted || this.master === 0 || this.volume === 0 || this.disposed) return;
        this.gestureSeen = true;
        this.unlockTags();
        this.reconcile();
    }
    private unlockTags(): void {
        if (!this.game || !this.cache) return;
        const tags: HTMLAudioElement[] = [];
        for (const key of Object.keys(BGM_TRACKS) as BgmKey[]) {
            const cached: unknown = this.cache.get(key);
            if (!Array.isArray(cached)) continue;
            for (const tag of cached as HTMLAudioElement[]) {
                if (this.loads.has(tag) || (tag.dataset.locked !== 'true' && !this.failed.has(key))) continue;
                this.failed.delete(key);
                const ready = () => finish(false), error = () => finish(true);
                const cleanup = () => { tag.removeEventListener('canplaythrough', ready); tag.removeEventListener('error', error); };
                const finish = (failed: boolean) => {
                    cleanup(); this.loads.delete(tag);
                    tag.dataset.locked = 'false';
                    if (failed) { this.failed.add(key); this.errors++; }
                    if (!this.loads.size && this.game) {
                        this.game.sound.unlock();
                        this.game.sound.emit('unlocked', this.game.sound);
                    }
                };
                tag.addEventListener('canplaythrough', ready);
                tag.addEventListener('error', error);
                this.loads.set(tag, cleanup);
                tags.push(tag);
            }
        }
        // Match Phaser's HTML5 loading unlock, with owned listeners and keyboard support.
        for (const tag of tags) { try { tag.load(); } catch { tag.dispatchEvent(new Event('error')); } }
    }
    public suspendForBackground(reason = 'app'): void {
        this.backgrounds.add(reason);
        this.reconcile();
    }
    public resumeAfterForeground(reason = 'app'): void {
        this.backgrounds.delete(reason);
        this.reconcile();
    }
    private release(track?: Track): void {
        if (!track || track.sound.pendingRemove) return;
        try { track.sound.stop(); track.sound.destroy(); } catch { this.errors++; }
    }
    private applyVolume(track?: Track): void {
        if (track) track.sound.setVolume(this.allowed() ? BGM_TRACKS[track.key].volume * this.volume * this.master * track.gain : 0);
    }
    private reconcile(): void {
        if (this.disposed || !this.game) return;
        try {
            if (!this.allowed()) {
                this.release(this.retiring);
                this.retiring = undefined;
                this.elapsed = BGM_FADE_MS;
                if (this.current?.key !== this.desired) { this.release(this.current); this.current = undefined; }
                if (this.current) {
                    this.current.gain = 1;
                    this.applyVolume(this.current);
                    this.current.sound.pause();
                }
                return;
            }
            if (this.game.sound.locked || !this.desired) return;
            if (this.current?.key === this.desired) {
                // A rejected HTMLMediaElement.play() can leave Phaser's isPlaying flag set.
                if (this.current.sound.isPlaying && this.current.sound.audio?.paused) this.current.sound.pause();
                if (this.current.sound.isPaused) {
                    if (!this.current.sound.resume()) return;
                    this.useNativeLoop(this.current);
                }
                this.applyVolume(this.current);
                this.applyVolume(this.retiring);
                return;
            }
            if (!this.cache?.exists(this.desired) || this.failed.has(this.desired)) return;
            // Cancel the oldest tail before starting a third track. At most two sounds exist.
            this.release(this.retiring);
            this.retiring = undefined;
            const sound = this.game.sound.add(this.desired, { loop: true, volume: 0 }) as MusicSound;
            const next: Track = { key: this.desired, sound, gain: 0, from: 0 };
            try {
                if (!sound.play()) { this.release(next); return; }
                this.useNativeLoop(next);
            } catch { this.release(next); this.errors++; return; }
            this.retiring = this.current;
            if (this.retiring) this.retiring.from = this.retiring.gain;
            this.current = next;
            this.elapsed = 0;
            this.starts++;
        } catch { this.errors++; }
    }
    private useNativeLoop(track: Track): void {
        // Keep the full musical phrase; native looping avoids Phaser's 50ms early HTML5 seek.
        if (track.sound.audio) track.sound.audio.loop = true;
    }
    private update(delta: number): void {
        if (!this.allowed() || this.elapsed >= BGM_FADE_MS || !Number.isFinite(delta)) return;
        try {
            this.elapsed = Math.min(BGM_FADE_MS, this.elapsed + Math.max(0, delta));
            const p = this.elapsed / BGM_FADE_MS;
            if (this.current) this.current.gain = p;
            if (this.retiring) this.retiring.gain = this.retiring.from * (1 - p);
            this.applyVolume(this.current);
            this.applyVolume(this.retiring);
            if (p === 1) { this.release(this.retiring); this.retiring = undefined; }
        } catch { this.errors++; }
    }
    public stop(): void {
        this.desired = undefined;
        this.release(this.current);
        this.release(this.retiring);
        this.current = this.retiring = undefined;
        this.elapsed = BGM_FADE_MS;
    }
    public getDiagnostics() {
        return {
            desired: this.desired ?? null, current: this.current?.key ?? null,
            retiring: this.retiring?.key ?? null, playing: this.current?.sound.isPlaying ?? false,
            paused: this.current?.sound.isPaused ?? false, volume: this.current?.sound.volume ?? 0,
            activeTracks: Number(!!this.current) + Number(!!this.retiring), starts: this.starts,
            errors: this.errors, background: this.backgrounds.size > 0, gestureSeen: this.gestureSeen, disposed: this.disposed
        };
    }
    public dispose(): void {
        if (this.disposed) return;
        this.stop();
        this.game?.events.off('step', this.step);
        this.game?.sound.off('unlocked', this.unlocked);
        for (const cleanup of this.loads.values()) cleanup();
        this.loads.clear();
        this.failed.clear();
        this.game = undefined;
        this.cache = undefined;
        this.backgrounds.clear();
        this.disposed = true;
    }
}
export const bgmManager = new BgmManager();
