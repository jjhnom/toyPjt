import type Phaser from 'phaser';
import type { DroneArchetype } from '../types/game';
import { UNIT_COMBAT_STYLES } from '../config/skillData';
import { SKILL_VFX_SHAPES, paintSkillProjectile, paintSkillImpact, paintSkillWave } from './skillEffectPainter';
import type { SkillVfxShape } from './skillEffectPainter';

export const skillProjectileTexture=(unit:DroneArchetype):string=>'skill_projectile_'+unit;
export const skillGlyphTexture=(shape:SkillVfxShape):string=>'skill_glyph_'+shape;
export const skillWaveTexture=(shape:SkillVfxShape):string=>'skill_wave_'+shape;

/** Prepare small transparent textures once; physics continues to use the original 32px projectile contract. */
export function createSkillEffectTextures(scene:Phaser.Scene):void{
  const make=(key:string,size:number,draw:(ctx:CanvasRenderingContext2D)=>void)=>{
    const canvas=scene.textures.createCanvas(key,size,size)!;
    const ctx=canvas.getContext();ctx.imageSmoothingEnabled=false;draw(ctx);canvas.refresh();
  };
  for(const [unit,style]of Object.entries(UNIT_COMBAT_STYLES)){
    make(skillProjectileTexture(unit as DroneArchetype),32,ctx=>paintSkillProjectile(ctx,style.shape,
      style.shape==='bolt'?0x3fb7ff:style.color,style.shape==='bolt'?0xd8faff:style.accent));
  }
  for(const shape of SKILL_VFX_SHAPES){
    make(skillGlyphTexture(shape),32,ctx=>paintSkillImpact(ctx,shape));
    make(skillWaveTexture(shape),96,ctx=>paintSkillWave(ctx,shape));
  }
  for(const kind of ['heal','shield','buff','rune','slow','poison'] as const){
    make('skill_'+kind,32,ctx=>paintSkillProjectile(ctx,kind==='poison'?'poison_support':kind,0xffffff,0xffffff));
  }
  make('skill_line',2,ctx=>{ctx.fillStyle='#ffffff';ctx.fillRect(0,0,2,2);});
}
