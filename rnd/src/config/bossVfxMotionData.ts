import type {BossId} from '../types/game';
import type {BossEffect} from './bossVisualData';

export const BOSS_VFX_ATLAS='boss_vfx_v2';
export const BOSS_VFX_MOTIONS:Record<BossId,Partial<Record<BossEffect,number>>>={
  desert_emperor:{}, // Native HD sand layers; low-resource fallback uses the static source track.
  forest_guardian:{cast:8,charge:8,impact:8,field:8},
  swamp_lord:{cast:8,charge:8,impact:8,field:8},
  lava_colossus:{cast:8,fall:8,impact:8,field:8},
  frost_queen:{cast:8,impact:8,field:8,summon:8},
  twilight_king:{cast:8,fall:8,impact:8,field:8,charge:8,summon:8}
};

/** A loop keeps the original 4-frame cycle period while showing every new intermediate frame. */
export function bossVfxFrameIndex(progress:number,count:number,loop=false):number {
  const p=Math.max(0,progress);
  return loop?Math.floor(p*count/4)%count:Math.min(count-1,Math.floor(p*count));
}

export function bossVfxFade(elapsed:number,duration:number):number {
  const t=Math.max(0,Math.min(1,1-elapsed/duration));return t*t*(3-2*t);
}
