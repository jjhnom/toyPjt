import type Phaser from 'phaser';
import {LAVA_METEOR} from './lavaMeteorVfx';

export const TWILIGHT_METEOR_ATLAS='twilight_meteor_v1';
/** Copy the proven meteor geometry/timeline into a separate violet atlas. Alpha and frame bounds
 * stay identical, so only attack.radius controls scale. Never tint or mutate the lava texture.
 */
export function prepareTwilightMeteorTextures(scene:Phaser.Scene):void {
  const key=TWILIGHT_METEOR_ATLAS;
  if(scene.textures.exists(key)||!scene.textures.exists(LAVA_METEOR.atlas))return;
  try{
    const source=scene.textures.get(LAVA_METEOR.atlas),img=source.getSourceImage() as HTMLCanvasElement;
    const texture=scene.textures.createCanvas(key,img.width,img.height);if(!texture)return;
    const ctx=texture.getContext();ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0);
    const pixels=ctx.getImageData(0,0,img.width,img.height),d=pixels.data;
    for(let p=0;p<d.length;p+=4){
      if(!d[p+3])continue;
      const r=d[p],g=d[p+1],b=d[p+2],light=Math.max(r,g,b);
      if(r>=240&&g>=230&&b>=180){d[p]=255;d[p+1]=235;d[p+2]=255;}
      else{d[p]=Math.min(255,Math.round(light*.88+10));d[p+1]=Math.round(g*.42);d[p+2]=Math.min(255,Math.round(light*.98+12));}
    }
    ctx.putImageData(pixels,0,0);
    for(const name of source.getFrameNames()){
      const f=source.get(name);texture.add(name,0,f.cutX,f.cutY,f.cutWidth,f.cutHeight);
    }
    texture.refresh().setFilter(0);
  }catch{if(scene.textures.exists(key))scene.textures.remove(key);}
}
