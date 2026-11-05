import Phaser from 'phaser';
import { FANTASY, fantasyButton, pixelPanel } from '../ui/fantasyTheme';
import type { CircleChoice } from '../types/game';

interface CircleSceneData {
  reward: number;
  guardianName: string;
  escortName: string;
  onChoose: (choice: CircleChoice) => void;
}

export class SummoningCircleScene extends Phaser.Scene {
  private closed = false;

  constructor() { super('SummoningCircleScene'); }

  public create(data: CircleSceneData): void {
    this.closed = false;
    this.input.enabled = true;
    this.add.rectangle(360, 640, 720, 1280, 0x080c16, 0.92);
    pixelPanel(this, 28, 160, 664, 952, FANTASY.panel, FANTASY.gold);
    const text = (x: number, y: number, value: string, size = 20, color = FANTASY.cream) =>
      this.add.text(x, y, value, { fontFamily: FANTASY.font, fontSize: `${size}px`, color,
        resolution: 2, lineSpacing: 7 }).setWordWrapWidth(550);
    text(360, 199, '봉인된 소환진', 32).setOrigin(0.5, 0);
    text(360, 253, '소환진에 남은 힘을 어떻게 사용할까요?', 19, '#d6c4ed').setOrigin(0.5, 0);
    const rune = this.add.image(360, 342, 'skill_rune').setDisplaySize(78, 78).setTint(0xb78cff);
    this.tweens.add({ targets: rune, angle: 360, duration: 8000, repeat: -1 });
    text(76, 418, '안전하게 회수', 24);
    text(76, 461, '전투 없이 T1 무료 지정 소환권 1장을 받습니다.\n보유 공간이 가득 차도 소환권은 보존됩니다.', 18, '#b6c0c8');
    fantasyButton(this, 360, 566, 548, 60, '안전하게 회수 · 소환권 1장', () => choose('SAFE'),
      { fontSize: 21 }).setName('circle-choice-SAFE');
    text(76, 632, '봉인 해제에 도전', 24);
    text(76, 675, `${data.guardianName} 1기 + ${data.escortName} 2기\n수호자 웨이브 1회 · 도전 중에는 나갈 수 없습니다.`, 18, '#b6c0c8');
    text(76, 753, `승리: 소환권 1장 + ${data.reward} ◆ + 적 처치 재화\n패배: 기존 전투와 동일하게 모험이 종료됩니다.`, 18, '#e3c78e');
    fantasyButton(this, 360, 859, 548, 60, '봉인 해제에 도전', () => choose('CHALLENGE'),
      { fontSize: 21, primary: true }).setName('circle-choice-CHALLENGE');
    text(360, 931, '선택은 한 번만 가능합니다.', 17, '#b6c0c8').setOrigin(0.5, 0);
    fantasyButton(this, 360, 1010, 548, 60, '지나가기 · 보상 없이 이동', () => choose('SKIP'),
      { fontSize: 20 }).setName('circle-choice-SKIP');
    const choose = (choice: CircleChoice) => {
      if (this.closed) return;
      this.closed = true;
      this.input.enabled = false;
      this.scene.stop();
      data.onChoose(choice);
    };
  }
}
