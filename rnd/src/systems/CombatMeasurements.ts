import type { DroneArchetype, RelicId } from '../types/game';
type HealingSource = DroneArchetype | RelicId | 'COMMAND_HEAL';

export type DamageObserver = (requested: number, effective: number, shield: number, killed: boolean) => void;
const damageTotals = () => ({ hits: 0, requested: 0, effective: 0, shield: 0, overkill: 0, deaths: 0 });
type DamageTotals = ReturnType<typeof damageTotals>;

/** Opt-in aggregate diagnostics. No per-hit history or persistent storage. */
export class CombatMeasurements {
  private elapsedMs = 0;
  private combatMs = 0;
  private leader = damageTotals();
  private allies = damageTotals();
  private enemies = damageTotals();
  private healing = new Map<string, { source: HealingSource; target: 'leader' | 'unit';
    attempts: number; requested: number; effective: number; overheal: number; skippedDead: number }>();
  private revivals = { automatic: 0, room: 0, phoenix: 0, service: 0 };
  private projectiles = { fired: 0, contacts: 0, poolFailures: 0 };
  private leaderDiedAtMs: number | null = null;

  public readonly leaderDamage: DamageObserver = (requested, effective, shield, killed) => {
    this.recordDamage(this.leader, requested, effective, shield, killed);
    if (killed && this.leaderDiedAtMs === null) this.leaderDiedAtMs = this.elapsedMs;
  };
  public readonly allyDamage: DamageObserver = (requested, effective, shield, killed) =>
    this.recordDamage(this.allies, requested, effective, shield, killed);
  public readonly enemyDamage: DamageObserver = (requested, effective, shield, killed) =>
    this.recordDamage(this.enemies, requested, effective, shield, killed);

  private recordDamage(total: DamageTotals, requested: number, effective: number, shield: number, killed: boolean): void {
    total.hits++; total.requested += requested; total.effective += effective;
    total.shield += shield; total.overkill += Math.max(0, requested - effective - shield);
    if (killed) total.deaths++;
  }

  public advance(delta: number, combat = true): void {
    this.elapsedMs += Math.max(0, delta);
    if (combat) this.combatMs += Math.max(0, delta);
  }
  public recordShot(success: boolean): void { if (success) this.projectiles.fired++; else this.projectiles.poolFailures++; }
  public recordContact(): void { this.projectiles.contacts++; }
  public recordRevival(kind: keyof CombatMeasurements['revivals']): void { this.revivals[kind]++; }

  public recordHealing(source: HealingSource, target: 'leader' | 'unit', requested: number, effective: number, dead: boolean): void {
    const key = `${source}:${target}`;
    const total = this.healing.get(key) ?? { source, target, attempts: 0, requested: 0, effective: 0, overheal: 0, skippedDead: 0 };
    if (dead) total.skippedDead++;
    else { total.attempts++; total.requested += requested; total.effective += effective; total.overheal += requested - effective; }
    this.healing.set(key, total);
  }

  public report() {
    return { scope: 'measurement-window', elapsedMs: this.elapsedMs, combatMs: this.combatMs, leaderDiedAtMs: this.leaderDiedAtMs,
      leader: { ...this.leader }, allies: { ...this.allies }, enemies: { ...this.enemies },
      enemyEffectiveDps: this.combatMs > 0 ? this.enemies.effective * 1000 / this.combatMs : 0,
      healing: [...this.healing.values()].map(row => ({ ...row })), revivals: { ...this.revivals },
      projectiles: { ...this.projectiles },
      caveat: 'Accepted damage only. Contacts may exceed fired projectiles with piercing. No damage-source attribution.' };
  }
}
