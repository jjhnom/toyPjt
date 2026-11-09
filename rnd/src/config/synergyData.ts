import type { DroneInstanceData, SynergyId } from '../types/game';
import { UNIT_TYPES } from './unitData';

export const SYNERGY_IDS: readonly SynergyId[] = ['FOREST_BOND','RANGED_LINE','VANGUARD_LINE'];
export const SYNERGIES: Record<SynergyId, { name: string; description: string; required: number }> = {
  FOREST_BOND: { name: '숲의 결속', description: '서로 다른 숲 유닛 2종 · 분대 피해 +5%', required: 2 },
  RANGED_LINE: { name: '사격 대형', description: '서로 다른 원거리 유닛 2종 · 분대 공속 +5%', required: 2 },
  VANGUARD_LINE: { name: '수호 전선', description: '서로 다른 전열 유닛 2종 · 본체/동료 방어 +5%', required: 2 }
};
/** Formation, including fallen deployed allies; copies and stars of a type count only once. */
export function resolveSynergies(units: readonly DroneInstanceData[]) {
  const types = [...new Set(units.filter(unit => unit.deployed).map(unit => unit.archetype))].map(id => UNIT_TYPES[id]);
  const counts: Record<SynergyId, number> = {
    FOREST_BOND: types.filter(type => type.elements.includes('FOREST')).length,
    RANGED_LINE: types.filter(type => type.role === 'RANGED').length,
    VANGUARD_LINE: types.filter(type => type.role === 'VANGUARD').length
  };
  return { counts, attack: counts.FOREST_BOND >= 2 ? 0.05 : 0,
    speed: counts.RANGED_LINE >= 2 ? 0.05 : 0, defense: counts.VANGUARD_LINE >= 2 ? 0.05 : 0 };
}
