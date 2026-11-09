import type { BossId, BossPattern } from '../types/game';
import { ARENA_BOUNDS } from './gameData';
export const BOSS_IDS: readonly BossId[] = ['forest_guardian','swamp_lord','lava_colossus','frost_queen','twilight_king'];
interface BossProfile { name: string; color: number; patterns: readonly BossPattern[]; intervalMs: number; warningMs: number; hint: string }
export const BOSS_PROFILES: Record<BossId, BossProfile> = {
  forest_guardian: {name:'숲의 수호자',color:0x8bce85,patterns:['CHARGE','METEOR'],intervalMs:3200,warningMs:1000,
    hint:'돌진 띠에서 옆으로 피하고, 수호자 주변 강타 범위를 벗어나세요.'},
  swamp_lord: {name:'독 늪의 군주',color:0xb9d36e,patterns:['POISON','CHARGE'],intervalMs:3400,warningMs:1000,
    hint:'독 웅덩이 두 곳을 피해 이동하세요. 웅덩이는 잠시 남습니다.'},
  lava_colossus: {name:'용암 거신',color:0xffa66a,patterns:['METEOR'],intervalMs:3300,warningMs:1100,
    hint:'가로로 떨어지는 세 운석을 위나 아래로 피하세요.'},
  frost_queen: {name:'서리 여왕',color:0x9bddff,patterns:['FROST','SUMMON'],intervalMs:3500,warningMs:1100,
    hint:'네 방향 빙결 고리의 중앙이나 바깥이 안전합니다. 소환도 경계하세요.'},
  twilight_king: {name:'황혼의 마왕',color:0xd3a4ff,patterns:['METEOR','POISON','CHARGE','FROST','SUMMON'],intervalMs:3000,warningMs:1000,
    hint:'십자 낙하의 중심은 안전하지만, 다음 독 공격에는 자리를 옮기세요.'}
};
export function isBossId(id: unknown): id is BossId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(BOSS_PROFILES,id);
}
export interface BossAttack { kind: BossPattern; x: number; y: number; radius: number; warningMs: number; durationMs: number; fromX?: number; fromY?: number }
/** Called once per pattern, never each frame. All targets lock when the warning appears. */
export function planBossAttack(id: BossId, phase: number, sequence: number, boss: {x:number;y:number;speed:number}, target: {x:number;y:number}) {
  const profile=BOSS_PROFILES[id],kind=profile.patterns[sequence%profile.patterns.length],attacks:BossAttack[]=[];
  const add=(type:BossPattern,x:number,y:number,radius:number,durationMs=250) => attacks.push({kind:type,
    x:Math.max(ARENA_BOUNDS.left+radius,Math.min(ARENA_BOUNDS.right-radius,x)),
    y:Math.max(ARENA_BOUNDS.top+radius,Math.min(ARENA_BOUNDS.bottom-radius,y)),radius,warningMs:profile.warningMs,durationMs});
  if(kind==='CHARGE') {
    const angle=Math.atan2(target.y-boss.y,target.x-boss.x),dx=Math.cos(angle),dy=Math.sin(angle);
    let distance=boss.speed*1.75*0.6;
    if(dx>0.0001)distance=Math.min(distance,(ARENA_BOUNDS.right-46-boss.x)/dx);
    else if(dx< -0.0001)distance=Math.min(distance,(ARENA_BOUNDS.left+46-boss.x)/dx);
    if(dy>0.0001)distance=Math.min(distance,(ARENA_BOUNDS.bottom-46-boss.y)/dy);
    else if(dy< -0.0001)distance=Math.min(distance,(ARENA_BOUNDS.top+46-boss.y)/dy);
    distance=Math.max(1,distance);
    attacks.push({kind,x:boss.x+dx*distance,y:boss.y+dy*distance,radius:70,warningMs:profile.warningMs,durationMs:250,fromX:boss.x,fromY:boss.y});
  } else if(id==='forest_guardian') add('METEOR',boss.x,boss.y,105);
  else if(id==='swamp_lord'&&kind==='POISON') {
    add(kind,target.x-110,target.y,75,2400);add(kind,target.x+110,target.y,75,2400);
  } else if(id==='lava_colossus') {
    for(const offset of[-150,0,150])add(kind,target.x+offset,target.y,70+Math.min(2,phase-1)*5);
  } else if((id==='frost_queen'||id==='twilight_king')&&kind==='FROST') {
    for(const [dx,dy]of[[0,-170],[0,170],[-170,0],[170,0]])add(kind,ARENA_BOUNDS.centerX+dx,ARENA_BOUNDS.centerY+dy,85,2200);
  } else if(id==='twilight_king'&&kind==='METEOR') {
    // Omit arms outside the arena instead of pushing them into the advertised safe center.
    for(const [dx,dy]of[[0,-150],[0,150],[-150,0],[150,0]]) {
      const x=target.x+dx,y=target.y+dy;
      if(x>=ARENA_BOUNDS.left&&x<=ARENA_BOUNDS.right&&y>=ARENA_BOUNDS.top&&y<=ARENA_BOUNDS.bottom)
        attacks.push({kind,x,y,radius:65,warningMs:profile.warningMs,durationMs:250});
    }
  } else add(kind,kind==='SUMMON'?boss.x:target.x,kind==='SUMMON'?boss.y:target.y,80,kind==='POISON'?2400:250);
  return {attacks,intervalMs:Math.round(profile.intervalMs/(1+0.15*Math.max(0,phase-1)))};
}
