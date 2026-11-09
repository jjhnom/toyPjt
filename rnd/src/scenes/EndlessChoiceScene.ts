import Phaser from 'phaser';
import { FANTASY, fantasyButton, pixelPanel } from '../ui/fantasyTheme';
import { MUTATIONS, MUTATION_IDS } from '../config/mutationData';
import { isMutationAvailable } from '../config/stageData';
import type { MutationId } from '../types/game';

interface EndlessChoiceData {
  stageNumber: number;
  canContinue: boolean;
  onChoose: (choice: 'continue' | 'exit', mutation: MutationId) => boolean;
  onTitle: () => boolean;
}
export class EndlessChoiceScene extends Phaser.Scene {
  constructor() { super('EndlessChoiceScene'); }
  public create(data: EndlessChoiceData): void {
    this.input.enabled = true;
    let closed = false;
    let selected: MutationId = 'NONE';
    this.add.rectangle(360, 640, 720, 1280, 0x080c16, 0.94).setInteractive();
    pixelPanel(this, 28, 240, 664, 832, FANTASY.panel, FANTASY.gold);
    const text = (y: number, value: string, size = 21, color = FANTASY.cream) => this.add.text(360, y, value,
      { fontFamily: FANTASY.font, fontSize: `${size}px`, color, resolution: 2, align: 'center', lineSpacing: 10 })
      .setOrigin(0.5, 0).setWordWrapWidth(576);
    text(265, `STAGE ${data.stageNumber} CLEAR`, 32).setName('endless-choice-title');
    text(323, data.stageNumber === 5 ? '황혼의 마왕을 물리쳤습니다!' : '무한 원정의 회랑을 정화했습니다.', 22, '#d9c287');
    text(367, data.canContinue ? '승리로 마무리하거나, 현재 분대·강화·유물을\n유지한 채 더 강한 적에게 도전할 수 있습니다.'
      : '현재 버전의 안전 상한에 도달했습니다.\n승리로 원정을 마무리하세요.', 20, '#b6c0c8');
    text(437, data.canContinue ? `계속하면 STAGE ${data.stageNumber + 1} · 본체 HP 40% 회복\nT1 소환권 1장 · 다음 정비 후 출발`
      : '추가 스테이지는 생성되지 않습니다.', 19, '#cfb7ff');
    text(505, '다음 스테이지 변이 · 선택 사항 · 누적되지 않음', 17, '#d9c287');
    const description = text(590, MUTATIONS.NONE.description, 16, '#b6c0c8').setName('mutation-description');
    const choices: Phaser.GameObjects.Container[] = [];
    MUTATION_IDS.forEach((id, i) => {
      const allowed = data.canContinue && isMutationAvailable(data.stageNumber, id);
      const button = fantasyButton(this, 132 + i * 152, 554, 132, 48, MUTATIONS[id].name, () => {
        if (closed) return;
        selected = id; description.setText(MUTATIONS[id].description);
        choices.forEach((choice, index) => choice.setAlpha(MUTATION_IDS[index] === id ? 1 : 0.65));
      }, { enabled: allowed, fontSize: 21, primary: true }).setName(`mutation-${id}`);
      button.setAlpha(id === 'NONE' ? 1 : 0.65); choices.push(button);
    });
    const warning = text(1002, '변이에도 기존 수치 상한 적용 · 무효 옵션은 비활성\n선택과 보상은 저장되며 중복 적용되지 않습니다.', 16, '#b6c0c8').setName('endless-choice-warning');
    const commit = (action: () => boolean) => {
      if (closed) return;
      closed = true; this.input.enabled = false;
      if (action()) this.scene.stop();
      else { closed = false; this.input.enabled = true; warning.setText('저장에 실패했습니다. 저장소를 확인한 뒤 다시 선택하세요.').setColor('#f1a18e'); }
    };
    fantasyButton(this, 360, 674, 560, 72, data.canContinue ? '무한 모드 계속' : '안전 상한 도달',
      () => commit(() => data.onChoose('continue', selected)), { enabled: data.canContinue, fontSize: 26, primary: true }).setName('endless-continue');
    fantasyButton(this, 360, 794, 560, 72, '승리 종료', () => commit(() => data.onChoose('exit', 'NONE')),
      { fontSize: 26 }).setName('endless-exit');
    fantasyButton(this, 360, 931, 560, 56, '나중에 결정 · 타이틀 (변이 미확정)', () => commit(data.onTitle),
      { fontSize: 21 }).setName('endless-title');
  }
}
