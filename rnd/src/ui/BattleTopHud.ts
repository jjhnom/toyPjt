import type Phaser from 'phaser';
import { BATTLE_UI, FANTASY, uiIcon } from './fantasyTheme';
import { hudLabel, hudMinerals, setHudText } from './battleHudText';
import { hudArt } from './hudArt';

/** Presentation only. The scene continues to own HP, progression, currency and minimap data. */
export class BattleTopHud {
  readonly name:Phaser.GameObjects.Text;
  readonly level:Phaser.GameObjects.Text;
  readonly hp:Phaser.GameObjects.Text;
  readonly xp:Phaser.GameObjects.Text;
  readonly minerals:Phaser.GameObjects.Text;
  readonly save:Phaser.GameObjects.Text;
  readonly hpBar:Phaser.GameObjects.Graphics;
  readonly xpBar:Phaser.GameObjects.Graphics;
  readonly map:Phaser.GameObjects.Graphics;

  constructor(scene:Phaser.Scene){
    const p=BATTLE_UI.heroPanel;
    hudArt(scene,'top',4,-2,712,120).setName('reference-top-skin');
    scene.add.zone(p.x+p.width/2,p.y+p.height/2,p.width,p.height).setName('hero-panel');
    scene.add.zone(638,48,144,96).setName('minimap-panel');
    scene.add.image(64,55,'portrait_leader_hud').setDisplaySize(80,70).setDepth(52).setName('hero-portrait');
    this.name=hudLabel(scene,146,20,22).setName('hero-name');
    hudLabel(scene,283,21,18,'#d6a0f2').setText('·');
    this.level=hudLabel(scene,297,22,20).setName('hero-level');
    const star=scene.add.graphics().setDepth(53);
    star.fillStyle(FANTASY.gold).fillPoints(Array.from({length:16},(_,i)=>{
      const a=i*Math.PI/8,r=i%2?4:8;return{x:134+Math.cos(a)*r,y:33+Math.sin(a)*r};
    }),true);
    uiIcon(scene,'heart',139,64,26).setDepth(53).setName('hud-heart-icon');
    this.hpBar=scene.add.graphics().setDepth(52);
    this.hp=hudLabel(scene,264,64,18).setOrigin(.5).setName('hero-hp');
    hudLabel(scene,132,88,14).setText('EXP').setOrigin(0,.5).setName('hero-xp-label');
    this.xp=hudLabel(scene,256,88,14).setOrigin(.5).setName('hero-xp');
    this.xpBar=scene.add.graphics().setDepth(52);
    uiIcon(scene,'gem',418,58,26).setDepth(53).setName('hud-mineral-icon');
    hudLabel(scene,480,32,12).setText('마력석').setOrigin(.5,0).setName('hud-mineral-label');
    this.minerals=hudLabel(scene,532,61,20).setOrigin(1,.5).setName('hud-minerals');
    this.save=hudLabel(scene,478,90,10,'#d9b969').setOrigin(.5).setName('save-status');
    hudLabel(scene,590,14,14).setText('미니맵').setName('minimap-label');
    // Fit occupied rooms directly into integer HUD pixels below the unchanged title.
    this.map=scene.add.graphics().setDepth(52);
  }

  setHealth(hp:number,maxHp:number,ratio:number):void {
    const r=BATTLE_UI.hp,width=Math.round((r.width-18)*Math.max(0,Math.min(1,ratio)));
    this.hpBar.clear();this.barFrame(this.hpBar,r.x,r.y,r.width,r.height,FANTASY.gold);
    if(width>0)this.hpBar.fillStyle(BATTLE_UI.color.hp).fillGradientStyle(0xff709e,0xff4c8b,0xd9265b,0xce1e59,1)
      .fillRect(r.x+6,r.y+4,width,r.height-8).fillStyle(0xffd0e2,.5).fillRect(r.x+6,r.y+4,width,2);
    setHudText(this.hp,`HP ${hp} / ${maxHp}`,r.width-12);
  }

  setProgress(name:string,level:number,xp:number,next:number):void {
    setHudText(this.name,name,134);setHudText(this.level,`Lv.${level}`,66);
    setHudText(this.xp,next>0?`${xp} / ${next}`:'MAX',142);
    const r=BATTLE_UI.xp,ratio=next>0?Math.max(0,Math.min(1,xp/next)):1;
    this.xpBar.clear();this.barFrame(this.xpBar,r.x,r.y,r.width,r.height,0xa65ee5);
    this.xpBar.fillStyle(BATTLE_UI.color.xp).fillGradientStyle(0xd5a0ff,0x9ddcff,0x8339d6,0x6f9fec,1)
      .fillRect(r.x+6,r.y+4,Math.round((r.width-18)*ratio),r.height-8);
  }

  setMinerals(amount:number):void {
    setHudText(this.minerals,hudMinerals(amount),96);this.minerals.setData('amount',amount);
  }

  private barFrame(g:Phaser.GameObjects.Graphics,x:number,y:number,width:number,height:number,edge:number):void {
    const shape=(left:number,top:number,w:number,h:number)=>[
      {x:left+7,y:top},{x:left+w-9,y:top},{x:left+w,y:top+h/2},
      {x:left+w-9,y:top+h},{x:left+7,y:top+h},{x:left,y:top+h/2}
    ];
    g.fillStyle(edge).fillPoints(shape(x,y,width,height),true)
      .fillStyle(0x211028).fillPoints(shape(x+2,y+2,width-4,height-4),true);
  }
}
