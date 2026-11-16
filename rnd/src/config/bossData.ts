import type { BossId, BossPattern } from '../types/game';
import { ARENA_BOUNDS } from './gameData';
export const DESERT_STORM_CHASE_SPEED = 45;
export const BOSS_IDS: readonly BossId[] = ['forest_guardian','swamp_lord','lava_colossus','frost_queen','twilight_king','desert_emperor'];
interface BossProfile { name: string; color: number; patterns: readonly BossPattern[]; intervalMs: number; warningMs: number; hint: string }
export const BOSS_PROFILES: Record<BossId, BossProfile> = {
  desert_emperor: {name:'사막의 제왕',color:0xffcd66,patterns:['POISON','SPIKES'],intervalMs:3600,warningMs:1200,
    hint:'추적하는 폭풍을 피하고, 사막의 송곳니가 솟을 다섯 예고 지점에서 벗어나세요.'},
  forest_guardian: {name:'숲의 수호자',color:0x8bce85,patterns:['CHARGE','METEOR','ROOTS'],intervalMs:3200,warningMs:1000,
    hint:'돌진과 강타를 피하고, 가시뿌리 포위의 넓게 열린 틈으로 이동하세요.'},
  swamp_lord: {name:'독 늪의 군주',color:0xb9d36e,patterns:['POISON','CHARGE','SPORES'],intervalMs:3400,warningMs:1000,
    hint:'독 웅덩이와 돌진을 피하고, 부채꼴로 날아오는 포자탄 사이로 이동하세요.'},
  lava_colossus: {name:'용암 거신',color:0xffa66a,patterns:['METEOR','FISSURE'],intervalMs:3300,warningMs:1100,
    hint:'운석을 피하고, 지각 분쇄의 균열 경로에서는 옆으로 벗어나세요.'},
  frost_queen: {name:'서리 여왕',color:0x9bddff,patterns:['FROST','SUMMON','METEOR'],intervalMs:3500,warningMs:1100,
    hint:'빙결 고리와 10연속 빙하 폭격의 예고 범위를 피하세요. 소환도 경계하세요.'},
  twilight_king: {name:'황혼의 마왕',color:0xd3a4ff,patterns:['METEOR','POISON','CHARGE','FROST','SUMMON','SLASH'],intervalMs:3000,warningMs:1000,
    hint:'낙하·독·속박을 피하고, 황혼의 참격은 첫 대각선 다음 반대 대각선도 피하세요.'}
};
export function isBossId(id: unknown): id is BossId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(BOSS_PROFILES,id);
}
export interface BossAttack { kind: BossPattern; x: number; y: number; radius: number; warningMs: number; durationMs: number; fromX?: number; fromY?: number;velocityX?:number;velocityY?:number }
/** Called once per pattern, never each frame. All targets lock when the warning appears. */
export function planBossAttack(id: BossId, phase: number, sequence: number, boss: {x:number;y:number;speed:number}, target: {x:number;y:number}) {
  const profile=BOSS_PROFILES[id],kind=profile.patterns[sequence%profile.patterns.length],attacks:BossAttack[]=[];
  const add=(type:BossPattern,x:number,y:number,radius:number,durationMs=250) => attacks.push({kind:type,
    x:Math.max(ARENA_BOUNDS.left+radius,Math.min(ARENA_BOUNDS.right-radius,x)),
    y:Math.max(ARENA_BOUNDS.top+radius,Math.min(ARENA_BOUNDS.bottom-radius,y)),radius,warningMs:profile.warningMs,durationMs});
  if(id==='twilight_king'&&kind==='SLASH'){
    const radius=26,pad=radius+90;
    const cx=Math.max(ARENA_BOUNDS.left+pad,Math.min(ARENA_BOUNDS.right-pad,target.x));
    const cy=Math.max(ARENA_BOUNDS.top+pad,Math.min(ARENA_BOUNDS.bottom-pad,target.y));
    const reach=(dx:number,dy:number)=>Math.min(320,
      dx>0?(ARENA_BOUNDS.right-radius-cx)/dx:(ARENA_BOUNDS.left+radius-cx)/dx,
      dy>0?(ARENA_BOUNDS.bottom-radius-cy)/dy:(ARENA_BOUNDS.top+radius-cy)/dy);
    for(let i=0;i<2;i++){
      const a=i===0?Math.PI/4:-Math.PI/4,dx=Math.cos(a),dy=Math.sin(a),front=reach(dx,dy),back=reach(-dx,-dy);
      attacks.push({kind,fromX:cx-dx*back,fromY:cy-dy*back,x:cx+dx*front,y:cy+dy*front,
        radius,warningMs:1000+i*750,durationMs:250});
    }
  } else if(id==='forest_guardian'&&kind==='ROOTS'){
    const ring=140,radius=42,pad=ring+radius;
    const x=Math.max(ARENA_BOUNDS.left+pad,Math.min(ARENA_BOUNDS.right-pad,target.x));
    const y=Math.max(ARENA_BOUNDS.top+pad,Math.min(ARENA_BOUNDS.bottom-pad,target.y));
    const edge=x!==target.x||y!==target.y;
    const gap=edge?Math.atan2(ARENA_BOUNDS.centerY-y,ARENA_BOUNDS.centerX-x):Math.atan2(y-boss.y,x-boss.x);
    for(let i=0;i<7;i++){
      const a=gap+(60+i*40)*Math.PI/180;
      attacks.push({kind,x:x+Math.cos(a)*ring,y:y+Math.sin(a)*ring,fromX:x,fromY:y,
        radius,warningMs:1000+i*100,durationMs:900});
    }
  } else if(id==='swamp_lord'&&kind==='SPORES'){
    const angle=Math.atan2(target.y-boss.y,target.x-boss.x);
    for(let i=0;i<5;i++){
      const a=angle+(i-2)*Math.PI/6,dx=Math.cos(a),dy=Math.sin(a);
      add(kind,boss.x+dx*52,boss.y+dy*52,18,2700);
      Object.assign(attacks[i],{velocityX:dx*160,velocityY:dy*160});
    }
  } else if(id==='lava_colossus'&&kind==='FISSURE') {
    const radius=54,minX=ARENA_BOUNDS.left+radius,maxX=ARENA_BOUNDS.right-radius;
    const minY=ARENA_BOUNDS.top+radius,maxY=ARENA_BOUNDS.bottom-radius;
    const x=Math.max(minX,Math.min(maxX,boss.x)),y=Math.max(minY,Math.min(maxY,boss.y));
    let angle=Math.atan2(target.y-y,target.x-x);
    const reach=(a:number)=>{
      const dx=Math.cos(a),dy=Math.sin(a);
      return Math.min(480,dx>1e-6?(maxX-x)/dx:dx< -1e-6?(minX-x)/dx:Infinity,
        dy>1e-6?(maxY-y)/dy:dy< -1e-6?(minY-y)/dy:Infinity);
    };
    if(Math.hypot(target.x-x,target.y-y)<1||reach(angle)<220)angle=Math.atan2(ARENA_BOUNDS.centerY-y,ARENA_BOUNDS.centerX-x);
    const length=reach(angle),dx=Math.cos(angle),dy=Math.sin(angle);
    for(let i=0;i<6;i++)attacks.push({kind,x:x+dx*length*(i+1)/6,y:y+dy*length*(i+1)/6,
      fromX:x+dx*length*i/6,fromY:y+dy*length*i/6,radius,warningMs:1100+i*150,durationMs:250});
  } else if(kind==='CHARGE') {
    const angle=Math.atan2(target.y-boss.y,target.x-boss.x),dx=Math.cos(angle),dy=Math.sin(angle);
    let distance=boss.speed*1.75*0.6;
    if(dx>0.0001)distance=Math.min(distance,(ARENA_BOUNDS.right-46-boss.x)/dx);
    else if(dx< -0.0001)distance=Math.min(distance,(ARENA_BOUNDS.left+46-boss.x)/dx);
    if(dy>0.0001)distance=Math.min(distance,(ARENA_BOUNDS.bottom-46-boss.y)/dy);
    else if(dy< -0.0001)distance=Math.min(distance,(ARENA_BOUNDS.top+46-boss.y)/dy);
    distance=Math.max(1,distance);
    attacks.push({kind,x:boss.x+dx*distance,y:boss.y+dy*distance,radius:70,warningMs:profile.warningMs,durationMs:250,fromX:boss.x,fromY:boss.y});
  } else if(id==='desert_emperor'&&kind==='SPIKES') {
    const radius=50,x=Math.max(ARENA_BOUNDS.left+radius,Math.min(ARENA_BOUNDS.right-radius,target.x));
    const y=Math.max(ARENA_BOUNDS.top+radius,Math.min(ARENA_BOUNDS.bottom-radius,target.y));
    const nearEdge=x<ARENA_BOUNDS.left+160||x>ARENA_BOUNDS.right-160||y<ARENA_BOUNDS.top+160||y>ARENA_BOUNDS.bottom-160;
    const angle=nearEdge?Math.atan2(ARENA_BOUNDS.centerY-y,ARENA_BOUNDS.centerX-x):Math.atan2(boss.y-y,boss.x-x);
    add(kind,x,y,radius);
    attacks[0].warningMs=1000;
    for(let i=0;i<4;i++){
      const a=angle+(-60+i*40)*Math.PI/180;
      add(kind,x+Math.cos(a)*180,y+Math.sin(a)*180,radius);
      attacks[i+1].warningMs=1000+(i+1)*180;
    }
  } else if(id==='desert_emperor') {
    add(kind,target.x,target.y,90,2400);
    if(phase>=2)add(kind,target.x+(target.x>ARENA_BOUNDS.centerX?-200:200),target.y,90,2400);
  } else if(id==='forest_guardian') add('METEOR',boss.x,boss.y,105);
  else if(id==='swamp_lord'&&kind==='POISON') {
    add(kind,target.x-110,target.y,75,2400);add(kind,target.x+110,target.y,75,2400);
  } else if(id==='lava_colossus') {
    for(const offset of[-150,0,150])add(kind,target.x+offset,target.y,70+Math.min(2,phase-1)*5);
  } else if(id==='frost_queen'&&kind==='METEOR') {
    for(let i=0;i<10;i++){
      const angle=i*2.399,r=i===0?0:40+(i%3)*28;
      add(kind,target.x+Math.cos(angle)*r,target.y+Math.sin(angle)*r,48);
      attacks[attacks.length-1].warningMs=profile.warningMs+i*180;
    }
  } else if((id==='frost_queen'||id==='twilight_king')&&kind==='FROST') {
    for(const [dx,dy]of[[0,-170],[0,170],[-170,0],[170,0]])add(kind,target.x+dx,target.y+dy,85,2200);
  } else if(id==='twilight_king'&&kind==='METEOR') {
    // Omit arms outside the arena instead of pushing them into the advertised safe center.
    for(const [dx,dy]of[[0,-150],[0,150],[-150,0],[150,0]]) {
      const x=target.x+dx,y=target.y+dy;
      if(x>=ARENA_BOUNDS.left&&x<=ARENA_BOUNDS.right&&y>=ARENA_BOUNDS.top&&y<=ARENA_BOUNDS.bottom)
        attacks.push({kind,x,y,radius:65,warningMs:profile.warningMs,durationMs:250});
    }
  } else add(kind,kind==='SUMMON'?boss.x:target.x,kind==='SUMMON'?boss.y:target.y,80,kind==='POISON'?2400:250);
  const intervalMs=Math.round(profile.intervalMs/(1+0.15*Math.max(0,phase-1)));
  return {attacks,intervalMs:kind==='SLASH'?Math.max(intervalMs,2600):kind==='ROOTS'?Math.max(intervalMs,2800):kind==='SPORES'?Math.max(intervalMs,4200):id==='desert_emperor'&&kind==='POISON'?Math.max(intervalMs,4000)
    :id==='frost_queen'&&kind==='METEOR'?Math.max(intervalMs,3170):intervalMs};
}
