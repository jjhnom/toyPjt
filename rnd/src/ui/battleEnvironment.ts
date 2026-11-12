import type Phaser from 'phaser';
import type { StageDef } from '../types/game';
import { PROVIDED_UI } from './providedArt';

/** Static, deterministic scenery. Never creates input or physics objects or consumes gameplay RNG. */
export function paintBattleEnvironment(scene:Phaser.Scene,target:Phaser.GameObjects.RenderTexture,theme:StageDef['themeId'],boss:boolean,seed:string):void {
  const root=scene.add.container(0,0);
  const g=scene.add.graphics();root.add(g);
  let offset=0;for(const c of seed)offset=(offset*31+c.charCodeAt(0))%997;
  const light=theme==='volcano'?0xff9f3a:theme==='glacier'?0x3fb7ff:theme==='swamp'?0x4ade80:0xab79ff;
  // Irregular shade crosses the repeated tile's horizontal joins, avoiding a striped grid.
  for(let row=1;row<7;row++){
    const y=178+row*128,points=[];
    for(let col=0;col<=8;col++)points.push({x:72+col*72,y:y-18-((col*17+row*29+offset)%26)});
    for(let col=8;col>=0;col--)points.push({x:72+col*72,y:y+18+((col*23+row*11+offset)%22)});
    g.fillStyle(0x101c2c,.18).fillPoints(points,true);
  }
  for(let i=0;i<26;i++){
    const x=100+(i*137+offset)%520,y=220+(i*211+offset)%800;
    g.fillStyle(i%2?0x080e20:light,i%2?.13:.035).fillEllipse(x,y,150+i%4*24,70+i%3*20);
    if(Math.abs(x-360)<76||Math.abs(y-630)<66)continue; // Visually clear door corridors.
    if(i%6===0)root.add(scene.add.image(x,y,PROVIDED_UI,i%12?'prop_crystal':'prop_rock').setDisplaySize(28,28).setAlpha(.7));
    else if(theme==='forest'||theme==='swamp'){
      g.lineStyle(2,0x637c68,.45).lineBetween(x-4,y+5,x-6,y-3).lineBetween(x,y+5,x+1,y-7).lineBetween(x+3,y+5,x+7,y-2);
      if(i%3===0)g.fillStyle(0xc4a6d2,.45).fillRect(x-2,y-5,3,3).fillRect(x+5,y-3,3,3);
    }else g.lineStyle(1,0x080e20,.45).lineBetween(x-13,y,x,y+3).lineBetween(x,y+3,x+8,y-4).lineBetween(x,y+3,x+3,y+11);
  }
  // Edge shade and local torch halos leave the walkable bounds and exits unchanged.
  for(let i=0;i<4;i++){
    const x=i%2?652:68,y=i<2?310:930;
    for(let r=4;r>0;r--)g.fillStyle(light,(boss?.025:.012)).fillEllipse(x,y,r*32,r*50);
    g.fillStyle(light,boss?.8:.45).fillRect(x-2,y-7,4,14);
  }
  for(let i=0;i<4;i++)g.lineStyle(4,0x080c1b,.07).strokeRect(72+i*4,178+i*4,576-i*8,904-i*8);
  // Reuse one scene-owned target. Rasterize only on room/theme changes, then release source shapes.
  target.clear().draw(root);
  root.destroy();
}
