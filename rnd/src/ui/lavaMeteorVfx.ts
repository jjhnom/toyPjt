import type Phaser from 'phaser';
import type {HazardView} from '../entities/EncounterHazards';
import {BOSS_ATLAS,bossEffectFrame} from '../config/bossVisualData';
import {BOSS_VFX_ATLAS} from '../config/bossVfxMotionData';

/** Visual-only timeline. Damage, targets and phase radii remain owned by bossData/EncounterHazards. */
export const LAVA_METEOR={atlas:'lava_meteor_v1',size:64,visibleRadius:30,fallMs:150,endMs:650,
  times:[0,20,40,70,100,130,160,190,220,250,300,350,450,550,640]} as const;
export function lavaMeteorIndex(after:number):number {
  let i=0;while(i+1<LAVA_METEOR.times.length&&after>=LAVA_METEOR.times[i+1])i++;return i;
}
export const lavaMeteorVariant=(x:number,y:number):number=>Math.abs(Math.floor(x/150)+Math.floor(y/150))%3;
const FRAMES={ground:Array.from({length:3},(_,v)=>LAVA_METEOR.times.map((_,i)=>`lava_ground_${v}_${i}`)),
  air:Array.from({length:3},(_,v)=>LAVA_METEOR.times.map((_,i)=>`lava_air_${v}_${i}`))};
export const lavaMeteorFrame=(layer:'ground'|'air',variant:number,index:number):string=>FRAMES[layer][variant][index];

/** Small pixel atlas, baked once. Ground and airborne sequences stay independent but use two
 * existing pooled images. A 2px transparent border is excluded from the 60px effective diameter.
 * Molten fragments reuse the existing lava field artwork; no source PNG or combat data is changed.
 */
