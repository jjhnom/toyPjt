import { HERO, heroXpToNext } from '../config/heroData';
import type { DamageSourceKind, HeroSnapshot, TalentId, HeroClassId } from '../types/game';
import { HERO_CLASSES, isHeroClassId, emptyPermanentRanks, isPermanentRanks } from '../config/heroClassData';
import { activeCooldown, isTalentId } from '../config/heroAbilities';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function isHeroSnapshot(value: unknown): value is HeroSnapshot {
  if (!record(value) || !isHeroClassId(value.classId) || !integer(value.level) || value.level < 1 ||
      value.level > HERO.maxLevel || !integer(value.xp) || !record(value.kills) ||
      !integer(value.kills.hero) || !integer(value.kills.unit) || !integer(value.kills.environment) ||
      !Number.isSafeInteger(value.kills.hero + value.kills.unit + value.kills.environment) ||
      typeof value.attackRemainingMs !== 'number' || !Number.isFinite(value.attackRemainingMs) ||
      value.attackRemainingMs < 0 || value.attackRemainingMs > HERO_CLASSES[value.classId].fireRateMs ||
      (value.permanent!==undefined&&!isPermanentRanks(value.permanent))) return false;
  if (value.talents !== undefined && (!Array.isArray(value.talents) ||
      value.talents.length > Math.floor(value.level / 3) || !value.talents.every(isTalentId))) return false;
  if (value.activeRemainingMs !== undefined && (typeof value.activeRemainingMs !== 'number' ||
      !Number.isFinite(value.activeRemainingMs) || value.activeRemainingMs < 0 ||
      value.activeRemainingMs > activeCooldown((value.talents ?? []) as TalentId[]))) return false;
  return value.level === HERO.maxLevel ? value.xp === 0 : value.xp < heroXpToNext(value.level);
}

export class HeroProgression {
  public classId:HeroClassId='APPRENTICE_SUMMONER';
  public permanent=emptyPermanentRanks();
  public level = 1;
  public xp = 0;
  public talents: TalentId[] = [];
  private kills = { hero: 0, unit: 0, environment: 0 };

  public gainExperience(amount: number): number {
    if (!integer(amount) || amount === 0 || this.level >= HERO.maxLevel) return 0;
    const previous = this.level;
    let available = Math.min(Number.MAX_SAFE_INTEGER, this.xp + amount);
    while (this.level < HERO.maxLevel && available >= heroXpToNext(this.level)) {
      available -= heroXpToNext(this.level); this.level++;
    }
    this.xp = this.level >= HERO.maxLevel ? 0 : available;
    return this.level - previous;
  }

  public recordKill(kind: DamageSourceKind, xp: number): number {
    if (!Object.prototype.hasOwnProperty.call(this.kills, kind) || !integer(xp)) return 0;
    this.kills[kind]++;
    return this.gainExperience(xp);
  }

  public pendingTalents(): number { return Math.floor(this.level / 3) - this.talents.length; }

  public chooseTalent(id: TalentId, expectedCount: number): boolean {
    if (!isTalentId(id) || expectedCount !== this.talents.length || this.pendingTalents() <= 0) return false;
    this.talents.push(id); return true;
  }

  public snapshot(attackRemainingMs = 0, activeRemainingMs = 0): HeroSnapshot {
    return { classId: this.classId, level: this.level, xp: this.xp, kills: { ...this.kills }, attackRemainingMs,
      talents: [...this.talents], activeRemainingMs, permanent:{...this.permanent} };
  }

  public restore(value: unknown): boolean {
    if (!isHeroSnapshot(value)) return false;
    this.level = value.level; this.xp = value.xp; this.kills = { ...value.kills };
    this.classId=value.classId;this.permanent=value.permanent?{...value.permanent}:emptyPermanentRanks();
    this.talents = [...(value.talents ?? [])];
    return true;
  }
}
