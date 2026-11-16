import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import type {BossAreaLayers} from './bossAreaQuality';
export const TWILIGHT_SLASH_ATLAS='twilight_slash_v1';
/** Six cached blade ribbons; the capsule mask and hit geometry share the same endpoints. */
export function prepareTwilightSlashTextures(scene:Phaser.Scene):void {
  if(scene.textures.exists(TWILIGHT_SLASH_ATLAS))return;
  try{
    const t=scene.textures.createCanvas(TWILIGHT_SLASH_ATLAS,528,136);if(!t)return;
    const c=t.getContext();
    for(let i=0;i<6;i++){
      const x=i%4*132+2,y=Math.floor(i/4)*68+2,u=i/5;
      c.save();c.translate(x,y);
      const glow=c.createLinearGradient(0,32,128,32);glow.addColorStop(0,'rgba(130,54,209,0)');glow.addColorStop(.2,'rgba(169,87,247,.5)');glow.addColorStop(.65,'rgba(221,162,255,.9)');glow.addColorStop(1,'rgba(133,69,237,0)');
      c.fillStyle=glow;c.beginPath();c.moveTo(0,32);c.quadraticCurveTo(73,8+u*8,128,32);c.quadraticCurveTo(56,57-u*10,0,32);c.fill();
      c.fillStyle=i<2?'#fff1ff':'#d2a1ff';c.beginPath();c.moveTo(0,32);c.quadraticCurveTo(83,23+u*6,128,31);c.quadraticCurveTo(60,37,0,32);c.fill();
      c.strokeStyle='rgba(241,202,255,.8)';c.lineWidth=1.3;
      for(let n=0;n<5;n++){const q=18+n*21;c.beginPath();c.moveTo(q-9,32);c.lineTo(q,20-u*8);c.lineTo(q+3,33);c.lineTo(q+9,42+u*5);c.stroke();}
      c.restore();t.add('slash_'+i,0,x,y,128,64);
    }
    t.refresh().setFilter(0);
  }catch{if(scene.textures.exists(TWILIGHT_SLASH_ATLAS))scene.textures.remove(TWILIGHT_SLASH_ATLAS);}
}
export function renderTwilightSlash(scene:Phaser.Scene,layers:BossAreaLayers,state:HazardView,age:number):boolean {
  if(!scene.textures.exists(TWILIGHT_SLASH_ATLAS)||state.fromX===null||state.fromY===null)return false;
  const {flare,detail}=layers,x=state.fromX,y=state.fromY,dx=state.x-x,dy=state.y-y;
  const length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),after=age-state.warningMs;
  detail.setVisible(true);
  if(after<0){
    const p=Math.min(1,age/state.warningMs);
    detail.lineStyle(7,0xb674ef,.18+.25*p).lineBetween(x,y,state.x,state.y)
      .lineStyle(1.5,0xf1c6ff,.35+.45*p).lineBetween(x,y,state.x,state.y);
    return true;
  }
  if(after>=500)return true;
  const fade=1-after/500;
  flare.setTexture(TWILIGHT_SLASH_ATLAS,'slash_'+Math.min(5,Math.floor(after/80))).setCrop().clearTint().setFlipX(false)
    .setOrigin(.5).setPosition((x+state.x)/2,(y+state.y)/2).setDisplaySize(length+state.radius*2,state.radius*2)
    .setRotation(angle).setMask(layers.mask).setAlpha(fade).setVisible(true);
  detail.lineStyle(state.radius*.7,0x6d24af,fade*.5).lineBetween(x,y,state.x,state.y)
    .lineStyle(2.5,0xffdcff,fade*.9).lineBetween(x,y,state.x,state.y);
  if(length>0)for(let n=0;n<8;n++){
    const u=(n+.5)/8,cx=x+dx*u,cy=y+dy*u,side=n%2?1:-1,spread=state.radius*(.2+.7*after/500);
    detail.lineStyle(1.5,0xe7b6ff,fade*.8).lineBetween(cx,cy,cx-dy/length*spread*side,cy+dx/length*spread*side);
  }
  return true;
}
