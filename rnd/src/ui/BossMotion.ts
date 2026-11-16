import type {BossId} from '../types/game';

export const BOSS_MOTION_ATLAS='boss_motion_v2';
export const DESERT_MOTION_ATLAS='desert_motion_v3';
export const bossMotionAtlas=(id:BossId):string=>id==='desert_emperor'?DESERT_MOTION_ATLAS:BOSS_MOTION_ATLAS;
// 160px cells, feet at y140, displayed at 144px: keep feet 37.5 logical px below the physical actor.
export const BOSS_MOTION_ORIGIN_Y=59/96;
export const bossMotionFrame=(id:BossId,index:number):string=>`${id}_motion_${index}`;
const STRIDE:Record<BossId,number>={forest_guardian:72,swamp_lord:64,lava_colossus:84,frost_queen:80,twilight_king:76,desert_emperor:76};

/** Visual playback only. It reads displacement and combat cues; it never moves or stops an actor. */
export class BossMotion {
  public frameIndex=0;
  public facingLeft=false;
  private mode:'walk'|'cast'|'release'|'dash'='walk';
  private x=0;
  private y=0;
  private distance=0;
  private elapsed=0;
  private castDuration=1000;

  public reset(x:number,y:number):void {
    this.x=x;this.y=y;this.distance=this.elapsed=0;this.mode='walk';this.frameIndex=0;this.facingLeft=false;
  }

  public cast(duration:number):void {
    this.mode='cast';this.elapsed=0;this.castDuration=Math.max(1,duration);this.frameIndex=4;
  }

  public impact(expandedDesert=false):void {this.mode='release';this.elapsed=0;this.frameIndex=expandedDesert?12:8;}

  public advance(id:BossId,delta:number,x:number,y:number,charging:boolean,chargeLeft:boolean,expandedDesert=false):void {
    const extended=id==='desert_emperor'&&expandedDesert;
    const dx=x-this.x,dy=y-this.y,moved=Math.hypot(dx,dy);this.x=x;this.y=y;
    if(delta===0&&moved<=.05&&this.mode==='walk'&&!charging)return;
    // Teleports/room placement must not count as footsteps. Real displacement sets gait even under slow.
    const step=moved>0.05&&moved<=Math.max(40,delta*2)?moved:0;
    if(charging){
      if(this.mode!=='dash'){this.mode='dash';this.elapsed=0;}
      this.elapsed+=delta;this.facingLeft=chargeLeft;
      this.frameIndex=id==='forest_guardian'||id==='swamp_lord'?8+Math.floor(this.elapsed/130)%2:Math.floor(this.elapsed/90)%4;
      return;
    }
    if(this.mode==='dash'){this.mode='release';this.elapsed=160;}
    if(this.mode==='cast'){
      this.elapsed=Math.min(this.castDuration,this.elapsed+delta);
      const frames=extended?8:4;
      this.frameIndex=4+Math.min(frames-1,Math.floor(this.elapsed/this.castDuration*frames));return;
    }
    if(this.mode==='release'){
      this.elapsed+=delta;
      if(this.elapsed<(extended?640:320)){this.frameIndex=(extended?12:8)+Math.floor(this.elapsed/80);return;}
      this.mode='walk';this.distance=0;
    }
    if(step>0){
      if(Math.abs(dx)>.15)this.facingLeft=dx<0;
      this.distance=(this.distance+step)%STRIDE[id];
      this.frameIndex=Math.floor(this.distance/STRIDE[id]*4);
    }else this.frameIndex=0;
  }
}
