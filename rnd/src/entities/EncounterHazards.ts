import Phaser from 'phaser';
import type { BossId,BossPattern } from '../types/game';
import {BOSS_VISUALS} from '../config/bossVisualData';

export type HazardKind = BossPattern | 'SHOT' | 'EXPLODE';
interface Hazard {
  active: boolean; kind: HazardKind; x: number; y: number; radius: number;
  damage: number; sourceLife: number; age: number; duration: number; resolved: boolean;
  warningMs: number; fromX: number | null; fromY: number | null;
  bossId: BossId | null;
  patternId: number;
}
export type HazardView=Readonly<Hazard>;
export interface HazardVisualSink {
  start(index:number,state:HazardView):void;
  draw(index:number,state:HazardView,impact:boolean):void;
  end(index:number,state:HazardView):void;
  clear():void;
}

/** Shared fixed-size telegraphs for enemy and boss attacks. */
export class EncounterHazards {
  private readonly slots: Hazard[] = Array.from({ length: 32 }, () => ({
    active: false, kind: 'METEOR', x: 0, y: 0, radius: 0, damage: 0, sourceLife: 0,
    age: 0, duration: 0, resolved: false, warningMs: 800, fromX: null, fromY: null,bossId:null,patternId:0
  }));
  private readonly graphics: Phaser.GameObjects.Graphics;
  private visualFailed=false;
  constructor(scene: Phaser.Scene,
    private readonly resolve: (kind: HazardKind, x: number, y: number, radius: number, damage: number, sourceLife: number) => void,
    private readonly visuals?:HazardVisualSink,
    private readonly audio?:HazardVisualSink) {
    this.graphics = scene.add.graphics().setDepth(38);
  }

  public add(kind: HazardKind, x: number, y: number, damage: number, sourceLife: number,
    options: {radius?:number;warningMs?:number;durationMs?:number;fromX?:number;fromY?:number;bossId?:BossId;patternId?:number} = {}): boolean {
    const slot = this.slots.find(item => !item.active);
    if (!slot) return false;
    Object.assign(slot, { active: true, kind, x, y, damage, sourceLife, age: 0, resolved: false,
      radius: options.radius ?? (kind === 'METEOR' ? 105 : kind === 'SHOT' ? 48 : kind === 'CHARGE' ? 70 : 90),
      duration: options.durationMs ?? (kind === 'POISON' || kind === 'FROST' ? 3000 : 250),
      warningMs: options.warningMs ?? 800, fromX: options.fromX ?? null, fromY: options.fromY ?? null,bossId:options.bossId??null,patternId:options.patternId??0 });
    this.paint('start',this.slots.indexOf(slot),slot);
    return true;
  }

  public clear(): void {
    for (const slot of this.slots) slot.active = false;
    this.graphics.clear();
    try{this.audio?.clear();}catch{/* Audio cleanup cannot block encounter cleanup. */}
    try{this.visuals?.clear();}catch{this.visualFailed=true;}
  }

  private paint(event:'start'|'draw'|'end',index:number,state:HazardView,impact=false):void {
    // Independent observers: missing artwork must not disable sound or damage.
    try {
      if(event==='start')this.audio?.start(index,state);
      else if(event==='end')this.audio?.end(index,state);
      else this.audio?.draw(index,state,impact);
    } catch { /* Audio is optional and never owns a combat transition. */ }
    if(!this.visuals||this.visualFailed)return;
    try{
      if(event==='start')this.visuals.start(index,state);
      else if(event==='end')this.visuals.end(index,state);
      else this.visuals.draw(index,state,impact);
    }catch{
      // Cosmetic failures cannot suppress or delay the existing damage callback.
      this.visualFailed=true;try{this.visuals.clear();}catch{/* Already disabled. */}
    }
  }

  public update(delta: number): void {
    this.graphics.clear();
    for (let index=0;index<this.slots.length;index++) {
      const slot=this.slots[index];
      if (!slot.active) continue;
      slot.age += delta;
      const warning = slot.age < slot.warningMs;
      const color = slot.bossId&&warning?(slot.bossId==='twilight_king'&&slot.kind==='CHARGE'?0xef65d6:0xff4e68)
        :slot.bossId==='desert_emperor'?BOSS_VISUALS.desert_emperor.accent
        :slot.kind==='METEOR'&&(slot.bossId==='forest_guardian'||slot.bossId==='twilight_king')?BOSS_VISUALS[slot.bossId].accent
        :slot.bossId==='twilight_king'&&slot.kind==='FROST'?BOSS_VISUALS.twilight_king.accent
        :slot.kind === 'FROST' ? 0x9bddff : slot.kind === 'POISON' ? 0xb9d36e : 0xf17b53;
      if (slot.fromX !== null && slot.fromY !== null) {
        const angle=Math.atan2(slot.y-slot.fromY,slot.x-slot.fromX),nx=-Math.sin(angle)*slot.radius,ny=Math.cos(angle)*slot.radius;
        this.graphics.lineStyle(slot.radius*2,color,0.14).lineBetween(slot.fromX,slot.fromY,slot.x,slot.y);
        this.graphics.lineStyle(3,color,0.9).lineBetween(slot.fromX+nx,slot.fromY+ny,slot.x+nx,slot.y+ny)
          .lineBetween(slot.fromX-nx,slot.fromY-ny,slot.x-nx,slot.y-ny).lineBetween(slot.fromX,slot.fromY,slot.x,slot.y);
      } else {
        const poison=!!slot.bossId&&slot.kind==='POISON',binding=slot.bossId==='twilight_king'&&slot.kind==='FROST';
        if(!warning&&(poison||binding)){
          const segments=poison?8:12;this.graphics.lineStyle(poison?1.2:1.5,color,poison?.45:.6);
          for(let n=0;n<segments;n++){const a=n*Math.PI*2/segments;this.graphics.beginPath().arc(slot.x,slot.y,slot.radius,a,a+Math.PI*2/segments*.52).strokePath();}
        }else this.graphics.lineStyle(warning ? 3 : 2, color, 0.9).strokeCircle(slot.x, slot.y, slot.radius);
        this.graphics.fillStyle(color, warning ? 0.12 : poison?0.025:slot.bossId?0.08:0.35).fillCircle(slot.x, slot.y, slot.radius);
      }
      this.paint('draw',index,slot,!warning&&!slot.resolved);
      if (warning) {
        this.graphics.lineStyle(2, color, 0.8).strokeCircle(slot.x, slot.y, slot.radius * slot.age / slot.warningMs);
      } else {
        if (!slot.resolved || slot.kind === 'POISON' || slot.kind === 'FROST') {
          slot.resolved = true;
          this.resolve(slot.kind, slot.x, slot.y, slot.radius, slot.damage, slot.sourceLife);
        }
        if (slot.kind === 'CHARGE' || slot.kind === 'SUMMON' || slot.age >= slot.warningMs + slot.duration){slot.active = false;this.paint('end',index,slot);}
      }
    }
  }
}
