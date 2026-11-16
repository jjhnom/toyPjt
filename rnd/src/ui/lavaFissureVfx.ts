import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import type {BossAreaLayers} from './bossAreaQuality';

export const LAVA_FISSURE_ATLAS='lava_fissure_v1';
/** Baked once: cracking basalt, molten columns and cooling debris share the existing two images. */
export function prepareLavaFissureTextures(scene:Phaser.Scene):void {
  if(scene.textures.exists(LAVA_FISSURE_ATLAS))return;
  try{
    const t=scene.textures.createCanvas(LAVA_FISSURE_ATLAS,528,528);if(!t)return;
    const c=t.getContext();let cell=0;
    const frame=(name:string,draw:()=>void)=>{
      const x=cell%4*132+2,y=Math.floor(cell/4)*132+2;cell++;
      c.save();c.translate(x,y);draw();c.restore();t.add(name,0,x,y,128,128);
    };
    const cracks=(heat:number)=>{
      c.lineCap='round';
      for(let n=0;n<7;n++){
        const a=n*2.399;
        c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.cos(a+.2)*26,64+Math.sin(a+.2)*26);c.lineTo(64+Math.cos(a)*59,64+Math.sin(a)*59);
        c.strokeStyle='#211219';c.lineWidth=8;c.stroke();
        c.strokeStyle=`rgba(255,82,24,${heat})`;c.lineWidth=4;c.stroke();
        c.strokeStyle=`rgba(255,213,106,${heat*.9})`;c.lineWidth=1.3;c.stroke();
      }
    };
    frame('warn',()=>cracks(.8));
    for(let i=0;i<6;i++){
      const u=i/5;
      frame('ground_'+i,()=>{
        const g=c.createRadialGradient(64,64,3,64,64,61);
        g.addColorStop(0,`rgba(255,153,42,${.7*(1-u)})`);g.addColorStop(1,'rgba(255,52,9,0)');
        c.fillStyle=g;c.fillRect(0,0,128,128);cracks(1-u*.9);
        c.strokeStyle=`rgba(255,203,115,${1-u})`;c.lineWidth=3;c.beginPath();c.arc(64,64,14+u*46,0,Math.PI*2);c.stroke();
      });
      frame('column_'+i,()=>{
        const height=[42,78,94,72,36,8][i];
        for(let n=0;n<5;n++){
          const x=44+n*10,h=height*(n===2?1:.58+(n%2)*.25);
          const g=c.createLinearGradient(x,106-h,x,108);g.addColorStop(0,'rgba(255,64,13,0)');g.addColorStop(.25,'#ff631f');g.addColorStop(.7,'#ffb43d');g.addColorStop(1,'#fff2ba');
          c.fillStyle=g;c.beginPath();c.moveTo(x-10,108);c.bezierCurveTo(x-18,86,x+8,106-h*.7,x,106-h);c.bezierCurveTo(x+20,106-h*.6,x+6,90,x+12,108);c.closePath();c.fill();
        }
        for(let n=0;n<12;n++){
          const a=n*2.399,r=14+u*38,x=64+Math.cos(a)*r,y=101+Math.sin(a)*r*.35-Math.sin(u*Math.PI)*30;
          c.save();c.translate(x,y);c.rotate(a+u);c.globalAlpha=1-u*.8;
          c.fillStyle=n%3?'#673329':'#ffbc58';c.fillRect(-3,-3,6+n%3,5);c.fillStyle='#ff7534';c.fillRect(-3,-3,5,1.5);c.restore();
        }
      });
    }
    t.refresh().setFilter(0);
  }catch{if(scene.textures.exists(LAVA_FISSURE_ATLAS))scene.textures.remove(LAVA_FISSURE_ATLAS);}
}
export function renderLavaFissure(scene:Phaser.Scene,layers:BossAreaLayers,state:HazardView,age:number,alpha:number):boolean {
  if(!scene.textures.exists(LAVA_FISSURE_ATLAS))return false;
  const {floor,flare}=layers,r=state.radius,after=age-state.warningMs;
  floor.setTexture(LAVA_FISSURE_ATLAS,after<0?'warn':'ground_'+Math.min(5,Math.floor(after/100)))
    .setCrop().setOrigin(.5).setRotation(0).setPosition(state.x,state.y).setDisplaySize(r*2,r*2)
    .setAlpha(after<0?.3+.55*age/state.warningMs:alpha*Math.max(0,1-after/600)).setVisible(after<600);
  if(after>=0&&after<600){
    flare.setTexture(LAVA_FISSURE_ATLAS,'column_'+Math.min(5,Math.floor(after/100)))
      .setCrop().clearTint().setRotation(0).setFlipX(false).clearMask().setOrigin(.5,106/128)
      .setPosition(state.x,state.y).setDisplaySize(r*2,r*3.1).setAlpha(alpha*Math.max(0,1-after/650)).setVisible(true);
  }
  return true;
}
