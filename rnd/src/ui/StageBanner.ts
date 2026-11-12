import Phaser from 'phaser';
import { BATTLE_UI, FANTASY, pixelPanel } from './fantasyTheme';
import { hudLabel } from './battleHudText';
import { hudArt } from './hudArt';

/** Entirely above the top door. Long names cycle through complete text pages, without clipped glyphs. */
export class StageBanner {
  readonly index:Phaser.GameObjects.Text;
  readonly name:Phaser.GameObjects.Text;
  readonly badge:Phaser.GameObjects.Text;
  readonly status:Phaser.GameObjects.Text;
  readonly boss:Phaser.GameObjects.Container;
  readonly bossLabel:Phaser.GameObjects.Text;
  readonly bossBar:Phaser.GameObjects.Graphics;

  constructor(scene:Phaser.Scene){
    const p=BATTLE_UI.stagePanel;
    hudArt(scene,'stage',p.x,p.y,p.width,p.height).setName('stage-banner');
    this.index=hudLabel(scene,162,121,18).setOrigin(0,.5).setName('battle-stage-index');
    this.name=hudLabel(scene,420,121,18,'#ffe9aa').setOrigin(.5).setName('battle-stage');
    this.badge=hudLabel(scene,582,121,16,'#ffd966').setOrigin(1,.5).setName('battle-room-badge');
    this.status=hudLabel(scene,360,144,13).setOrigin(.5).setName('battle-wave');
    this.boss=scene.add.container(p.x,p.y).setDepth(60).setVisible(false).setName('boss-hud');
    this.bossLabel=hudLabel(scene,p.width/2,4,16,'#edc6d9').setOrigin(.5,0).setAlign('center').setLineSpacing(2);
    this.bossBar=scene.add.graphics();
    this.boss.add([pixelPanel(scene,0,0,p.width,p.height,BATTLE_UI.color.panel,FANTASY.gold),this.bossBar,this.bossLabel]);
    const timer=scene.time.addEvent({delay:2400,loop:true,callback:()=>this.advancePages()});
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>timer.remove(false));
  }

  private setPages(text:Phaser.GameObjects.Text,value:string,width:number):void {
    if(text.getData('fullText')===value)return;
    text.setWordWrapWidth(width,true);
    const pages=text.getWrappedText(value);
    text.setWordWrapWidth(0).setData({fullText:value,pages,maxWidth:width,page:0});
    text.setText(pages[0]??'');
  }
  setName(value:string):void {this.setPages(this.name,value,144);}
  setBadge(value:string):void {this.setPages(this.badge,value,84);}
  setStatus(value:string):void {this.setPages(this.status,value,440);}
  advancePages():void {
    for(const text of [this.name,this.status,this.badge]){
      const pages=text.getData('pages') as string[]|undefined;
      if(pages&&pages.length>1){
        const page=((text.getData('page') as number)+1)%pages.length;
        text.setData('page',page).setText(pages[page]);
      }
    }
  }
}
