import Phaser from 'phaser';
import image from '../assets/bottom-hud-v1/atlas.png';
import data from '../assets/bottom-hud-v1/atlas.json?url';
import {FANTASY} from './fantasyTheme';
import {providedIcon} from './providedArt';
import {hudLabel} from './battleHudText';

export const BOTTOM_HUD='bottom_hud';
export const BOTTOM_HUD_ART={image,data};

export function bottomSkin(scene:Phaser.Scene,frame:string,x:number,y:number,width:number,height:number):Phaser.GameObjects.Image|Phaser.GameObjects.NineSlice {
  if(scene.game.renderer.type===Phaser.WEBGL)
    return scene.add.nineslice(x,y,BOTTOM_HUD,frame,width,height,14,14,14,14).setOrigin(0).setName('bottom-skin');
  return scene.add.image(x,y,BOTTOM_HUD,frame).setOrigin(0).setDisplaySize(width,height).setName('bottom-skin');
}

/** Small native symbols and existing icons; all labels and numbers remain live text. */
export function bottomIcon(scene:Phaser.Scene,kind:string,x:number,y:number,size:number):Phaser.GameObjects.Container {
  const c=scene.add.container(x,y).setName('icon');
  const existing=providedIcon(scene,kind,0,0,size);
  if(existing){c.add(existing);return c;}
  const g=scene.add.graphics();c.add(g);g.lineStyle(1,0x5f2b30).fillStyle(FANTASY.gold);
  if(kind==='people'){
    for(const[px,py,s]of[[-6,0,.8],[6,0,.8],[0,-3,1]]){
      g.fillCircle(px,py-5,3*s);g.fillRoundedRect(px-4*s,py,8*s,9*s,1);
    }
  }else if(kind==='chest'){
    g.fillRoundedRect(-10,-7,20,16,2).lineStyle(2,0x8e4936).strokeRect(-10,-7,20,16);
    g.lineBetween(-10,-1,10,-1).lineBetween(-6,-7,-6,9).lineBetween(6,-7,6,9);
    g.fillStyle(0xfff4c6).fillRect(-2,-3,4,5);
  }else if(kind==='sun'){
    for(let i=0;i<8;i++){const a=i*Math.PI/4,b=a+.2,d=a-.2;
      g.fillTriangle(Math.cos(a)*11,Math.sin(a)*11,Math.cos(b)*6,Math.sin(b)*6,Math.cos(d)*6,Math.sin(d)*6);}
    g.fillCircle(0,0,4);
  }else if(kind==='tent'){
    g.fillTriangle(0,-10,-12,10,12,10).lineStyle(2,0xffedab).strokeTriangle(0,-10,-12,10,12,10);
    g.fillStyle(0x41204f).fillTriangle(0,-5,-5,10,5,10);
    g.lineBetween(0,-15,0,-9).fillStyle(0xffd966).fillTriangle(0,-15,9,-12,0,-10);
  }else if(kind==='door'){
    g.lineStyle(3,0xe4b8ff).strokeRoundedRect(-9,-12,16,24,2);
    g.fillStyle(0xae6be0).fillRect(-2,-7,13,19).fillStyle(0xf5dcff).fillTriangle(0,0,6,4,0,8);
  }
  c.setScale(size/26);return c;
}

/** The visual skin never owns input; the stable transparent hit target does. */
export function bottomButton(scene:Phaser.Scene,x:number,y:number,width:number,height:number,frame:string,
  title:string,subtitle:string,icon:string,action:()=>void):Phaser.GameObjects.Container {
  const c=scene.add.container(x,y).setDepth(65),skin=bottomSkin(scene,frame,-width/2,-height/2,width,height);
  const hit=scene.add.rectangle(0,0,width,88,0,0).setInteractive().setName('hit');
  const hasStatus=subtitle.length>0;
  const label=hudLabel(scene,0,hasStatus?-2:8,title==='원정 정비'?24:title==='상세 ›'?22:20)
    .setText(title).setOrigin(.5).setName('label');
  const status=hudLabel(scene,0,24,14,'#d1c1e4').setText(subtitle).setOrigin(.5).setName('status');
  const emblem=bottomIcon(scene,icon,0,hasStatus?-27:-20,hasStatus?20:24);
  c.add([skin,hit,emblem,label,status]);
  const pressed=(down:boolean)=>{skin.y=-height/2+(down?2:0);skin.setAlpha(down?.85:1);};
  hit.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,e:Phaser.Types.Input.EventData)=>{
    e.stopPropagation();pressed(true);action();
  });
  hit.on('pointerup',()=>pressed(false));hit.on('pointerout',()=>pressed(false));return c;
}
