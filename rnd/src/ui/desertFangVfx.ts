import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import type {BossAreaLayers} from './bossAreaQuality';
export const DESERT_FANG_ATLAS='desert_fang_v1';

function fang(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,tilt:number):void {
  c.save();c.translate(x,y);c.rotate(tilt);
  c.fillStyle='#7d4a28';c.beginPath();c.moveTo(-w*.6,0);c.lineTo(-w*.36,-h*.55);c.lineTo(w*.1,-h);c.lineTo(w*.55,-h*.65);c.lineTo(w*.65,0);c.closePath();c.fill();
  c.fillStyle='#d89d4f';c.beginPath();c.moveTo(-w*.36,-h*.55);c.lineTo(w*.1,-h);c.lineTo(w*.55,-h*.65);c.lineTo(w*.13,-h*.18);c.lineTo(-w*.6,0);c.closePath();c.fill();
  c.fillStyle='#ffe0a0';c.beginPath();c.moveTo(w*.1,-h);c.lineTo(w*.55,-h*.65);c.lineTo(w*.13,-h*.18);c.closePath();c.fill();
  c.strokeStyle='#a76833';c.lineWidth=1.8;
  for(let n=1;n<4;n++){c.beginPath();c.moveTo(-w*.32,-h*n*.19);c.lineTo(w*.28,-h*n*.19-3);c.stroke();}
  c.restore();
}
/** Cached sandstone, flying gravel and dust. No runtime particles or extra images. */
export function prepareDesertFangTextures(scene:Phaser.Scene):void {
  if(scene.textures.exists(DESERT_FANG_ATLAS))return;
  try{
    const t=scene.textures.createCanvas(DESERT_FANG_ATLAS,528,528);if(!t)return;
    const c=t.getContext();let cell=0;
    const frame=(name:string,draw:()=>void)=>{
      const x=cell%4*132+2,y=Math.floor(cell/4)*132+2;cell++;
      c.save();c.translate(x,y);draw();c.restore();t.add(name,0,x,y,128,128);
    };
    const ground=(strength:number)=>{
      const g=c.createRadialGradient(64,64,5,64,64,60);g.addColorStop(0,`rgba(227,173,88,${strength*.6})`);g.addColorStop(1,'rgba(176,116,46,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
      for(let n=0;n<7;n++){
        const a=n*2.399;c.beginPath();c.moveTo(64+Math.cos(a)*10,64+Math.sin(a)*10);c.lineTo(64+Math.cos(a+.15)*29,64+Math.sin(a+.15)*29);c.lineTo(64+Math.cos(a)*54,64+Math.sin(a)*54);
        c.strokeStyle=`rgba(91,54,24,${strength})`;c.lineWidth=3;c.stroke();
        c.strokeStyle=`rgba(255,214,136,${strength*.8})`;c.lineWidth=1;c.stroke();
      }
    };
    frame('warn',()=>ground(.75));
    for(let i=0;i<6;i++){
      const u=i/5;
      frame('ground_'+i,()=>{
        ground(1-u*.65);c.strokeStyle=`rgba(248,206,133,${1-u})`;c.lineWidth=3;
        c.beginPath();c.ellipse(64,64,18+u*40,12+u*38,0,0,Math.PI*2);c.stroke();
      });
      frame('fang_'+i,()=>{
        const h=[24,62,91,78,36,0][i];
        if(h>0){fang(c,45,109,21,h*.65,-.24);fang(c,84,109,23,h*.72,.25);fang(c,64,110,32,h,0);}
        for(let n=0;n<16;n++){
          const a=n*2.399,r=12+u*42,x=64+Math.cos(a)*r,y=107+Math.sin(a)*r*.3-28*Math.sin(u*Math.PI);
          c.save();c.translate(x,y);c.rotate(a+u);c.globalAlpha=1-u*.75;
          c.fillStyle=n%3?'#b77e41':'#f2cb87';c.fillRect(-3,-3,5+n%3,4+n%2);c.restore();
        }
        for(let n=0;n<4;n++){
          const x=38+n*17,y=108-14*u,g=c.createRadialGradient(x,y,0,x,y,14+u*9);
          g.addColorStop(0,`rgba(238,194,123,${.25*(1-u*.6)})`);g.addColorStop(1,'rgba(208,157,83,0)');
          c.fillStyle=g;c.fillRect(x-25,y-25,50,50);
        }
      });
    }
    t.refresh().setFilter(0);
  }catch{if(scene.textures.exists(DESERT_FANG_ATLAS))scene.textures.remove(DESERT_FANG_ATLAS);}
}
export function renderDesertFangs(scene:Phaser.Scene,layers:BossAreaLayers,state:HazardView,age:number,alpha:number):boolean {
  if(!scene.textures.exists(DESERT_FANG_ATLAS))return false;
  const {floor,flare}=layers,r=state.radius,after=age-state.warningMs;
  floor.setTexture(DESERT_FANG_ATLAS,after<0?'warn':'ground_'+Math.min(5,Math.floor(after/100)))
    .setCrop().setOrigin(.5).setRotation(0).setPosition(state.x,state.y).setDisplaySize(r*2,r*2)
    .setAlpha(after<0?.3+.5*age/state.warningMs:alpha*Math.max(0,1-after/600)).setVisible(after<600);
  if(after>=0&&after<600)flare.setTexture(DESERT_FANG_ATLAS,'fang_'+Math.min(5,Math.floor(after/100)))
    .setCrop().clearTint().setRotation(0).setFlipX(false).clearMask().setOrigin(.5,110/128)
    .setPosition(state.x,state.y).setDisplaySize(r*2,r*3).setAlpha(alpha).setVisible(true);
  return true;
}
