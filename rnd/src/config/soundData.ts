export type SoundGroup = 'sfx' | 'ui';
import { BOSS_SOUNDS } from './bossSoundData';
import type { BossSoundId, BossSoundBus } from './bossSoundData';
import type {DroneArchetype,EnemyArchetype} from '../types/game';
export type CombatSoundId = 'attack_sword_light'|'attack_sword_heavy'|'attack_arrow'|'attack_gun_burst'|'attack_fire_magic'|'attack_ice_magic'|'attack_lightning'|'hit_flesh_light'|'hit_armor'|'hit_critical'|'hit_shield_block'|'death_enemy_small'|'death_enemy_medium'|'death_enemy_elite'|'death_enemy_magic';
export type SoundId = 'shoot' | 'hit' | 'explosion' | 'powerup' | CombatSoundId | BossSoundId;
export interface SoundDefinition {
    group: SoundGroup;
    intervalMs: number;
    maxVoices: number;
    priority: number;
    wave: OscillatorType;
    startHz: number;
    endHz: number;
    sweepMs: number;
    envelopeMs: number;
    stopMs: number;
    gain: number;
    sampleGain?: number;
    category?: 'attack'|'impact'|'death';
    bossBus?: BossSoundBus;
    loop?: boolean;
}
const sample=(category:'attack'|'impact'|'death',sampleGain:number,priority=1):SoundDefinition=>({group:'sfx',category,sampleGain,priority,intervalMs:category==='attack'?40:category==='impact'?60:80,maxVoices:category==='death'?2:4,wave:'triangle',startHz:category==='attack'?620:180,endHz:80,sweepMs:60,envelopeMs:80,stopMs:90,gain:.04});
export const COMBAT_SOUNDS:Readonly<Record<CombatSoundId,SoundDefinition>>={
 attack_sword_light:sample('attack',.20),attack_sword_heavy:sample('attack',.28),attack_arrow:sample('attack',.20),attack_gun_burst:sample('attack',.18),attack_fire_magic:sample('attack',.25),attack_ice_magic:sample('attack',.22),attack_lightning:sample('attack',.22),
 hit_flesh_light:sample('impact',.19,2),hit_armor:sample('impact',.22,2),hit_critical:sample('impact',.38,3),hit_shield_block:sample('impact',.22,2),
 death_enemy_small:sample('death',.17,2),death_enemy_medium:sample('death',.21,2),death_enemy_elite:sample('death',.48,3),death_enemy_magic:sample('death',.25,2)
};
export const COMBAT_SOUND_IDS=Object.keys(COMBAT_SOUNDS) as CombatSoundId[];
export const ATTACK_SOUNDS:Record<DroneArchetype,CombatSoundId>={
 BASIC_LASER:'attack_arrow',GATLING_BOT:'attack_gun_burst',ROCKET_BOT:'attack_fire_magic',STUN_BOT:'attack_ice_magic',PIERCE_BEAM:'attack_arrow',BLACKHOLE_MISSILE:'attack_fire_magic',CHAIN_LIGHTNING:'attack_lightning',
 STONE_GUARD:'attack_sword_heavy',HERBAL_PRIEST:'attack_arrow',SPARK_SPIRIT:'attack_lightning',SHADOW_DAGGER:'attack_sword_light',LAVA_GOLEM:'attack_fire_magic',THORN_GUARD:'attack_sword_heavy',STORM_ARCHER:'attack_arrow',MOON_PRIEST:'attack_ice_magic',PALADIN:'attack_sword_heavy',THUNDER_MAGE:'attack_lightning',SHADOW_ASSASSIN:'attack_sword_light',WORLD_DRUID:'attack_ice_magic',PHOENIX_LORD:'attack_fire_magic',STORM_GENERAL:'attack_lightning',EARTH_DEITY:'attack_sword_heavy'
};
export function enemyDeathSound(id:EnemyArchetype):CombatSoundId {
 if(id==='BOSS_CORE'||id.startsWith('ELITE_'))return 'death_enemy_elite';
 if(id==='SPORE_SHOOTER'||id==='SUMMONER')return 'death_enemy_magic';
 return id==='SWARMER'?'death_enemy_small':'death_enemy_medium';
}
export const MAX_SOUND_VOICES = 8;
export const SOUND_DEFINITIONS: Readonly<Record<SoundId, Readonly<SoundDefinition>>> = {
    ...COMBAT_SOUNDS,
    ...BOSS_SOUNDS,
    shoot: { group: 'sfx', intervalMs: 40, maxVoices: 4, priority: 1, wave: 'triangle', startHz: 620, endHz: 180, sweepMs: 70, envelopeMs: 70, stopMs: 75, gain: .05 },
    hit: { group: 'sfx', intervalMs: 60, maxVoices: 3, priority: 1, wave: 'square', startHz: 220, endHz: 80, sweepMs: 50, envelopeMs: 50, stopMs: 55, gain: .04 },
    explosion: { group: 'sfx', intervalMs: 100, maxVoices: 3, priority: 2, wave: 'sawtooth', startHz: 140, endHz: 35, sweepMs: 180, envelopeMs: 180, stopMs: 190, gain: .09 },
    powerup: { group: 'ui', intervalMs: 120, maxVoices: 2, priority: 3, wave: 'sine', startHz: 380, endHz: 880, sweepMs: 220, envelopeMs: 230, stopMs: 240, gain: .08 }
};
