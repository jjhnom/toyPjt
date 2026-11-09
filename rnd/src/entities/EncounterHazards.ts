import Phaser from 'phaser';
import type { BossPattern } from '../types/game';

export type HazardKind = BossPattern | 'SHOT' | 'EXPLODE';
interface Hazard {
  active: boolean; kind: HazardKind; x: number; y: number; radius: number;
  damage: number; sourceLife: number; age: number; duration: number; resolved: boolean;
  warningMs: number; fromX: number | null; fromY: number | null;
}

/** Shared fixed-size telegraphs for enemy and boss attacks. */
export class EncounterHazards {
  private readonly slots: Hazard[] = Array.from({ length: 32 }, () => ({
    active: false, kind: 'METEOR', x: 0, y: 0, radius: 0, damage: 0, sourceLife: 0,
    age: 0, duration: 0, resolved: false, warningMs: 800, fromX: null, fromY: null
  }));
  private readonly graphics: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene,
    private readonly resolve: (kind: HazardKind, x: number, y: number, radius: number, damage: number, sourceLife: number) => void) {
    this.graphics = scene.add.graphics().setDepth(18);
  }

  public add(kind: HazardKind, x: number, y: number, damage: number, sourceLife: number,
    options: {radius?:number;warningMs?:number;durationMs?:number;fromX?:number;fromY?:number} = {}): boolean {
    const slot = this.slots.find(item => !item.active);
    if (!slot) return false;
    Object.assign(slot, { active: true, kind, x, y, damage, sourceLife, age: 0, resolved: false,
      radius: options.radius ?? (kind === 'METEOR' ? 105 : kind === 'SHOT' ? 48 : kind === 'CHARGE' ? 70 : 90),
      duration: options.durationMs ?? (kind === 'POISON' || kind === 'FROST' ? 3000 : 250),
      warningMs: options.warningMs ?? 800, fromX: options.fromX ?? null, fromY: options.fromY ?? null });
    return true;
  }

  public clear(): void {
    for (const slot of this.slots) slot.active = false;
    this.graphics.clear();
  }

  public update(delta: number): void {
    this.graphics.clear();
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += delta;
      const warning = slot.age < slot.warningMs;
      const color = slot.kind === 'FROST' ? 0x9bddff : slot.kind === 'POISON' ? 0xb9d36e : 0xf17b53;
      if (slot.fromX !== null && slot.fromY !== null) {
        const angle=Math.atan2(slot.y-slot.fromY,slot.x-slot.fromX),nx=-Math.sin(angle)*slot.radius,ny=Math.cos(angle)*slot.radius;
        this.graphics.lineStyle(slot.radius*2,color,0.14).lineBetween(slot.fromX,slot.fromY,slot.x,slot.y);
        this.graphics.lineStyle(3,color,0.9).lineBetween(slot.fromX+nx,slot.fromY+ny,slot.x+nx,slot.y+ny)
          .lineBetween(slot.fromX-nx,slot.fromY-ny,slot.x-nx,slot.y-ny).lineBetween(slot.fromX,slot.fromY,slot.x,slot.y);
      } else {
        this.graphics.lineStyle(warning ? 3 : 2, color, 0.9).strokeCircle(slot.x, slot.y, slot.radius);
        this.graphics.fillStyle(color, warning ? 0.12 : 0.35).fillCircle(slot.x, slot.y, slot.radius);
      }
      if (warning) {
        this.graphics.lineStyle(2, color, 0.8).strokeCircle(slot.x, slot.y, slot.radius * slot.age / slot.warningMs);
      } else {
        if (!slot.resolved || slot.kind === 'POISON' || slot.kind === 'FROST') {
          slot.resolved = true;
          this.resolve(slot.kind, slot.x, slot.y, slot.radius, slot.damage, slot.sourceLife);
        }
        if (slot.kind === 'CHARGE' || slot.kind === 'SUMMON' || slot.age >= slot.warningMs + slot.duration) slot.active = false;
      }
    }
  }
}
