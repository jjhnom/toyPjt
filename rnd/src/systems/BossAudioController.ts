import type { HazardView, HazardVisualSink } from '../entities/EncounterHazards';
import { bossSkillSound } from '../config/bossSoundData';
import type { BossSkillSound } from '../config/bossSoundData';
import type { SoundManager } from './SoundManager';

interface PatternAudio {
    life: number;
    pattern: number;
    skill: BossSkillSound;
    activated: boolean;
    falling: boolean;
}
interface SlotAudio { group: PatternAudio; active: boolean }

/** Observes hazard time only; audio failure or suppression never changes combat. */
export class BossAudioController implements HazardVisualSink {
    private readonly slots = new Map<number, SlotAudio>();
    private life = 0;
    private phase = 1;
    constructor(private readonly sound: SoundManager) {}

    public encounterStarted(life: number): void {
        if (this.life === life) return;
        this.life = life;
        this.phase = 1;
        this.sound.playBoss('boss_encounter_start');
    }
    public phaseChanged(life: number, phase: number): void {
        if (this.life !== life) { this.life = life; this.phase = 1; }
        if (phase <= this.phase) return;
        this.phase = phase;
        this.sound.playBoss('boss_phase_change');
    }
    public start(index: number, state: HazardView): void {
        this.end(index);
        if (!state.bossId || state.kind === 'SHOT' || state.kind === 'EXPLODE') return;
        const skill = bossSkillSound(state.bossId, state.kind);
        if (!skill) return;
        let group: PatternAudio | undefined;
        for (const slot of this.slots.values()) {
            if (slot.group.life === state.sourceLife && slot.group.pattern === state.patternId) {
                group = slot.group;
                break;
            }
        }
        if (!group) {
            group = { life: state.sourceLife, pattern: state.patternId, skill, activated: false, falling: false };
            this.sound.playBoss('boss_attack_warning');
        }
        this.slots.set(index, { group, active: false });
    }
    public draw(index: number, state: HazardView, impact: boolean): void {
        const slot = this.slots.get(index);
        if (!slot) return;
        const group = slot.group, after = state.age - state.warningMs;
        // Both meteor renderers begin their visible fall 150ms before the damage deadline.
        if (group.skill.fall && !group.falling && after >= -150 && after < 0) {
            group.falling = true;
            this.sound.playBoss(group.skill.fall);
        }
        if (impact && !group.activated) {
            group.activated = true;
            if (group.skill.fall) this.sound.stopBossSound(group.skill.fall);
            this.sound.playBoss(group.skill.cast);
        }
        slot.active = after >= 0 && after < state.duration;
        // Idempotent: retries only a still-live field after mute/background/decode recovery.
        if (slot.active && group.skill.loop) this.sound.startBossLoop(group.skill.loop);
    }
    public end(index: number): void {
        const slot = this.slots.get(index);
        if (!slot) return;
        this.slots.delete(index);
        const loop = slot.group.skill.loop;
        if (!loop) return;
        for (const other of this.slots.values()) if (other.active && other.group.skill.loop === loop) return;
        this.sound.stopBossLoop(loop);
    }
    public pause(): void { this.sound.stopAllBossAudio(150, true); }
    public clear(): void {
        this.slots.clear();
        this.life = 0;
        this.phase = 1;
        this.sound.stopAllBossAudio(150, true);
    }
}
