import type Phaser from 'phaser';
import { ActiveSkillButton } from './ActiveSkillButton';
import { FANTASY } from './fantasyTheme';
import {bottomButton} from './bottomHudArt';

/** Uses existing actions; the middle button remains the real class skill, with no new farming mode. */
export class BattleControlHud {
  readonly active:ActiveSkillButton;
  readonly maintenance:Phaser.GameObjects.Container;
  private state='';

  constructor(scene:Phaser.Scene,ability:{name:string;label:string},onCast:()=>void,onCancel:()=>void,
    onMaintenance:()=>void,onTitle:()=>void){
    this.maintenance=bottomButton(scene,310,1230,180,84,'maintenance','원정 정비','전투 중','tent',onMaintenance)
      .setName('squad-open');
    this.active=new ActiveSkillButton(scene,onCast,onCancel,ability);this.active.setPosition(484,1230);
    bottomButton(scene,638,1230,140,84,'exit','중단·타이틀','','door',onTitle).setName('return-title');
  }

  updateMaintenance(cleared:boolean,entering:boolean):void {
    const state=cleared?'준비 완료':entering?'이동 중':'전투 중';if(state===this.state)return;this.state=state;
    const status=this.maintenance.getByName('status') as Phaser.GameObjects.Text;
    status.setText(state).setColor(cleared?'#b9ffb2':FANTASY.muted);
  }
}
