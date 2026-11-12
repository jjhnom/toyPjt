import Phaser from 'phaser';
import { FANTASY, fantasyButton, uiIcon } from './fantasyTheme';

/** Lobby-only ornament; the game title remains live Korean text. */
export function lobbyCrest(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const crest = scene.add.container(x, y);
  const g = scene.add.graphics();
  const outline = [[-300,-44],[-278,-68],[-122,-61],[-76,-78],[0,-67],[76,-78],[122,-61],
    [278,-68],[300,-44],[300,48],[275,74],[130,65],[0,88],[-130,65],[-275,74],[-300,48]]
    .map(([px,py])=>({x:px,y:py}));
  g.fillStyle(0x0e0820,0.96).fillPoints(outline,true);
  g.lineStyle(9,0x5e302b).strokePoints(outline,true,true);
  g.lineStyle(4,0xffd989).strokePoints(outline,true,true);
  g.lineStyle(1,0xfff3c5,0.7).strokePoints(outline.map(p=>({x:p.x*.973,y:p.y*.86})),true,true);
  for(const side of[-1,1]){
    g.lineStyle(4,0xc78c42).lineBetween(side*264,59,side*326,-9);
    for(let i=0;i<4;i++){
      const px=side*(277+i*13),py=43-i*18;
      g.fillStyle(i%2?0xf4bd67:0xffe7a1).fillPoints([
        {x:px,y:py+15},{x:px-side*15,y:py-2},{x:px-side*6,y:py-19},{x:px+side*5,y:py-4}
      ],true);
    }
  }
  // Faceted crystal and small gold wings are original code art, not cropped mockup UI.
  const gem=[{x:0,y:-144},{x:28,y:-105},{x:19,y:-70},{x:0,y:-50},{x:-19,y:-70},{x:-28,y:-105}];
  g.fillStyle(0x234e98).fillPoints(gem,true);
  g.lineStyle(4,0xdbf9ff).strokePoints(gem,true,true);
  g.fillStyle(0x68e5ff).fillPoints([{x:0,y:-140},{x:-24,y:-104},{x:0,y:-108},{x:0,y:-55}],true);
  g.fillStyle(0x359ce8).fillPoints([{x:0,y:-108},{x:24,y:-104},{x:17,y:-72},{x:0,y:-55}],true);
  g.lineStyle(2,0xffffff,0.8).lineBetween(0,-137,0,-65);
  g.fillStyle(0x29143f).fillPoints([{x:-241,y:56},{x:241,y:56},{x:231,y:99},{x:-231,y:99}],true);
  g.lineStyle(3,0xb99061).strokePoints([{x:-241,y:56},{x:241,y:56},{x:231,y:99},{x:-231,y:99}],true,true);
  const title=scene.add.text(0,-8,'소환사의 원정',{fontFamily:FANTASY.font,fontSize:'66px',fontStyle:'bold',
    color:'#ffe9a7',stroke:'#3e1c25',strokeThickness:7,resolution:2}).setOrigin(.5);
  const subtitle=scene.add.text(0,77,"Summoner’s Expedition",{fontFamily:'Georgia, serif',fontSize:'23px',
    color:'#f2d597',stroke:'#21132c',strokeThickness:2,resolution:2}).setOrigin(.5);
  crest.add([g,title,subtitle]);return crest;
}

export function lobbyPlatform(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g=scene.add.graphics().setPosition(x,y);
  g.fillStyle(0xb763ff,.07).fillEllipse(0,0,540,86);
  g.lineStyle(2,0xf2ceff,.45).strokeEllipse(0,0,510,80).strokeEllipse(0,0,424,60);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,px=Math.cos(a)*237,py=Math.sin(a)*34;
    g.fillStyle(0xf8c8ff,.7).fillPoints([{x:px,y:py-5},{x:px+5,y:py},{x:px,y:py+5},{x:px-5,y:py}],true);
  }
  return g;
}

type LobbyIcon = 'classes' | 'growth' | 'codex' | 'sound' | 'swords';
export function lobbyIcon(scene: Phaser.Scene, kind: LobbyIcon, x: number, y: number, size = 48): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const glyph={classes:'helmet',growth:'growth',codex:'book',sound:'sound',swords:'swords'} as const;
  return uiIcon(scene,glyph[kind],x,y,size);
}

export function lobbyNavButton(scene: Phaser.Scene, x: number, y: number, label: string, icon: LobbyIcon,
  action:()=>void): Phaser.GameObjects.Container {
  const button=fantasyButton(scene,x,y,208,104,`\n${label}`,action,{fontSize:24,hitHeight:108});
  button.add(lobbyIcon(scene,icon,0,-22,46));return button;
}

