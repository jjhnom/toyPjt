import type Phaser from 'phaser';
import {BOSS_ATLAS,bossEffectFrame} from '../config/bossVisualData';
import {BOSS_VFX_ATLAS,bossVfxFrameIndex} from '../config/bossVfxMotionData';

/** Forest METEOR only. Packed 96px impact frames: bright ground-ring footprints, not canvas bounds.
 * Lower halves measured at alpha>120, R>200, G>150, B<190; upper blast/rocks excluded.
 * [left, top, width, height], where top+height/2 is the ground plane's center line.
 * Per-frame normalization cancels the source ring's growth/drift without changing damage radius.
 */
export const FOREST_SLAM_VISUAL={
  animated:{atlas:'forest_slam_core_v2',playMs:480,decorWidth:50,footprints:[
    [32,60,34,12],[28,60,37,12],[26,60,42,12],[25,59,47,14],
    [23,59,50,14],[24,59,48,14],[26,59,45,14],[23,59,47,14]
  ]},
  legacy:{atlas:'forest_slam_core_v1',playMs:280,decorWidth:57,footprints:[
    [27,64,45,14],[18,64,53,14],[14,62,57,18],[16,63,54,16]
  ]}
} as const;
export const forestSlamVisual=(animated:boolean)=>animated?FOREST_SLAM_VISUAL.animated:FOREST_SLAM_VISUAL.legacy;
export const forestSlamCoreFrame=(index:number):string=>`forest_slam_core_${index}`;
export const forestSlamDebrisAtlas=(animated:boolean):string=>animated?'forest_slam_debris_v2':'forest_slam_debris_v1';
export const forestSlamDebrisFrame=(index:number):string=>`forest_slam_debris_${index}`;
export function forestSlamFrameIndex(animated:boolean,after:number):number {
  const config=forestSlamVisual(animated);return bossVfxFrameIndex(after/config.playMs,config.footprints.length);
}

/** One small cached atlas per source version. No PNG changes, frame-time readback, timers or live particles.
 * Normalize the ring's clean lower half to the damage plane; mirror it to exclude upright debris.
 * A pixel annulus reinforces its outer edge so every frame communicates the full instantaneous hit.
 */
export function prepareForestSlamTextures(scene:Phaser.Scene):void {
  for(const animated of [true,false]){
    const config=forestSlamVisual(animated),key=config.atlas,debrisKey=forestSlamDebrisAtlas(animated),sourceKey=animated?BOSS_VFX_ATLAS:BOSS_ATLAS;
    if(!scene.textures.exists(sourceKey))continue;
    const source=scene.textures.get(sourceKey);
    if(scene.textures.exists(key)){
      if(!scene.textures.exists(debrisKey))prepareForestDebris(scene,source,animated,debrisKey);
      continue;
    }
    try{
      const texture=scene.textures.createCanvas(key,config.footprints.length*100,100);if(!texture)continue;
      const ctx=texture.getContext();ctx.imageSmoothingEnabled=false;
      for(const [i,rect]of config.footprints.entries()){
        const name=bossEffectFrame('forest_guardian','impact',i);if(!source.has(name))throw new Error('Missing forest impact frame');
        const f=source.get(name),[left,top,width,height]=rect,x=i*100+2;
        ctx.save();ctx.translate(x+48,50);ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.clip();
        ctx.drawImage(f.source.image as HTMLImageElement,f.cutX+left,f.cutY+top+height/2,width,height/2,-48,0,96,48);
        ctx.scale(1,-1);
        ctx.drawImage(f.source.image as HTMLImageElement,f.cutX+left,f.cutY+top+height/2,width,height/2,-48,0,96,48);
        ctx.restore();
        // Keep the actual golden shockwave; brown dust belongs to the upright decoration layer.
        const pixels=ctx.getImageData(x,2,96,96);
        for(let p=0;p<pixels.data.length;p+=4){
          const px=p/4%96,py=Math.floor(p/4/96);
          if((px+.5-48)**2+(py+.5-48)**2<42.5**2||pixels.data[p]<=200||pixels.data[p+1]<=150||pixels.data[p+2]>=190)pixels.data[p+3]=0;
        }
        ctx.putImageData(pixels,x,2);
        // Fine ground fractures avoid stretching the source's few dust rows into large blocks.
        ctx.fillStyle='#ad8549';
        for(const angle of [.2,1.6,2.8,4.2,5.1])for(let r=8;r<39;r++){
          const bend=angle+Math.sin(r*.45)*.075;
          ctx.fillRect(x+48+Math.floor(Math.cos(bend)*r),50+Math.floor(Math.sin(bend)*r),1,1);
        }
        // Pixel-center coverage stays inside the 48px radius; constant silhouette at every sample.
        ctx.fillStyle='#ffdd77';
        for(let py=0;py<96;py++)for(let px=0;px<96;px++){
          const d=(px+.5-48)**2+(py+.5-48)**2;
          if(d>48**2)ctx.clearRect(x+px,2+py,1,1);
          else if(d>46.5**2)ctx.fillRect(x+px,2+py,1,1);
        }
        texture.add(forestSlamCoreFrame(i),0,x,2,96,96);
      }
      texture.refresh().setFilter(0);
      prepareForestDebris(scene,source,animated,debrisKey);
    }catch{if(scene.textures.exists(key))scene.textures.remove(key);}
  }
}

