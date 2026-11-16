import type {BossId,BossPattern} from '../types/game';

export const BOSS_ATLAS='boss_art_v1';
export type BossPose='idle'|'cast'|'charge';
export type BossEffect='cast'|'charge'|'fall'|'impact'|'field'|'frost'|'summon';
export const BOSS_VISUALS:Record<BossId,{displaySize:number;accent:number;effects:Partial<Record<BossEffect,number>>}>={
  desert_emperor:{displaySize:144,accent:0xffd066,effects:{cast:4,impact:4,field:4}},
  forest_guardian:{displaySize:144,accent:0x9ce267,effects:{cast:4,charge:4,impact:4}},
  swamp_lord:{displaySize:144,accent:0xb9df42,effects:{cast:4,charge:4,field:4,impact:4}},
  lava_colossus:{displaySize:144,accent:0xffa045,effects:{cast:4,fall:4,impact:4,field:4}},
  frost_queen:{displaySize:144,accent:0x9bddff,effects:{cast:4,impact:4,field:4,summon:4}},
  twilight_king:{displaySize:144,accent:0xd98aff,effects:{fall:2,impact:4,field:4,charge:4,frost:4,summon:4}}
};
export const bossPoseFrame=(id:BossId,pose:BossPose):string=>id+'_'+pose;
export const bossEffectFrame=(id:BossId,kind:BossEffect,index:number):string=>id+'_'+kind+'_'+index;
export function bossEffectFor(_id:BossId,kind:BossPattern):BossEffect {
  if(kind==='CHARGE')return 'charge';
  if(kind==='POISON')return 'field';
  if(kind==='SUMMON')return 'summon';
  return 'impact';
}

/** Combat FROST stays unchanged; the king uses dark magic rather than the sheet's blue ice row. */
export function bossFieldEffectFor(id:BossId,kind:'POISON'|'FROST'):BossEffect {
  return id==='twilight_king'&&kind==='FROST'?'summon':'field';
}
