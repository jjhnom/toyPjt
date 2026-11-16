import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import type {BossAreaLayers} from './bossAreaQuality';
export const FOREST_ROOT_ATLAS='forest_roots_v1';
function root(c:CanvasRenderingContext2D,x:number,y:number,height:number,lean:number):void {
  if(height<=0)return;
  c.save();c.translate(x,y);c.rotate(lean);c.scale(1,height/90);
  const g=c.createLinearGradient(-14,0,12,-85);g.addColorStop(0,'#432d22');g.addColorStop(.55,'#87603a');g.addColorStop(1,'#b99b57');
  c.fillStyle=g;c.beginPath();c.moveTo(-17,0);c.bezierCurveTo(-20,-28,9,-37,-2,-57);c.bezierCurveTo(-12,-73,8,-84,11,-90);
  c.bezierCurveTo(27,-62,8,-55,17,-40);c.bezierCurveTo(26,-24,12,-13,19,0);c.closePath();c.fill();
  c.strokeStyle='#c6ab68';c.lineWidth=2;c.beginPath();c.moveTo(-5,-6);c.bezierCurveTo(-5,-27,14,-34,6,-56);c.stroke();
  for(const sign of [-1,1]){
    c.strokeStyle='#61462c';c.lineWidth=7;c.beginPath();c.moveTo(5,-35);c.quadraticCurveTo(sign*34,-45,sign*26,-67);c.stroke();
    c.strokeStyle='#a0c65a';c.lineWidth=2;c.stroke();
    c.fillStyle='#93ca58';c.beginPath();c.ellipse(sign*26,-67,10,4,sign*.7,0,Math.PI*2);c.fill();
    for(let n=0;n<3;n++){
      const y=-18-n*19;c.fillStyle=n%2?'#8eae4a':'#c1d974';c.beginPath();c.moveTo(sign*10,y);c.lineTo(sign*25,y-11);c.lineTo(sign*11,y-8);c.closePath();c.fill();
    }
  }
  c.restore();
}
/** Cached bark, thorns, leaves and soil; no runtime objects beyond the shared two-image slots. */
export function prepareForestRootTextures(scene:Phaser.Scene):void {
  if(scene.textures.exists(FOREST_ROOT_ATLAS))return;
  try{
    const t=scene.textures.createCanvas(FOREST_ROOT_ATLAS,528,528);if(!t)return;
    const c=t.getContext();let cell=0;
    const frame=(name:string,draw:()=>void)=>{
      const x=cell%4*132+2,y=Math.floor(cell/4)*132+2;cell++;
      c.save();c.translate(x,y);draw();c.restore();t.add(name,0,x,y,128,128);
    };
    const soil=(alpha:number)=>{
      const g=c.createRadialGradient(64,64,8,64,64,60);g.addColorStop(0,`rgba(111,150,59,${alpha*.35})`);g.addColorStop(1,'rgba(47,74,32,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
      c.lineCap='round';
      for(let n=0;n<7;n++){
        const a=n*2.399;c.strokeStyle=`rgba(76,53,31,${alpha})`;c.lineWidth=5;
        c.beginPath();c.moveTo(64+Math.cos(a)*10,64+Math.sin(a)*10);c.quadraticCurveTo(64+Math.cos(a+.4)*30,64+Math.sin(a+.4)*30,64+Math.cos(a)*53,64+Math.sin(a)*53);c.stroke();
        c.strokeStyle=`rgba(175,214,105,${alpha*.75})`;c.lineWidth=1.2;c.stroke();
      }
    };
    frame('warn',()=>soil(.7));
    for(let i=0;i<6;i++){
      const u=i/5;
      frame('ground_'+i,()=>soil(1-u*.55));
      frame('root_'+i,()=>{
        const h=[24,60,88,82,45,0][i];
        root(c,44,111,h*.65,-.32);root(c,86,111,h*.72,.3);root(c,64,112,h,0);
        for(let n=0;n<12;n++){
          const a=n*2.399,r=12+u*39,x=64+Math.cos(a)*r,y=108+Math.sin(a)*r*.3-17*Math.sin(u*Math.PI);
          c.save();c.translate(x,y);c.rotate(a+u);c.globalAlpha=1-u*.65;
          c.fillStyle=n%3?'#75aa48':'#7e5933';c.beginPath();c.ellipse(0,0,4+n%3,2.3,0,0,Math.PI*2);c.fill();c.restore();
        }
      });
    }
    t.refresh().setFilter(0);
  }catch{if(scene.textures.exists(FOREST_ROOT_ATLAS))scene.textures.remove(FOREST_ROOT_ATLAS);}
}
export function renderForestRoots(scene:Phaser.Scene,layers:BossAreaLayers,state:HazardView,age:number):boolean {
  if(!scene.textures.exists(FOREST_ROOT_ATLAS))return false;
  const {floor,flare}=layers,r=state.radius,after=age-state.warningMs,remaining=state.duration-after;
  const i=after<300?Math.max(0,Math.floor(after/100)):remaining>300?3:Math.min(5,3+Math.floor((300-remaining)/100));
  floor.setTexture(FOREST_ROOT_ATLAS,after<0?'warn':'ground_'+i).setCrop().setOrigin(.5).setRotation(0)
    .setPosition(state.x,state.y).setDisplaySize(r*2,r*2).setAlpha(after<0?.3+.5*age/state.warningMs:.8*Math.min(1,Math.max(0,remaining/150))).setVisible(remaining>0);
  if(after>=0&&remaining>0)flare.setTexture(FOREST_ROOT_ATLAS,'root_'+i).setCrop().clearTint().setFlipX(false).setRotation(0).clearMask()
    .setOrigin(.5,112/128).setPosition(state.x,state.y).setDisplaySize(r*2.25,r*3).setAlpha(Math.min(1,remaining/150)).setVisible(true);
  return true;
}
