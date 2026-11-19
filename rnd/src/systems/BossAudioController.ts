import type { HazardView, HazardVisualSink } from '../entities/EncounterHazards';
import { BOSS_SOUNDS, bossSkillSound } from '../config/bossSoundData';
import type { BossSkillSound } from '../config/bossSoundData';
import type { SoundManager } from './SoundManager';

interface PatternAudio {
    life: number;
    pattern: number;
    skill: BossSkillSound;
    activated: boolean;
    falling: boolean;
    lastWarningMs: number;
}
interface SlotAudio { group: PatternAudio; active: boolean; impacted: boolean; warningMs: number }

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
            group = { life: state.sourceLife, pattern: state.patternId, skill, activated: false, falling: false, lastWarningMs: state.warningMs };
            this.sound.playBoss('boss_attack_warning');
        }
        group.lastWarningMs = Math.max(group.lastWarningMs, state.warningMs);
        this.slots.set(index, { group, active: false, impacted: false, warningMs: state.warningMs });
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
        if (impact && group.skill.repeatedImpact && !slot.impacted) {
            slot.impacted = true;
            // Coalesce stale sounds, including a late hit that would suppress an imminent hit's cooldown.
            let newerDue = false;
            for (const other of this.slots.values()) {
                if (other.group === group && other.warningMs > slot.warningMs && other.warningMs <= state.age + BOSS_SOUNDS[group.skill.cast].intervalMs) {
                    newerDue = true;
                    break;
                }
            }
            if (!newerDue) this.sound.playBoss(group.skill.cast, {
                gainScale: slot.warningMs === group.lastWarningMs ? group.skill.repeatedImpact.finalGainScale : group.skill.repeatedImpact.gainScale,
                restart: true
            });
        } else if (impact && !group.skill.repeatedImpact && !group.activated) {
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