/** Reuse small earth/leaf patches around the impact, rather than cropping a single upward plume.
 * All eight directions share the same age and fade; the center stays open for the boss silhouette.
 * Baked at load time so this still uses one pooled decoration image, not eight live particles.
 */
function prepareForestDebris(scene:Phaser.Scene,source:Phaser.Textures.Texture,animated:boolean,key:string):void {
  if(scene.textures.exists(key))return;
  const config=forestSlamVisual(animated);
  try{
    const texture=scene.textures.createCanvas(key,config.footprints.length*100,100);if(!texture)return;
    const ctx=texture.getContext();ctx.imageSmoothingEnabled=false;
    for(let i=0;i<config.footprints.length;i++){
      const kind=animated?'field':'impact',name=bossEffectFrame('forest_guardian',kind,i);
      if(!source.has(name))throw new Error('Missing forest debris frame');
      const f=source.get(name),x=i*100+2,progress=i/(config.footprints.length-1);
      const spread=18+progress*14,size=16+progress*6;
      ctx.save();ctx.beginPath();ctx.arc(x+48,50,47,0,Math.PI*2);ctx.clip();
      for(let direction=0;direction<8;direction++){
        const angle=direction*Math.PI/4,cx=x+48+Math.cos(angle)*spread,cy=50+Math.sin(angle)*spread;
        const sourceX=18+(direction*11)%36,sourceY=animated?54+direction%2*2:52+direction%2*3;
        ctx.globalAlpha=.8;
        ctx.drawImage(f.source.image as HTMLImageElement,f.cutX+sourceX,f.cutY+sourceY,24,22,
          Math.round(cx-size/2),Math.round(cy-size*22/24/2),Math.round(size),Math.round(size*22/24));
      }
      ctx.restore();
      // Legacy impact includes a bright vertical flash; retain only earth and foliage here.
      const pixels=ctx.getImageData(x,2,96,96);
      for(let p=0;p<pixels.data.length;p+=4){
        const r=pixels.data[p],g=pixels.data[p+1],b=pixels.data[p+2];
        if(r>215&&g>145||b>g*1.3)pixels.data[p+3]=0;
      }
      ctx.putImageData(pixels,x,2);texture.add(forestSlamDebrisFrame(i),0,x,2,96,96);
    }
    texture.refresh().setFilter(0);
  }catch{if(scene.textures.exists(key))scene.textures.remove(key);}
}

/** Debris uses a centered ground-plane atlas. It never inherits the source sheet's foot origin
 * or upper-half crop, which previously left the whole lower semicircle visually empty.
 */
export function placeForestSlamDebris(image:Phaser.GameObjects.Image,animated:boolean,index:number,x:number,y:number,radius:number):void {
  image.setTexture(forestSlamDebrisAtlas(animated),forestSlamDebrisFrame(index)).setOrigin(.5).setPosition(x,y)
    .setDisplaySize(radius*2,radius*2).setCrop().clearMask();
}
