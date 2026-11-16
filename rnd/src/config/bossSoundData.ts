import type { BossId, BossPattern } from '../types/game';
import type { SoundDefinition } from './soundData';

export const BOSS_SOUND_IDS = [
    'boss_forest_charge', 'boss_forest_slam', 'boss_swamp_poison_cast', 'boss_swamp_charge',
    'boss_lava_meteor', 'boss_frost_eruption', 'boss_frost_summon', 'boss_twilight_meteor',
    'boss_twilight_poison_cast', 'boss_twilight_charge', 'boss_twilight_binding', 'boss_twilight_summon',
    'boss_desert_sandstorm_cast', 'boss_swamp_poison_loop', 'boss_frost_field_loop',
    'boss_twilight_poison_loop', 'boss_twilight_binding_loop', 'boss_desert_sandstorm_loop',
    'boss_encounter_start', 'boss_attack_warning', 'boss_phase_change', 'boss_death',
    'boss_lava_meteor_fall', 'boss_lava_meteor_impact', 'boss_twilight_meteor_fall', 'boss_twilight_meteor_impact'
] as const;
export type BossSoundId = typeof BOSS_SOUND_IDS[number];
export type BossLoopId = Extract<BossSoundId, `${string}_loop`>;
export type BossSoundBus = 'bossCast' | 'bossLoop' | 'bossUI';
const loopGains: Record<BossLoopId, number> = {
    boss_swamp_poison_loop: .13, boss_frost_field_loop: .13, boss_twilight_poison_loop: .12,
    boss_twilight_binding_loop: .12, boss_desert_sandstorm_loop: .15
};
const commonGains: Partial<Record<BossSoundId, number>> = {
    boss_encounter_start: .65, boss_attack_warning: .36, boss_phase_change: .7, boss_death: .8
};
export const BOSS_SOUNDS = Object.fromEntries(BOSS_SOUND_IDS.map(id => {
    const loop = id.endsWith('_loop'), common = commonGains[id] !== undefined;
    return [id, {
        group: 'sfx', intervalMs: loop ? 0 : id === 'boss_attack_warning' ? 250 : 80, maxVoices: 1,
        priority: id === 'boss_death' ? 9 : common ? 8 : loop ? 4 : 6,
        bossBus: loop ? 'bossLoop' : common ? 'bossUI' : 'bossCast', loop,
        sampleGain: loop ? loopGains[id as BossLoopId] : commonGains[id] ?? .65,
        wave: 'triangle', startHz: 140, endHz: 35, sweepMs: 100, envelopeMs: 100, stopMs: 110, gain: 0
    } satisfies SoundDefinition];
})) as Record<BossSoundId, SoundDefinition>;

export interface BossSkillSound { cast: BossSoundId; fall?: BossSoundId; loop?: BossLoopId }
const SKILLS: Record<BossId, Partial<Record<BossPattern, BossSkillSound>>> = {
    forest_guardian: { CHARGE: { cast: 'boss_forest_charge' }, METEOR: { cast: 'boss_forest_slam' }, ROOTS: {cast:'boss_forest_slam'} },
    swamp_lord: {
        SPORES: {cast:'boss_swamp_poison_cast'},
        CHARGE: { cast: 'boss_swamp_charge' },
        POISON: { cast: 'boss_swamp_poison_cast', loop: 'boss_swamp_poison_loop' }
    },
    lava_colossus: { METEOR: { fall: 'boss_lava_meteor_fall', cast: 'boss_lava_meteor_impact' }, FISSURE: {cast:'boss_lava_meteor_impact'} },
    frost_queen: {
        METEOR: { cast: 'boss_frost_eruption' },
        FROST: { cast: 'boss_frost_eruption', loop: 'boss_frost_field_loop' },
        SUMMON: { cast: 'boss_frost_summon' }
    },
    twilight_king: {
        SLASH: {cast:'boss_twilight_charge'},
        METEOR: { fall: 'boss_twilight_meteor_fall', cast: 'boss_twilight_meteor_impact' },
        POISON: { cast: 'boss_twilight_poison_cast', loop: 'boss_twilight_poison_loop' },
        CHARGE: { cast: 'boss_twilight_charge' },
        FROST: { cast: 'boss_twilight_binding', loop: 'boss_twilight_binding_loop' },
        SUMMON: { cast: 'boss_twilight_summon' }
    },
    desert_emperor: { POISON: { cast: 'boss_desert_sandstorm_cast', loop: 'boss_desert_sandstorm_loop' }, SPIKES: {cast:'boss_desert_sandstorm_cast'} }
};
export function bossSkillSound(id: BossId, kind: BossPattern): BossSkillSound | undefined {
    return SKILLS[id]?.[kind];
}
