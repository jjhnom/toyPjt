import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import {paintPoison,paintBinding,paintBindingRelease} from './bossAreaIdentities';
import {paintReferenceEffect,paintReferenceWarning,paintReferenceFall,referenceImpactIndex} from './bossReferenceEffects';
import {paintSandstorm,paintSandstormAir} from './bossSandstorm';

export type BossAreaStyle='earth'|'poison'|'ice'|'fire'|'dark'|'binding'|'frost'|'void'|'sand';
export const BOSS_AREA_QUALITY={size:192,frames:8,filter:0,maxUpscale:1.1} as const; // Phaser LINEAR=0.
const STYLES:Record<BossAreaStyle,{ink:string;glow:string;edge:number}>={
  sand:{ink:'#6c4522',glow:'#ffdb83',edge:0xffd066},
  earth:{ink:'#29351f',glow:'#c2ef7f',edge:0xd7f4a7},poison:{ink:'#123b29',glow:'#8aef93',edge:0xb7ef95},
  ice:{ink:'#15364e',glow:'#b0edff',edge:0xb5ecff},fire:{ink:'#30171e',glow:'#ff8d51',edge:0xffd58b},
  dark:{ink:'#321f44',glow:'#d799ef',edge:0xdfaaff},binding:{ink:'#241131',glow:'#e6bbff',edge:0xe2b9ff},
  frost:{ink:'#123452',glow:'#c7f5ff',edge:0xd5f7ff},void:{ink:'#241032',glow:'#c178ff',edge:0xe0b3ff}
};
const STYLES_LIST:BossAreaStyle[]=['earth','poison','ice','fire','dark','binding','frost','void','sand'];
export const bossAreaAtlas=(style:BossAreaStyle):string=>`boss_ground_hd_${style}`;
export function bossAreaQualityReady(scene:Phaser.Scene):boolean {
  return STYLES_LIST.every(style=>scene.textures.exists(bossAreaAtlas(style)));
}
const GROUND=Array.from({length:8},(_,i)=>`ground_${i}`),MOTES=Array.from({length:8},(_,i)=>`motes_${i}`);
const INTRO=Array.from({length:4},(_,i)=>`intro_${i}`);
const RELEASE=Array.from({length:4},(_,i)=>`release_${i}`);
export function bossAreaStyle(state:Pick<HazardView,'bossId'|'kind'>):BossAreaStyle|undefined {
  if(!state.bossId||(state.kind!=='POISON'&&state.kind!=='FROST'&&state.kind!=='METEOR'&&state.kind!=='SUMMON'))return;
  if(state.bossId==='desert_emperor')return 'sand';
  if(state.kind==='POISON')return 'poison';
  if(state.bossId==='twilight_king'&&state.kind==='FROST')return 'binding';
  if(state.bossId==='twilight_king'&&state.kind==='METEOR')return 'void';
  if(state.bossId==='frost_queen'&&state.kind==='FROST')return 'frost';
  if(state.bossId==='twilight_king')return 'dark';
  if(state.bossId==='swamp_lord')return 'poison';
  if(state.bossId==='frost_queen')return 'ice';
  if(state.bossId==='lava_colossus')return 'fire';
  if(state.bossId==='forest_guardian')return 'earth';
}
function rgba(hex:string,alpha:number):string {
  const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${alpha})`;
}
function glow(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha:number):void {
  const gradient=c.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,rgba(color,alpha));gradient.addColorStop(1,rgba(color,0));
  c.fillStyle=gradient;c.fillRect(x-r,y-r,r*2,r*2);
}
/** Native 192px vector/gradient artwork, NOT a resample of the old 6–14px ground strip.
 * Separate ground and motes frames share an atlas and LINEAR filter. Canvas size <=980px.
 * Cached once; no frame-time rasterization/readback, timers, or unbounded particles.
 */
export function prepareBossAreaQuality(scene:Phaser.Scene):void {
  for(const style of STYLES_LIST){
    const key=bossAreaAtlas(style);if(scene.textures.exists(key))continue;
    try{
      const hasFall=style==='fire'||style==='dark'||style==='void',hasIntro=style==='poison'||style==='binding',hasWarning=style==='earth'||style==='frost';
      const columns=style==='binding'?5:4,texture=scene.textures.createCanvas(key,columns*196,hasFall||hasIntro||hasWarning||style==='sand'?980:784);if(!texture)continue;
      const c=texture.getContext();c.imageSmoothingEnabled=true;const colors=STYLES[style];let cell=0;
      const frame=(name:string,draw:()=>void)=>{
        const x=cell%columns*196+2,y=Math.floor(cell/columns)*196+2;cell++;c.save();c.translate(x,y);draw();c.restore();texture.add(name,0,x,y,192,192);
      };
      for(let i=0;i<8;i++){
        const phase=i*Math.PI/4;
        frame(GROUND[i],()=>{
          if(style==='sand'){paintSandstorm(c,'ground',i);return;}
          if(style==='poison'){paintPoison(c,phase,'ground');return;}
          if(style==='binding'){paintBinding(c,phase,'ground');return;}
          if(style==='earth'||style==='fire'||style==='void'||style==='frost'){paintReferenceEffect(c,style,'ground',i);return;}
          c.beginPath();c.arc(96,96,95.5,0,Math.PI*2);c.clip();
          const fill=c.createRadialGradient(96,96,10,96,96,96);fill.addColorStop(0,rgba(colors.ink,.55));fill.addColorStop(.7,rgba(colors.ink,.74));fill.addColorStop(1,rgba(colors.ink,0));c.fillStyle=fill;c.fillRect(0,0,192,192);
          glow(c,96,96,94,colors.glow,.16);
          for(let n=0;n<10;n++){
            const a=n*2.399,dist=35+(n%4)*13,x=96+Math.cos(a+phase*.16)*dist,y=96+Math.sin(a+phase*.16)*dist;
            glow(c,x,y,18+(n%3)*7,colors.glow,.09+.025*Math.sin(phase+n));
          }
          c.strokeStyle=rgba(colors.glow,.35);c.lineWidth=1.1;
          if(style==='ice'){
            for(let n=0;n<9;n++){
              const a=n*Math.PI*2/9;c.beginPath();c.moveTo(96+Math.cos(a)*14,96+Math.sin(a)*14);
              for(let r=25;r<=83;r+=12){const bend=a+Math.sin(r*.21+n)*.07;c.lineTo(96+Math.cos(bend)*r,96+Math.sin(bend)*r);}c.stroke();
            }
          }else{
            c.lineWidth=1.8;c.strokeStyle=rgba(colors.glow,.17);
            for(let n=0;n<4;n++){c.beginPath();c.ellipse(96,96,28+n*15,21+n*13,phase*.12+n*.6,0,Math.PI*1.65);c.stroke();}
          }
          if(style==='ice')for(let n=0;n<8;n++){
            const a=n*2.399,x=96+Math.cos(a)*65,y=96+Math.sin(a)*65;c.save();c.translate(x,y);c.rotate(a);c.strokeStyle=rgba(colors.glow,.45);c.lineWidth=1.2;
            c.beginPath();c.moveTo(0,-8);c.lineTo(4,0);c.lineTo(0,8);c.lineTo(-4,0);c.closePath();c.stroke();c.restore();
          }
        });
        frame(MOTES[i],()=>{
          if(style==='sand'){paintSandstormAir(scene,c,i);return;}
          if(style==='poison'){paintPoison(c,phase,'motes');return;}
          if(style==='binding'){paintBinding(c,phase,'motes');return;}
          if(style==='earth'||style==='fire'||style==='void'||style==='frost'){paintReferenceEffect(c,style,'motes',i);return;}
          c.beginPath();c.arc(96,96,94,0,Math.PI*2);c.clip();
          for(let n=0;n<18;n++){
            const a=n*2.399+phase*.18,dist=36+(n%5)*10+Math.sin(phase+n)*4,x=96+Math.cos(a)*dist,y=96+Math.sin(a)*dist;
            const alpha=.3+.2*Math.sin(phase+n),r=1.3;
            glow(c,x,y,6,colors.glow,alpha*.7);c.fillStyle=rgba(colors.glow,alpha+.15);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
          }
        });
      }
      if(hasIntro)for(let i=0;i<4;i++)frame(INTRO[i],()=>{
        if(style==='poison')paintPoison(c,0,'ground',(i+1)/4);
        else paintBinding(c,0,'ground',(i+1)/4);
      });
      if(style==='binding')for(let i=0;i<4;i++)frame(RELEASE[i],()=>paintBindingRelease(c,i));
      if(style==='sand')for(let i=0;i<4;i++)frame(RELEASE[i],()=>paintSandstormAir(scene,c,8+i));
      if(style==='earth'||style==='frost')frame('warn',()=>paintReferenceWarning(c,style));
      if(hasFall)frame('fall',()=>{
        if(style==='fire'||style==='void'){paintReferenceFall(c,style);return;}
        const tail=c.createLinearGradient(96,10,96,96);tail.addColorStop(0,rgba(colors.glow,0));tail.addColorStop(1,rgba(colors.glow,.9));c.fillStyle=tail;c.fillRect(92,10,8,86);
        glow(c,96,96,15,colors.glow,.9);c.fillStyle=colors.glow;c.beginPath();c.arc(96,96,5,0,Math.PI*2);c.fill();
      });
      texture.refresh().setFilter(BOSS_AREA_QUALITY.filter);
    }catch{if(scene.textures.exists(key))scene.textures.remove(key);}
  }
}
export interface BossAreaLayers {floor:Phaser.GameObjects.Image;flare:Phaser.GameObjects.Image;detail:Phaser.GameObjects.Graphics;mask:Phaser.Display.Masks.GeometryMask;swirls?:readonly Phaser.GameObjects.Image[]}
const SAND_SWIRLS=[
  {scale:.74,endScale:.36,reach:.61,speed:.00143,phase:0,delay:0,alpha:.95},
  {scale:.6,endScale:.3,reach:.67,speed:.0015,phase:Math.PI*2/3,delay:100,alpha:.85},
  {scale:.5,endScale:.26,reach:.71,speed:.00136,phase:Math.PI*4/3,delay:200,alpha:.75}
] as const;
/** Monotone outward travel; a late frame never wraps a vortex back to the center. */
export function sandstormSpread(age:number,duration:number):number {
  const u=Math.min(1,Math.max(0,age)/Math.max(1,duration));return u*(2-u);
}
function image(image:Phaser.GameObjects.Image,key:string,frame:string,state:HazardView,alpha:number):void {
  if(image.texture.key!==key||image.frame.name!==frame)image.setTexture(key,frame);
  image.setCrop().setOrigin(.5).setPosition(state.x,state.y).setDisplaySize(state.radius*2,state.radius*2)
    .setRotation(0).setFlipX(false).clearTint().setAlpha(alpha).setVisible(true);
}
/** Boundary is native world-space Graphics; material and airborne motes use independent HD images.
 * All timing reads the existing hazard age. Damage and movement are never invoked here.
 */
export function renderBossAreaQuality(scene:Phaser.Scene,layers:BossAreaLayers,state:HazardView,age:number,tailAlpha:number):boolean {
  const style=bossAreaStyle(state);if(!style)return false;
  const key=bossAreaAtlas(style);if(!scene.textures.exists(key))return false;
  const after=age-state.warningMs,r=state.radius,meteor=state.kind==='METEOR',falling=meteor&&(style==='fire'||style==='void');
  const {floor,flare,detail}=layers,color=STYLES[style].edge;
  if(after<0){
    if(style==='sand'){if(age/state.warningMs>.65)image(floor,key,GROUND[0],state,.3);return true;}
    if(style==='earth'||style==='frost'){
      const progress=age/state.warningMs;if(progress>.65)image(floor,key,'warn',state,.15+.35*(progress-.65)/.35);return true;
    }
    if(style==='poison'||style==='binding'){
      const progress=age/state.warningMs;if(progress>.65){const i=Math.min(3,Math.floor((progress-.65)/.35*4));image(floor,key,INTRO[style==='poison'?0:i],state,style==='poison'?.22:.55);if(style==='poison')floor.setRotation((Math.abs(Math.floor(state.x/110)+Math.floor(state.y/110))%4)*Math.PI/2);}
      return true;
    }
    if(!falling)return false;
    if(age/state.warningMs>.65)image(floor,key,GROUND[0],state,.25);
    if(after>=-150){const u=(after+150)/150;image(flare,key,'fall',state,.9);flare.clearMask().setPosition(state.x,state.y-r*(1-u)**2);}
    return true;
  }
  const persistent=state.kind==='POISON'||state.kind==='FROST';
  if(falling&&after>=650)return true;
  const index=meteor?referenceImpactIndex(after):Math.floor(after/90)%8;
  let alpha=tailAlpha;
  if(persistent)alpha=Math.min(1,.25+after/120)*Math.min(1,Math.max(0,(state.duration-after)/150));
  if(falling)alpha=after<350?1:Math.max(0,(650-after)/300)*.5;
  const moteIndex=style==='frost'||style==='binding'||style==='sand'?(after<360?Math.min(3,Math.floor(after/90)):4+Math.floor((after-360)/90)%4):index;
  image(floor,key,style==='poison'&&after<240?INTRO[Math.min(3,Math.floor(after/60))]:GROUND[style==='sand'?moteIndex:index],state,.8*alpha);
  if(style==='poison')floor.setRotation((Math.abs(Math.floor(state.x/110)+Math.floor(state.y/110))%4)*Math.PI/2);
  const releaseMs=style==='sand'?360:280;
  const releasing=(style==='binding'||style==='sand')&&state.duration-after<=releaseMs;
  const airFrame=releasing?RELEASE[Math.min(3,Math.floor((releaseMs-Math.max(0,state.duration-after))/(releaseMs/4)))]:MOTES[moteIndex];
  if(style==='sand'&&releasing)floor.setAlpha(.8*alpha*Math.max(0,(state.duration-after)/releaseMs));
  image(flare,key,airFrame,state,.8*alpha);flare.setMask(layers.mask);
  if(style==='sand'&&layers.swirls){
    const seed=state.x*.013+state.y*.007;
    for(let i=0;i<3;i++){
      const swirl=layers.swirls[i],config=SAND_SWIRLS[i],local=after-config.delay;
      if(local<0){swirl.setVisible(false);continue;}
      const remaining=state.duration-after,release=360+i*40;
      const frame=remaining<=release?RELEASE[Math.min(3,Math.floor((release-Math.max(0,remaining))/(release/4)))]:MOTES[local<360?Math.min(3,Math.floor(local/90)):4+Math.floor((local-360)/90)%4];
      const spread=sandstormSpread(local,state.duration-config.delay);
      const a=seed+config.phase+local*config.speed;
      const dx=Math.cos(a)*r*config.reach*spread,dy=Math.sin(a)*r*config.reach*spread;
      const scale=config.scale+(config.endScale-config.scale)*spread;
      image(swirl,key,frame,state,config.alpha*alpha*Math.min(1,.3+local/120));
      swirl.setDisplaySize(2*r*scale,2*r*scale).setPosition(state.x+dx,state.y+dy)
        .setDepth(34+dy/r*.4).setMask(layers.mask);
    }
  }
  detail.setVisible(true);
  if(meteor&&style!=='earth'){
    const progress=Math.min(1,Math.max(0,(after-40)/150)),wave=r*progress,fade=after<=190?1:Math.max(0,1-(after-190)/150);
    if(wave>2&&fade>0)detail.lineStyle(2.6,color,fade).strokeCircle(state.x,state.y,Math.max(0,wave-1.3));
  }else if(style==='sand'){
    const spread=sandstormSpread(after,state.duration),wave=r*(.18+.78*spread);
    for(let n=0;n<6;n++){
      const a=n*Math.PI/3+spread*.6;
      detail.lineStyle(7,color,.12*alpha).beginPath().arc(state.x,state.y,wave,a,a+.48).strokePath();
      detail.lineStyle(1.4,color,.4*alpha).beginPath().arc(state.x,state.y,wave,a,a+.3).strokePath();
    }
  }else if(style==='binding'){
    const distance=r*(.62-.48*Math.min(1,after/240));
    detail.lineStyle(1.2,color,.45*alpha);
    for(let n=0;n<4;n++){const a=n*Math.PI/2;detail.lineBetween(state.x+Math.cos(a)*r*.78,state.y+Math.sin(a)*r*.78,state.x+Math.cos(a)*distance,state.y+Math.sin(a)*distance);}
  }else if(style!=='poison')detail.lineStyle(2,color,.8*alpha).strokeCircle(state.x,state.y,r-1);
  if(meteor&&after<70){
    detail.fillStyle(color,(1-after/70)*.28).fillCircle(state.x,state.y,r*.22);
    detail.fillStyle(0xfff4ed,1-after/70).fillCircle(state.x,state.y,r*.08);
  }
  return true;
}
