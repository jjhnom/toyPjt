import type Phaser from 'phaser';
import type {BossId} from '../types/game';
import type {BossEffect} from '../config/bossVisualData';
import {BOSS_ATLAS,BOSS_VISUALS,bossEffectFrame} from '../config/bossVisualData';
import {BOSS_VFX_ATLAS,BOSS_VFX_MOTIONS} from '../config/bossVfxMotionData';

/** Ground-plane ellipses in the packed 96px frames, excluding glow, smoke and transparent padding.
 * Calibrated against the mature frames; one footprint per track keeps animation growth intact.
 * Recheck these coordinates if either atlas packing/layout changes.
 */
export type BossGroundFootprint=readonly [left:number,top:number,width:number,height:number];
type Footprints=Record<BossId,Partial<Record<BossEffect,BossGroundFootprint>>>;
const ANIMATED:Footprints={
  desert_emperor:{field:[8,60,80,20]},
  forest_guardian:{field:[14,62,68,18],impact:[14,60,68,18]},
  swamp_lord:{field:[18,62,60,14],impact:[12,64,72,16],cast:[16,66,64,14]},
  lava_colossus:{field:[16,54,64,14],impact:[12,65,72,15]},
  frost_queen:{field:[18,44,60,28],impact:[14,63,68,15],summon:[16,64,64,16]},
  twilight_king:{field:[12,66,72,12],summon:[20,64,56,12],impact:[14,65,68,15]}
};
const LEGACY:Footprints={
  desert_emperor:{field:[8,60,80,20]},
  forest_guardian:{impact:[8,64,78,18]},
  swamp_lord:{field:[14,60,68,20],impact:[12,64,72,16],cast:[12,64,72,16]},
  lava_colossus:{field:[12,62,68,16],impact:[10,64,76,16]},
  frost_queen:{field:[14,46,66,34],impact:[8,62,80,18],summon:[10,58,76,22]},
  twilight_king:{field:[6,64,76,16],summon:[2,42,84,24],impact:[12,64,72,16]}
};
const DEFAULT:BossGroundFootprint=[8,60,80,20];
export function bossGroundFootprint(animated:boolean,id:BossId,kind:BossEffect):BossGroundFootprint {
  return (animated?ANIMATED:LEGACY)[id][kind]??DEFAULT;
}

export const bossGroundAtlas=(animated:boolean):string=>animated?'boss_ground_v2':'boss_ground_v1';

/** Prepare once per texture manager. Mirror the clean lower ground ellipse to exclude upright smoke
 * and pillars, project it to a top-down circle, and bake into a fixed atlas with nearest pixels.
 * Original source textures and animation timing are untouched. No frame-time raster readback.
 */
export function prepareBossGroundTextures(scene:Phaser.Scene):void {
  for(const animated of [true,false]){
    const sourceKey=animated?BOSS_VFX_ATLAS:BOSS_ATLAS,key=bossGroundAtlas(animated);
    if(scene.textures.exists(key)||!scene.textures.exists(sourceKey))continue;
    const source=scene.textures.get(sourceKey),rows:{id:BossId;kind:BossEffect;frame:string}[]=[];
    for(const id of Object.keys(BOSS_VISUALS) as BossId[])for(const kind of ['field',...(id==='twilight_king'?['summon']:[])] as BossEffect[]){
      const count=animated?BOSS_VFX_MOTIONS[id][kind]:BOSS_VISUALS[id].effects[kind];
      for(let i=0;i<(count??0);i++){const frame=bossEffectFrame(id,kind,i);if(source.has(frame))rows.push({id,kind,frame});}
    }
    if(!rows.length)continue;
    try{
      const texture=scene.textures.createCanvas(key,800,Math.ceil(rows.length/8)*100);
      if(!texture)continue;
      const ctx=texture.getContext();ctx.imageSmoothingEnabled=false;
      for(const [i,row]of rows.entries()){
        const f=source.get(row.frame),[left,top,width,height]=bossGroundFootprint(animated,row.id,row.kind);
        const x=2+i%8*100,y=2+Math.floor(i/8)*100;
        ctx.save();ctx.translate(x+48,y+48);ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.clip();
        ctx.drawImage(f.source.image as HTMLImageElement,f.cutX+left,f.cutY+top+height/2,width,height/2,-48,0,96,48);
        ctx.scale(1,-1);
        ctx.drawImage(f.source.image as HTMLImageElement,f.cutX+left,f.cutY+top+height/2,width,height/2,-48,0,96,48);
        ctx.restore();texture.add(row.frame,0,x,y,96,96);
      }
      texture.refresh().setFilter(0);
    }catch{if(scene.textures.exists(key))scene.textures.remove(key);} // Missing cosmetic resources cannot block combat.
  }
}

/** Project only the floor ellipse into the circular damage plane. Upright flares retain proportions.
 * The existing world-space hazard mask clips both layers; this function never owns collision data.
 */
export function placeBossArea(image:Phaser.GameObjects.Image,animated:boolean,id:BossId,kind:BossEffect,
  x:number,y:number,radius:number,ground=false):void {
  const [left,top,width,height]=bossGroundFootprint(animated,id,kind),diameter=radius*2;
  if(ground&&image.texture.key===bossGroundAtlas(animated)){
    image.setCrop().setOrigin(.5).setPosition(x,y).setDisplaySize(diameter,diameter);return;
  }
  image.setOrigin((left+width/2)/96,(top+height/2)/96).setPosition(x,y);
  if(ground)image.setCrop(left,top,width,height).setDisplaySize(96*diameter/width,96*diameter/height);
  else image.setCrop().setDisplaySize(96*diameter/width,96*diameter/width);
}
