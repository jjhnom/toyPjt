import type { HeroClassId, PermanentRanks } from '../types/game';
export const HERO_CLASS_IDS: readonly HeroClassId[] = ['APPRENTICE_SUMMONER','KNIGHT','ELEMENTALIST'];
export const HERO_CLASSES = {
  APPRENTICE_SUMMONER: {name:'견습 소환사',baseHp:100,baseDamage:8,fireRateMs:1100,range:260,aoeRadius:0,color:0xffffff,
    description:'균형형 · 생존 본체와 출전 동료 HP10 회복',activeName:'치유 파동',activeLabel:'생존 +10',heal:10,selfOnly:false,cleanse:false},
  KNIGHT: {name:'원정 기사',baseHp:125,baseDamage:10,fireRateMs:1300,range:145,aoeRadius:0,color:0xf1d599,
    description:'근거리 자동 공격 · 본체 HP25 회복, 동료 제외',activeName:'결의 회복',activeLabel:'본체 +25',heal:25,selfOnly:true,cleanse:false},
  ELEMENTALIST: {name:'원소 술사',baseHp:90,baseDamage:9,fireRateMs:1400,range:300,aoeRadius:45,color:0x9ddcff,
    description:'반경45 범위탄 · 생존 아군 HP6/본체 감속 해제',activeName:'정화 파동',activeLabel:'회복 +6',heal:6,selfOnly:false,cleanse:true}
} as const;
export function isHeroClassId(value:unknown):value is HeroClassId {
  return typeof value==='string'&&Object.prototype.hasOwnProperty.call(HERO_CLASSES,value);
}
export const emptyPermanentRanks=():PermanentRanks=>({vitality:0,power:0});
export function isPermanentRanks(value:unknown):value is PermanentRanks {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const data=value as Record<string,unknown>;
  return Object.keys(data).length===2&&['vitality','power'].every(key=>Number.isSafeInteger(data[key])&&(data[key] as number)>=0&&(data[key] as number)<=5);
}
export const PERMANENT_UPGRADES = {
  vitality:{name:'영혼의 활력',description:'단계마다 본체 최대 HP +5 · 최대 +25'},
  power:{name:'영혼의 힘',description:'단계마다 영웅 공격 +1 · 최대 +5'}
} as const;
