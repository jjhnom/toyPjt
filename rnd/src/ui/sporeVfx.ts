import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import type {BossAreaLayers} from './bossAreaQuality';
export const SPORE_ATLAS='swamp_spores_v1';
/** Cached pulsating spore sacs and liquid bursts. Uses the hazard's moving position and collision time. */
export function prepareSporeTextures(scene:Phaser.Scene):void {
  if(scene.textures.exists(SPORE_ATLAS))return;
  try{
    const t=scene.textures.createCanvas(SPORE_ATLAS,528,396);if(!t)return;
    const c=t.getContext();let cell=0;
    const frame=(name:string,draw:()=>void)=>{
      const x=cell%4*132+2,y=Math.floor(cell/4)*132+2;cell++;
      c.save();c.translate(x,y);draw();c.restore();t.add(name,0,x,y,128,128);
    };
    for(let i=0;i<4;i++)frame('orb_'+i,()=>{
      const r=40+2*Math.sin(i*Math.PI/2),g=c.createRadialGradient(75,47,2,64,64,r);
      g.addColorStop(0,'#ecffb6');g.addColorStop(.25,'#b6e96a');g.addColorStop(.7,'#689d35');g.addColorStop(1,'#304e27');
      c.fillStyle=g;c.beginPath();c.arc(64,64,r,0,Math.PI*2);c.fill();
      c.strokeStyle='#dcff9c';c.lineWidth=2;c.stroke();
      for(let n=0;n<7;n++){
        const a=n*2.399,x=64+Math.cos(a)*26,y=64+Math.sin(a)*26;
        c.fillStyle=n%2?'#8cbf45':'#d0f485';c.beginPath();c.arc(x,y,4+n%3,0,Math.PI*2);c.fill();
      }
      c.strokeStyle='rgba(241,255,188,.85)';c.lineWidth=4;c.beginPath();c.arc(64,64,r*.78,-1.4,-.5);c.stroke();
      for(let n=0;n<3;n++){c.fillStyle=`rgba(167,221,80,${.6-n*.15})`;c.beginPath();c.ellipse(13-n*4,57+n*8,7-n,3,0,0,Math.PI*2);c.fill();}
    });
    for(let i=0;i<6;i++)frame('burst_'+i,()=>{
      const u=i/5;c.globalAlpha=1-u*.9;
      c.strokeStyle='#c4ed7a';c.lineWidth=4*(1-u)+1;c.beginPath();c.arc(64,64,12+u*43,0,Math.PI*2);c.stroke();
      for(let n=0;n<12;n++){
        const a=n*2.399,r=15+u*40,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;
        c.strokeStyle='#85bb41';c.lineWidth=3;c.beginPath();c.moveTo(x-Math.cos(a)*12,y-Math.sin(a)*12);c.lineTo(x,y);c.stroke();
        c.fillStyle='#c1ed75';c.beginPath();c.ellipse(x,y,4+n%3,3,a,0,Math.PI*2);c.fill();
      }
    });
    t.refresh().setFilter(0);
  }catch{if(scene.textures.exists(SPORE_ATLAS))scene.textures.remove(SPORE_ATLAS);}
}
export function renderSpores(scene:Phaser.Scene,layers:BossAreaLayers,state:HazardView,age:number):boolean {
  if(!scene.textures.exists(SPORE_ATLAS))return false;
  const {floor,flare}=layers,after=age-state.warningMs,r=state.radius;
  const burst=state.impactAge===null||state.impactAge===undefined?-1:age-state.impactAge;
  if(burst>=0){
    if(burst>=300)return true;
    floor.setTexture(SPORE_ATLAS,'burst_'+Math.min(5,Math.floor(burst/50))).setCrop().setRotation(0).setOrigin(.5)
      .setPosition(state.x,state.y).setDisplaySize(r*3,r*3).clearMask().setAlpha(1-burst/300).setVisible(true);
    return true;
  }
  flare.setTexture(SPORE_ATLAS,'orb_'+Math.floor(age/100)%4).setCrop().clearTint().setFlipX(false).clearMask()
    .setOrigin(.5).setRotation(Math.atan2(state.velocityY,state.velocityX)).setPosition(state.x,state.y)
    .setDisplaySize(r*3,r*3).setAlpha(after<0?.25+.65*age/state.warningMs:1).setVisible(true);
  return true;
}
