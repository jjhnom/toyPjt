import Phaser from 'phaser';
import type { BossId,BossPattern } from '../types/game';
import {BOSS_VISUALS} from '../config/bossVisualData';
import {ARENA_BOUNDS} from '../config/gameData';
import {DESERT_STORM_CHASE_SPEED} from '../config/bossData';

export type HazardKind = BossPattern | 'SHOT' | 'EXPLODE';
interface Hazard {
  active: boolean; kind: HazardKind; x: number; y: number; radius: number;
  damage: number; sourceLife: number; age: number; duration: number; resolved: boolean;
  warningMs: number; fromX: number | null; fromY: number | null;
  bossId: BossId | null;
  patternId: number;
  color?:number;
  shotX?:number;shotY?:number;
  velocityX:number;velocityY:number;impactAge:number|null;
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
    age: 0, duration: 0, resolved: false, warningMs: 800, fromX: null, fromY: null,bossId:null,patternId:0,velocityX:0,velocityY:0,impactAge:null
  }));
  private readonly graphics: Phaser.GameObjects.Graphics;
  private visualFailed=false;
  // SPORES queries return the first swept hit fraction [0,1], or void for a miss; other kinds resolve damage directly.
  constructor(scene: Phaser.Scene,
    private readonly resolve: (kind: HazardKind, x: number, y: number, radius: number, damage: number, sourceLife: number, previousX?:number,previousY?:number) => number|void,
    private readonly visuals?:HazardVisualSink,
    private readonly audio?:HazardVisualSink) {
    this.graphics = scene.add.graphics().setDepth(38);
  }

  public add(kind: HazardKind, x: number, y: number, damage: number, sourceLife: number,
    options: {radius?:number;warningMs?:number;durationMs?:number;fromX?:number;fromY?:number;bossId?:BossId;patternId?:number;color?:number;shotX?:number;shotY?:number;velocityX?:number;velocityY?:number} = {}): boolean {
    const slot = this.slots.find(item => !item.active);
    if (!slot) return false;
    Object.assign(slot, { active: true, kind, x, y, damage, sourceLife, age: 0, resolved: false,
      radius: options.radius ?? (kind === 'METEOR' ? 105 : kind === 'SHOT' ? 48 : kind === 'CHARGE' ? 70 : 90),
      duration: options.durationMs ?? (kind === 'POISON' || kind === 'FROST' ? 3000 : 250),
      warningMs: options.warningMs ?? 800, fromX: options.fromX ?? null, fromY: options.fromY ?? null,bossId:options.bossId??null,patternId:options.patternId??0,color:options.color,shotX:options.shotX,shotY:options.shotY,
      velocityX:options.velocityX??0,velocityY:options.velocityY??0,impactAge:null });
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

  private updateSpore(slot:Hazard,index:number,previousAge:number):void {
    const g=this.graphics,r=slot.radius,warning=slot.age<slot.warningMs;
    if(warning){
      g.lineStyle(2,0xff626e,.65).lineBetween(slot.x,slot.y,slot.x+slot.velocityX*.9,slot.y+slot.velocityY*.9);
      g.lineStyle(2,0xc0e875,.7).strokeCircle(slot.x,slot.y,r*(.7+.3*slot.age/slot.warningMs));
    }else if(!slot.resolved){
      const ms=Math.max(0,Math.min(slot.age,slot.warningMs+slot.duration)-Math.max(previousAge,slot.warningMs));
      const x=slot.x,y=slot.y,dx=slot.velocityX*ms/1000,dy=slot.velocityY*ms/1000;
      let wall=1;
      if(dx>0)wall=Math.min(wall,(ARENA_BOUNDS.right-r-x)/dx);else if(dx<0)wall=Math.min(wall,(ARENA_BOUNDS.left+r-x)/dx);
      if(dy>0)wall=Math.min(wall,(ARENA_BOUNDS.bottom-r-y)/dy);else if(dy<0)wall=Math.min(wall,(ARENA_BOUNDS.top+r-y)/dy);
      wall=Math.max(0,wall);
      const endX=x+dx*wall,endY=y+dy*wall;
      const wallHit=wall<1||endX<=ARENA_BOUNDS.left+r+1e-7||endX>=ARENA_BOUNDS.right-r-1e-7
        ||endY<=ARENA_BOUNDS.top+r+1e-7||endY>=ARENA_BOUNDS.bottom-r-1e-7;
      const hit=this.resolve('SPORES',endX,endY,r,slot.damage,slot.sourceLife,x,y);
      if(!slot.active)return; // A death callback may clear the encounter synchronously.
      const collided=typeof hit==='number'&&hit>=0&&hit<=1;
      slot.x=collided?x+(endX-x)*hit:endX;slot.y=collided?y+(endY-y)*hit:endY;
      if(collided||wallHit||slot.age>=slot.warningMs+slot.duration){
        slot.resolved=true;
        const start=Math.max(previousAge,slot.warningMs);
        slot.impactAge=collided?start+ms*wall*hit:wallHit?start+ms*wall:slot.warningMs+slot.duration;
      }
      if(!slot.resolved){
        g.fillStyle(0x71b53b,.65).fillCircle(slot.x,slot.y,r);
        g.lineStyle(2,0xd5f58a,.9).strokeCircle(slot.x,slot.y,r);
      }
    }
    this.paint('draw',index,slot,previousAge<slot.warningMs&&slot.age>=slot.warningMs);
    if(slot.impactAge!==null&&slot.age-slot.impactAge>=300){slot.active=false;this.paint('end',index,slot);}
  }

  public update(delta: number, target?: Readonly<{x:number;y:number}>): void {
    this.graphics.clear();
    for (let index=0;index<this.slots.length;index++) {
      const slot=this.slots[index];
      if (!slot.active) continue;
      const previousAge=slot.age;
      slot.age += Math.max(0,delta);
      if(slot.kind==='SPORES'){this.updateSpore(slot,index,previousAge);continue;}
      if(slot.bossId==='desert_emperor'&&slot.kind==='POISON'&&target){
        // Only the active part of this frame moves: telegraphs stay fixed and expiry caps travel.
        const activeMs=Math.max(0,Math.min(slot.age,slot.warningMs+slot.duration)-Math.max(previousAge,slot.warningMs));
        const dx=target.x-slot.x,dy=target.y-slot.y,distance=Math.hypot(dx,dy);
        if(activeMs>0&&distance>0){
          const step=Math.min(distance,DESERT_STORM_CHASE_SPEED*activeMs/1000);
          slot.x=Math.max(ARENA_BOUNDS.left+slot.radius,Math.min(ARENA_BOUNDS.right-slot.radius,slot.x+dx/distance*step));
          slot.y=Math.max(ARENA_BOUNDS.top+slot.radius,Math.min(ARENA_BOUNDS.bottom-slot.radius,slot.y+dy/distance*step));
        }
      }
      const warning = slot.age < slot.warningMs;
      if(slot.kind==='ROOTS'&&slot.warningMs===1000&&slot.fromX!==null&&slot.fromY!==null){
        const a=Math.atan2(slot.y-slot.fromY,slot.x-slot.fromX)-Math.PI/3;
        const ex=slot.fromX+Math.cos(a)*175,ey=slot.fromY+Math.sin(a)*175;
        this.graphics.lineStyle(3,0xd4f5a2,.8)
          .lineBetween(slot.fromX+Math.cos(a)*105,slot.fromY+Math.sin(a)*105,ex,ey)
          .lineBetween(ex,ey,ex-Math.cos(a-.5)*16,ey-Math.sin(a-.5)*16)
          .lineBetween(ex,ey,ex-Math.cos(a+.5)*16,ey-Math.sin(a+.5)*16);
      }
      const color = slot.color!==undefined?(warning?0xff4e68:slot.color):slot.bossId&&warning?(slot.bossId==='twilight_king'&&slot.kind==='CHARGE'?0xef65d6:0xff4e68)
        :slot.bossId==='desert_emperor'?BOSS_VISUALS.desert_emperor.accent
        :slot.bossId==='frost_queen'&&slot.kind==='METEOR'?BOSS_VISUALS.frost_queen.accent
        :slot.kind==='METEOR'&&(slot.bossId==='forest_guardian'||slot.bossId==='twilight_king')?BOSS_VISUALS[slot.bossId].accent
        :slot.bossId==='twilight_king'&&slot.kind==='FROST'?BOSS_VISUALS.twilight_king.accent
        :slot.kind==='SLASH'?0xd18aff:slot.kind==='ROOTS'?0x9fe06e:slot.kind === 'FROST' ? 0x9bddff : slot.kind === 'POISON' ? 0xb9d36e : 0xf17b53;
      if (slot.kind==='FISSURE'&&warning&&slot.fromX!==null&&slot.fromY!==null)
        this.graphics.lineStyle(4,0xff623b,.7).lineBetween(slot.fromX,slot.fromY,slot.x,slot.y);
      if ((slot.kind==='CHARGE'||slot.kind==='SLASH')&&slot.fromX !== null && slot.fromY !== null) {
        const angle=Math.atan2(slot.y-slot.fromY,slot.x-slot.fromX),nx=-Math.sin(angle)*slot.radius,ny=Math.cos(angle)*slot.radius;
        this.graphics.lineStyle(slot.radius*2,color,0.14).lineBetween(slot.fromX,slot.fromY,slot.x,slot.y);
        this.graphics.lineStyle(3,color,0.9).lineBetween(slot.fromX+nx,slot.fromY+ny,slot.x+nx,slot.y+ny)
          .lineBetween(slot.fromX-nx,slot.fromY-ny,slot.x-nx,slot.y-ny).lineBetween(slot.fromX,slot.fromY,slot.x,slot.y);
        if(slot.kind==='SLASH')this.graphics.strokeCircle(slot.fromX,slot.fromY,slot.radius).strokeCircle(slot.x,slot.y,slot.radius);
      } else {
        const poison=!!slot.bossId&&slot.kind==='POISON',binding=slot.bossId==='twilight_king'&&slot.kind==='FROST';
        if(!warning&&(poison||binding)){
          const segments=poison?8:12;this.graphics.lineStyle(poison?1.2:1.5,color,poison?.45:.6);
          for(let n=0;n<segments;n++){const a=n*Math.PI*2/segments;this.graphics.beginPath().arc(slot.x,slot.y,slot.radius,a,a+Math.PI*2/segments*.52).strokePath();}
        }else this.graphics.lineStyle(warning ? 3 : 2, color, 0.9).strokeCircle(slot.x, slot.y, slot.radius);
        this.graphics.fillStyle(color, warning ? 0.12 : poison?0.025:slot.bossId?0.08:0.35).fillCircle(slot.x, slot.y, slot.radius);
      }
      if(slot.color!==undefined&&!slot.bossId){
        const g=this.graphics,alpha=warning?.35:.75,t=slot.age*.0015;
        if(slot.kind==='SHOT'&&warning&&slot.shotX!==undefined&&slot.shotY!==undefined){
          const dx=slot.x-slot.shotX,dy=slot.y-slot.shotY,a=Math.atan2(dy,dx),u=slot.age/slot.warningMs,x=slot.shotX+dx*u,y=slot.shotY+dy*u;
          g.lineStyle(3,slot.color,.9).lineBetween(x-Math.cos(a)*18,y-Math.sin(a)*18,x,y)
            .lineBetween(x,y,x-Math.cos(a-.5)*8,y-Math.sin(a-.5)*8).lineBetween(x,y,x-Math.cos(a+.5)*8,y-Math.sin(a+.5)*8);
        }else if(slot.kind!=='SHOT'){
          g.lineStyle(1.5,slot.color,alpha);
          for(let n=0;n<6;n++){
            const a=n*Math.PI/3+t,r=slot.radius*.55;
            if(slot.kind==='POISON')g.strokeCircle(slot.x+Math.cos(a)*r,slot.y+Math.sin(a)*r,slot.radius*.12);
            else g.lineBetween(slot.x+Math.cos(a)*r*.3,slot.y+Math.sin(a)*r*.3,slot.x+Math.cos(a)*r,slot.y+Math.sin(a)*r);
          }
        }
      }
      this.paint('draw',index,slot,!warning&&!slot.resolved);
      if (warning) {
        this.graphics.lineStyle(2, color, 0.8).strokeCircle(slot.x, slot.y, slot.radius * slot.age / slot.warningMs);
      } else {
        if (!slot.resolved || slot.kind === 'POISON' || slot.kind === 'FROST' || slot.kind==='ROOTS') {
          slot.resolved = true;
          if(slot.kind==='SLASH')this.resolve(slot.kind,slot.x,slot.y,slot.radius,slot.damage,slot.sourceLife,slot.fromX??slot.x,slot.fromY??slot.y);
          else this.resolve(slot.kind, slot.x, slot.y, slot.radius, slot.damage, slot.sourceLife);
        }
        if (slot.kind === 'CHARGE' || slot.kind === 'SUMMON' || slot.age >= slot.warningMs + slot.duration){slot.active = false;this.paint('end',index,slot);}
      }
    }
  }
}
