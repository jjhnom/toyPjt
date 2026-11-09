import type { DroneInstanceData } from '../types/game';

export type EconomyReason = 'kill' | 'room' | 'boss' | 'circle' | 'sell'
  | 'summon' | 'combine' | 'promotion' | 'quickCraft' | 'upgrade' | 'relic' | 'awakening' | 'service' | 'supply' | 'deployment' | 'stageStart' | 'stageEnd';
export interface EconomyState {
  stageIndex: number;
  minerals: number;
  freeSummons: number;
  units: DroneInstanceData[];
}
export interface EconomyEntry {
  sequence: number;
  stageIndex: number;
  roomId: string | null;
  reason: EconomyReason;
  detail: string;
  minerals: number;
  vouchers: number;
  balance: number;
  voucherBalance: number;
  owned: number;
  deployed: number;
  composition?: Pick<DroneInstanceData, 'archetype' | 'star' | 'deployed'>[];
}

/** Session-only diagnostics. Bounded history; totals survive history truncation. */
export class EconomyLedger {
  private entries: EconomyEntry[] = [];
  private sequence = 0;
  private totals = new Map<number, { income: number; spent: number; vouchersGranted: number;
    vouchersUsed: number; byReason: Partial<Record<EconomyReason, number>> }>();
  public roomId: string | null = null;
  private baseline = { minerals: 0, vouchers: 0 };

  public reset(state: EconomyState): void {
    this.entries = []; this.sequence = 0; this.totals.clear(); this.roomId = null;
    this.baseline = { minerals: state.minerals, vouchers: state.freeSummons };
  }

  public record(state: EconomyState, reason: EconomyReason, minerals = 0, vouchers = 0, detail = ''): void {
    const total = this.totals.get(state.stageIndex) ?? {
      income: 0, spent: 0, vouchersGranted: 0, vouchersUsed: 0, byReason: {}
    };
    total.income += Math.max(0, minerals); total.spent += Math.max(0, -minerals);
    total.vouchersGranted += Math.max(0, vouchers); total.vouchersUsed += Math.max(0, -vouchers);
    total.byReason[reason] = (total.byReason[reason] ?? 0) + minerals;
    this.totals.set(state.stageIndex, total);
    this.entries.push({ sequence: ++this.sequence, stageIndex: state.stageIndex, roomId: this.roomId,
      reason, detail, minerals, vouchers, balance: state.minerals, voucherBalance: state.freeSummons,
      owned: state.units.length, deployed: state.units.filter(unit => unit.deployed).length,
      ...(reason === 'stageStart' || reason === 'stageEnd' ? {
        composition: state.units.map(({ archetype, star, deployed }) => ({ archetype, star, deployed }))
      } : {}) });
    if (this.entries.length > 512) this.entries.shift();
  }

  public report() {
    return { scope: 'current-session-since-new-run-or-restore', baseline: { ...this.baseline },
      eventsRecorded: this.sequence, historyTruncated: this.sequence > this.entries.length,
      stages: [...this.totals].map(([stageIndex, total]) => ({ stageIndex, ...total, byReason: { ...total.byReason } })),
      entries: this.entries.map(entry => ({ ...entry,
        ...(entry.composition ? { composition: entry.composition.map(unit => ({ ...unit })) } : {}) })) };
  }
}