export function prepareLavaMeteorTextures(scene:Phaser.Scene):void {
  const key=LAVA_METEOR.atlas;if(scene.textures.exists(key))return;
  try{
    const texture=scene.textures.createCanvas(key,544,884);if(!texture)return;
    const ctx=texture.getContext();ctx.imageSmoothingEnabled=false;let cell=0;
    const sourceKey=scene.textures.exists(BOSS_VFX_ATLAS)?BOSS_VFX_ATLAS:BOSS_ATLAS;
    const source=scene.textures.get(sourceKey);
    const frame=(name:string,draw:(ctx:CanvasRenderingContext2D,x:number,y:number)=>void)=>{
      const x=cell%8*68+2,y=Math.floor(cell/8)*68+2;cell++;
      ctx.save();ctx.translate(x,y);draw(ctx,x,y);ctx.restore();texture.add(name,0,x,y,64,64);
    };
    for(let variant=0;variant<3;variant++)for(const [i,after]of LAVA_METEOR.times.entries()){
      frame(lavaMeteorFrame('ground',variant,i),(c,offsetX,offsetY)=>{
        const pixels=c.createImageData(64,64),heat=Math.max(0,1-after/650),wave=Math.min(30,Math.max(0,(after-40)/150*30));
        const waveAlpha=after<40?0:after<=190?1:Math.max(0,1-(after-190)/150);
        for(let y=0;y<64;y++)for(let x=0;x<64;x++){
          const dx=x+.5-32,dy=y+.5-32,d=Math.hypot(dx,dy),p=(y*64+x)*4;
          if(d>30)continue;
          const angle=Math.atan2(dy,dx),noise=(x*17+y*23+variant*13)%11;
          if(d<23&&noise>1){pixels.data.set([29+noise,17,21,Math.round(heat*160*(1-d/29))],p);
            if(d>4&&Math.abs(Math.sin(angle*5+variant*.8+Math.sin(d*.43)*.22))<.12)pixels.data.set([245,75+noise*3,20,Math.round(heat*190)],p);}
          if(wave>0&&d<=wave&&d>wave-2.4)pixels.data.set([255,180+noise*4,70,Math.round(235*waveAlpha)],p);
        }
        c.putImageData(pixels,offsetX,offsetY);
      });
      frame(lavaMeteorFrame('air',variant,i),c=>{
        if(after<70){
          const strength=1-after/70;c.fillStyle=`rgba(255,139,42,${strength*.35})`;
          for(let y=20;y<44;y++)for(let x=20;x<44;x++)if(Math.hypot(x+.5-32,y+.5-32)<12)c.fillRect(x,y,1,1);
          c.fillStyle=`rgba(255,248,203,${strength})`;
          for(let y=26;y<38;y++)for(let x=26;x<38;x++)if(Math.hypot(x+.5-32,y+.5-32)<6)c.fillRect(x,y,1,1);
        }
        if(after>=350)return;
        const fName=bossEffectFrame('lava_colossus','field',Math.min(sourceKey===BOSS_VFX_ATLAS?7:3,Math.floor(after/55)));
        const f=source.has(fName)?source.get(fName):undefined;
        for(let n=0;n<9;n++){
          const angle=n*Math.PI*2/9+variant*.39,travel=4+Math.min(1,after/240)*25;
          const x=Math.round(32+Math.cos(angle)*travel),y=Math.round(32+Math.sin(angle)*travel);
          c.globalAlpha=(after<=190?1:Math.max(0,1-(after-190)/160))*(.65+(n%3)*.12);
          if(f)c.drawImage(f.source.image as HTMLImageElement,f.cutX+24+(n%3)*12,f.cutY+60,10,12,x-2,y-3,5,6);
          c.fillStyle=n%2?'#ff722c':'#ffce64';c.fillRect(x,y,2,2);
        }
        c.globalAlpha=1;
      });
    }
    for(let i=0;i<8;i++)frame(`lava_fall_${i}`,c=>{
      c.fillStyle='#b94225';c.fillRect(30,3,4,24);c.fillStyle='#ff9c43';c.fillRect(31,9,2,23);
      for(let y=26;y<38;y++)for(let x=26;x<38;x++)if(Math.hypot(x+.5-32,y+.5-32)<6){
        c.fillStyle=(x+y+i)%4===0?'#ffe4a0':(x+y)%3===0?'#ff7325':'#742824';c.fillRect(x,y,1,1);
      }
    });
    for(let i=0;i<4;i++)frame(`lava_heat_${i}`,c=>{
      c.fillStyle='rgba(12,10,17,.6)';for(let y=23;y<41;y++)for(let x=23;x<41;x++)if(Math.hypot(x+.5-32,y+.5-32)<9)c.fillRect(x,y,1,1);
      c.fillStyle=`rgba(249,76,36,${.15+i*.08})`;c.fillRect(29,29,6,6);
    });
    texture.refresh().setFilter(0);
  }catch{if(scene.textures.exists(key))scene.textures.remove(key);}
}

function place(image:Phaser.GameObjects.Image,name:string,state:HazardView,size:number,atlas:string):Phaser.GameObjects.Image {
  return image.setTexture(atlas,name).setCrop().setOrigin(.5)
    .setPosition(state.x,state.y).setDisplaySize(size,size).clearTint().setRotation(0).setFlipX(false).setAlpha(1).setVisible(true);
}
export function renderLavaMeteor(scene:Phaser.Scene,floor:Phaser.GameObjects.Image,air:Phaser.GameObjects.Image,state:HazardView,age:number,atlas:string=LAVA_METEOR.atlas):boolean {
  if(!scene.textures.exists(atlas))return false;
  const after=age-state.warningMs,size=LAVA_METEOR.size*(state.radius/LAVA_METEOR.visibleRadius),variant=lavaMeteorVariant(state.x,state.y);
  if(after>=LAVA_METEOR.endMs)return true;
  if(after< -LAVA_METEOR.fallMs)return true;
  if(after<0){
    const u=(after+LAVA_METEOR.fallMs)/LAVA_METEOR.fallMs;
    place(floor,`lava_heat_${Math.min(3,Math.floor(u*4))}`,state,size,atlas);
    place(air,`lava_fall_${Math.min(7,Math.floor(u*8))}`,state,size,atlas).setPosition(state.x,state.y-state.radius*(1-u)**2).clearMask();
  }else{
    const i=lavaMeteorIndex(after);place(floor,lavaMeteorFrame('ground',variant,i),state,size,atlas);
    if(after<350)place(air,lavaMeteorFrame('air',variant,i),state,size,atlas).clearMask();
  }
  return true;
}
