import type Phaser from 'phaser';
import { BATTLE_UI } from './fantasyTheme';
import { hudLabel, setHudText } from './battleHudText';
import { unitPortrait } from './pixelCharacters';
import {BOTTOM_HUD,bottomButton,bottomIcon,bottomSkin} from './bottomHudArt';

export class BattleSquadHud {
  readonly deployed:Phaser.GameObjects.Text;
  readonly owned:Phaser.GameObjects.Text;
  readonly synergy:Phaser.GameObjects.Text;
  readonly living:Phaser.GameObjects.Text;
  readonly frames:Phaser.GameObjects.Container[]=[];
  readonly portraits:Phaser.GameObjects.Image[]=[];
  readonly grades:Phaser.GameObjects.Text[]=[];
  readonly statuses:Phaser.GameObjects.Text[]=[];
  readonly skillIcons:Phaser.GameObjects.Image[]=[];
  readonly empty:Phaser.GameObjects.Text[]=[];
  readonly bars:Phaser.GameObjects.Graphics;

  constructor(scene:Phaser.Scene,count:number,onSelect:(index:number)=>void,onDetail:()=>void){
    scene.add.image(0,1080,BOTTOM_HUD,'board').setOrigin(0).setDepth(50).setName('battle-bottom-board');
    scene.add.rectangle(360,1130,720,100,0,0).setDepth(50).setInteractive()
      .on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,e:Phaser.Types.Input.EventData)=>e.stopPropagation());
    for(const[kind,x]of [['people',32],['chest',205],['sun',375],['heart',548]] as const)
      bottomIcon(scene,kind,x,1093,20).setDepth(54);
    this.deployed=hudLabel(scene,49,1093,18).setOrigin(0,.5).setName('squad-deployed');
    this.owned=hudLabel(scene,222,1093,18).setOrigin(0,.5).setName('squad-owned');
    this.synergy=hudLabel(scene,392,1093,18).setOrigin(0,.5).setName('squad-synergy');
    this.living=hudLabel(scene,566,1093,18,'#68d96c').setOrigin(0,.5).setName('squad-living');
    const separators=scene.add.graphics().setDepth(53).lineStyle(1,0xc58edc,.65);
    for(const x of [185,355,528])separators.lineBetween(x,1088,x,1100);
    this.bars=scene.add.graphics().setDepth(54);
    const slot=BATTLE_UI.slot;
    for(let i=0;i<count;i++){
      const x=slot.x+i*slot.step;
      const frame=scene.add.container(x,slot.y).setDepth(51);
      frame.add(bottomSkin(scene,'empty',0,0,slot.width,slot.height));this.frames.push(frame);
      this.portraits.push(scene.add.image(x+28,slot.portraitY,unitPortrait('BASIC_LASER'))
        .setDisplaySize(slot.portrait,slot.portrait).setDepth(53).setVisible(false));
      this.grades.push(hudLabel(scene,x+68,1118,16,'#ffd966').setOrigin(.5).setVisible(false));
      this.statuses.push(hudLabel(scene,x+68,1146,12).setOrigin(.5).setDepth(56).setVisible(false));
      this.skillIcons.push(scene.add.image(x+68,1133,'skill_shield').setDisplaySize(8,8).setDepth(55).setVisible(false));
      this.empty.push(hudLabel(scene,x+42,1142,34,'#c28ee9').setText('+').setOrigin(.5).setName(`squad-empty-${i}`));
      scene.add.rectangle(x+42,1140,88,80,0,0).setDepth(64).setName(`squad-slot-${i}`).setInteractive()
        .on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,e:Phaser.Types.Input.EventData)=>{
          e.stopPropagation();onSelect(i);
        });
    }
    bottomButton(scene,642,1136,132,76,'detail','상세 ›','','book',onDetail)
      .setDepth(65).setName('squad-status-open');
  }

  setOccupied(index:number,occupied:boolean):void {
    const skin=this.frames[index].getByName('bottom-skin') as Phaser.GameObjects.Image|Phaser.GameObjects.NineSlice;
    const frame=occupied?'card':'empty';
    if(skin.frame.name!==frame){skin.setFrame(frame);if('updateUVs' in skin)skin.updateUVs();}
  }

  setCounts(deployed:number,deployedLimit:number,owned:number,ownedLimit:number,synergy:number):void {
    setHudText(this.deployed,`출전 ${deployed}/${deployedLimit}`,126);
    setHudText(this.owned,`보유 ${owned}/${ownedLimit}`,126);
    setHudText(this.synergy,`시너지 ${synergy}/3`,126);
  }
}
