import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import type {BossAreaLayers} from './bossAreaQuality';

export const ICE_BARRAGE_ATLAS='ice_barrage_v1';
function shard(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,a:number):void {
  c.save();c.translate(x,y);c.rotate(a);
  c.fillStyle='#3a83b9';c.beginPath();c.moveTo(-w*.5,-h*.2);c.lineTo(-w*.35,-h*.7);c.lineTo(w*.15,-h);c.lineTo(w*.55,-h*.55);c.lineTo(w*.4,0);c.lineTo(-w*.2,h*.15);c.closePath();c.fill();
  c.fillStyle='#a8edff';c.beginPath();c.moveTo(-w*.35,-h*.7);c.lineTo(w*.15,-h);c.lineTo(w*.55,-h*.55);c.lineTo(0,-h*.4);c.closePath();c.fill();
  c.fillStyle='#eaffff';c.beginPath();c.moveTo(w*.15,-h);c.lineTo(w*.55,-h*.55);c.lineTo(w*.4,0);c.lineTo(0,-h*.4);c.closePath();c.fill();c.restore();
}
/** One cached atlas, two existing pooled images. Airborne ice may extend above its ground circle. */
export function prepareIceBarrageTextures(scene:Phaser.Scene):void {
  if(scene.textures.exists(ICE_BARRAGE_ATLAS))return;
  try{
    const t=scene.textures.createCanvas(ICE_BARRAGE_ATLAS,528,528);if(!t)return;
    const c=t.getContext();let cell=0;
    const frame=(name:string,draw:()=>void)=>{
      const x=cell%4*132+2,y=Math.floor(cell/4)*132+2;cell++;
      c.save();c.translate(x,y);draw();c.restore();t.add(name,0,x,y,128,128);
    };
    frame('fall',()=>{
      const g=c.createLinearGradient(64,0,64,96);g.addColorStop(0,'rgba(116,211,255,0)');g.addColorStop(1,'rgba(172,240,255,.8)');
      c.fillStyle=g;c.beginPath();c.moveTo(46,4);c.lineTo(82,4);c.lineTo(92,94);c.lineTo(36,94);c.closePath();c.fill();
      shard(c,64,101,55,53,.12);shard(c,45,88,24,25,-.4);shard(c,82,92,22,30,.35);
    });
    for(let i=0;i<6;i++){
      const u=i/5;
      frame('ground_'+i,()=>{
        c.strokeStyle=`rgba(180,243,255,${1-u*.85})`;c.lineWidth=3*(1-u)+1;
        c.beginPath();c.arc(64,64,12+u*46,0,Math.PI*2);c.stroke();
        for(let n=0;n<7;n++){
          const a=n*Math.PI*2/7;c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.cos(a+.12)*24,64+Math.sin(a+.12)*24);c.lineTo(64+Math.cos(a)*53,64+Math.sin(a)*53);c.stroke();
        }
      });
      frame('burst_'+i,()=>{
        c.globalAlpha=1-u*.9;
        if(i<2){c.fillStyle='rgba(222,253,255,.8)';c.beginPath();c.arc(64,64,26-i*6,0,Math.PI*2);c.fill();}
        for(let n=0;n<12;n++){
          const a=n*2.399,r=12+u*37;
          shard(c,64+Math.cos(a)*r,69+Math.sin(a)*r*.65-12*Math.sin(u*Math.PI),7+n%3*2,12+n%4*3,a+u);
        }
      });
    }
    t.refresh().setFilter(0);
  }catch{if(scene.textures.exists(ICE_BARRAGE_ATLAS))scene.textures.remove(ICE_BARRAGE_ATLAS);}
}
export function renderIceBarrage(scene:Phaser.Scene,layers:BossAreaLayers,state:HazardView,age:number,alpha:number):boolean {
  if(!scene.textures.exists(ICE_BARRAGE_ATLAS))return false;
  const {floor,flare}=layers,after=age-state.warningMs,r=state.radius;
  if(after<0){
    if(after>=-300){
      const u=(after+300)/300;
      flare.setTexture(ICE_BARRAGE_ATLAS,'fall').setCrop().clearTint().setRotation(0).setFlipX(false)
        .clearMask().setOrigin(.5,101/128).setPosition(state.x,state.y-210*(1-u*u))
        .setDisplaySize(r*1.7,r*1.7).setAlpha(.5+.5*u).setVisible(true);
    }
    return true;
  }
  if(after>=600)return true;
  const i=Math.min(5,Math.floor(after/100)),fade=alpha*Math.max(0,1-after/600);
  floor.setTexture(ICE_BARRAGE_ATLAS,'ground_'+i).setCrop().setOrigin(.5).setPosition(state.x,state.y)
    .setDisplaySize(r*2,r*2).setAlpha(fade).setVisible(true);
  flare.setTexture(ICE_BARRAGE_ATLAS,'burst_'+i).setCrop().setOrigin(.5).setPosition(state.x,state.y)
    .setDisplaySize(r*2,r*2).setMask(layers.mask).setAlpha(fade).setVisible(true);
  return true;
}
