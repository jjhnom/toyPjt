import type {BossId,EnemyArchetype} from '../types/game';
export type MonsterSpecial='SHOT'|'POISON'|'FROST'|'METEOR'|'SUMMON';
export const MONSTER_ATLAS='regional_monsters_v1';
export interface RegionalMonster {
 id:string;region:BossId;name:string;role:'melee'|'ranged'|'caster';color:number;
 skill?:{kind:MonsterSpecial;name:string;cooldownMs:number;range:number;radius:number;warningMs:number;durationMs:number};
}
const rows:readonly [BossId,number,string,string,string,MonsterSpecial,string][]=[
 ['forest_guardian',0x98cc67,'이끼 버섯귀','가시 활잡이','숲의 주술사','FROST','덩굴 지대'],
 ['swamp_lord',0xadd35d,'독안개 두꺼비','포자 분사수','늪 버섯마녀','POISON','오염 웅덩이'],
 ['lava_colossus',0xffa05c,'잿불 임프','흑요석 투석수','화염 사교도','METEOR','화염 강타'],
 ['frost_queen',0x9be1ff,'서리 늑대','얼음 쇠뇌병','빙하 망령','FROST','서리 고리'],
 ['twilight_king',0xd2a0ff,'그림자 기사','해골 석궁병','황혼 강령술사','SUMMON','그림자 부름'],
 ['desert_emperor',0xffd278,'황금 전갈','자칼 궁수','스카라베 사제','POISON','모래 돌풍']
];
export const REGIONAL_MONSTERS:readonly RegionalMonster[]=rows.flatMap(([region,color,melee,ranged,caster,kind,spell])=>[
 {id:region+'_melee',region,name:melee,role:'melee' as const,color},
 {id:region+'_ranged',region,name:ranged,role:'ranged' as const,color,skill:{kind:'SHOT' as const,name:'조준 사격',cooldownMs:2200,range:450,radius:48,warningMs:800,durationMs:250}},
 {id:region+'_caster',region,name:caster,role:'caster' as const,color,skill:{kind,name:spell,cooldownMs:kind==='SUMMON'?6000:4400,range:500,radius:kind==='METEOR'?65:60,warningMs:1000,durationMs:kind==='POISON'||kind==='FROST'?1200:250}}
]);
export function regionalMonster(region:string,archetype:EnemyArchetype):RegionalMonster|undefined {
 if(archetype==='BOSS_CORE'||archetype==='ELITE_BRUTE')return;
 const role=archetype==='SPORE_SHOOTER'?'ranged':archetype==='SUMMONER'?'caster':'melee';
 return REGIONAL_MONSTERS.find(m=>m.region===region&&m.role===role);
}
export const REGIONAL_POOLS:Readonly<Record<BossId,readonly EnemyArchetype[]>>={
 forest_guardian:['SWARMER','SWARMER','SPORE_SHOOTER','SWARMER','SWARMER','SWARMER','SWARMER','SUMMONER'],
 swamp_lord:['SWARMER','SPORE_SHOOTER','SWARMER','SUMMONER'],
 lava_colossus:['CHASER','SPORE_SHOOTER','EXPLODER','SUMMONER','SWARMER'],
 frost_queen:['CHASER','SPORE_SHOOTER','TANK','SUMMONER'],
 twilight_king:['SWARMER','CHASER','SPORE_SHOOTER','EXPLODER','TANK','SUMMONER'],
 desert_emperor:['CHASER','SPORE_SHOOTER','TANK','SUMMONER','SWARMER']
};
