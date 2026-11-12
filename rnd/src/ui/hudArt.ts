import type Phaser from 'phaser';
import image from '../assets/hud-v1/atlas.png';
import data from '../assets/hud-v1/atlas.json?url';

export const REFERENCE_HUD='reference_hud';
export const HUD_ART={image,data};

/** Fixed-resolution composite skins preserve the mockup's relative leaf/jewel placement. */
export function hudArt(scene:Phaser.Scene,frame:'top'|'stage',x:number,y:number,width:number,height:number):Phaser.GameObjects.Image {
  return scene.add.image(x,y,REFERENCE_HUD,frame).setOrigin(0).setDisplaySize(width,height).setDepth(50);
}
