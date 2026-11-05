import { UNIQUE_SKILLS } from '../config/skillData';
import type { DroneArchetype } from '../types/game';

interface StatusSource {
  archetype: DroneArchetype;
  lastSkillAt: number;
  reviveAt: number;
  health: { isDead: boolean; shieldHp: number; shieldUntil: number };
}

export interface CombatHudStatus {
  kind: 'none' | 'revive' | 'cooldown' | 'ready' | 'waiting';
  seconds: number;
  progress: number;
  skillName: string;
  shieldHp: number;
  shieldSeconds: number;
}

export const createCombatHudStatus = (): CombatHudStatus => ({
  kind: 'none', seconds: 0, progress: 0, skillName: '', shieldHp: 0, shieldSeconds: 0
});

/** Read existing combat deadlines into a reused slot; no timers or gameplay mutations. */
export function readCombatHudStatus(unit: StatusSource, time: number, combatActive: boolean, out: CombatHudStatus): void {
  const cooldown = unit.archetype === 'PHOENIX_LORD' ? UNIQUE_SKILLS.phoenix.cooldownMs
    : unit.archetype === 'EARTH_DEITY' ? UNIQUE_SKILLS.deity.cooldownMs : 0;
  out.skillName = unit.archetype === 'PHOENIX_LORD' ? '불사조 재림'
    : unit.archetype === 'EARTH_DEITY' ? '대지 방벽' : '';
  out.kind = 'none'; out.seconds = 0; out.progress = 0;
  out.shieldHp = !unit.health.isDead && time < unit.health.shieldUntil ? unit.health.shieldHp : 0;
  out.shieldSeconds = out.shieldHp > 0 ? Math.ceil((unit.health.shieldUntil - time) / 1000) : 0;
  if (unit.health.isDead) {
    out.kind = 'revive';
    out.seconds = Math.ceil(Math.max(0, unit.reviveAt - time) / 1000);
  } else if (cooldown > 0) {
    const remaining = Math.max(0, unit.lastSkillAt + cooldown - time);
    out.seconds = Math.ceil(remaining / 1000);
    out.progress = Math.max(0, Math.min(1, 1 - remaining / cooldown));
    out.kind = !combatActive ? 'waiting' : remaining > 0 ? 'cooldown' : 'ready';
  }
}
