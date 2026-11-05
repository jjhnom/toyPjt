import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { soundManager } from '../systems/SoundManager';
import { FANTASY, pixelPanel, fantasyButton } from '../ui/fantasyTheme';
import { runSaveManager } from '../systems/RunSaveManager';
import { STAGES } from '../config/stageData';

export class MenuScene extends Phaser.Scene {
  private soundBtnText!: Phaser.GameObjects.Text;
  private starting = false;
  constructor() { super('MenuScene'); }

  public create(data: { message?: string } = {}): void {
    this.starting = false;
    this.input.enabled = true;
    const saved = runSaveManager.load();
    const cx = GAME_WIDTH / 2;
    this.add.image(cx, GAME_HEIGHT / 2, 'art_title').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setName('title-art');
    const shade = this.add.graphics();
    shade.fillStyle(0x07091d, 0.17).fillRect(0, 0, GAME_WIDTH, 360);
    for (let row = 0; row < 16; row++) shade.fillStyle(0x080b1d, row / 25).fillRect(0, 820 + row * 29, GAME_WIDTH, 29);
    shade.lineStyle(1, 0xc3a068, 0.6).strokeRect(18, 18, GAME_WIDTH - 36, GAME_HEIGHT - 36);
    shade.lineStyle(3, 0xead4a2, 0.8);
    for (const x of [24, GAME_WIDTH - 24]) {
      const sign = x < cx ? 1 : -1;
      shade.lineBetween(x, 26, x + sign * 42, 26).lineBetween(x, 26, x, 68);
    }
    this.label(cx, 108, 'SUMMON  ·  COMBINE  ·  CONQUER', 14, '#d5c7a3').setLetterSpacing(3);
    this.label(cx, 205, 'SMASH', 92, '#5e3d30').setFontFamily('Georgia, serif').setLetterSpacing(5).setStroke('#0d101f', 10);
    this.label(cx, 200, 'SMASH', 92, '#f2d49a').setFontFamily('Georgia, serif').setLetterSpacing(5);
    this.label(cx, 282, '소환사의 원정', 34, '#fff1cc').setStroke('#151427', 4);
    this.label(cx, 337, '잊힌 회랑의 봉인을 깨우세요', 17, '#bac6d2').setStroke('#0d1425', 3);
    this.label(cx, 846, '동료를 모으고, 운명을 조합하세요.', 18, '#e4d2ac').setStroke('#0c1224', 3);
    fantasyButton(this, cx, 910, 392, 76, saved.status === 'ready' ? '새 모험' : '모험 시작', () => {
      if (this.starting) return;
      if (saved.status === 'ready') this.confirmNewRun();
      else this.startRun(false);
    }, { primary: true, fontSize: 28 });
    fantasyButton(this, cx, 998, 392, 64, saved.status === 'ready' ? `이어하기 · STAGE ${saved.checkpoint.stats.stageIndex + 1}` : '이어하기 · 저장 없음',
      () => this.startRun(true), { enabled: saved.status === 'ready', fontSize: 23 });
    const caption = saved.status === 'ready'
      ? `${STAGES[saved.checkpoint.stats.stageIndex].name} · 스테이지 시작 상태로 재개`
      : saved.status === 'invalid' ? '저장 데이터가 손상되었거나 지원하지 않는 버전입니다.'
      : saved.status === 'unavailable' ? '저장소를 사용할 수 없습니다. 자동 저장이 제한됩니다.' : '스테이지 진입 시 자동 저장됩니다.';
    this.label(cx, 1050, data.message ?? caption, 15, '#d9b969').setWordWrapWidth(620);
    const sound = fantasyButton(this, cx, 1110, 290, 56, this.getSoundLabel(), () => {
      soundManager.enabled = !soundManager.enabled;
      this.soundBtnText.setText(this.getSoundLabel());
    }, { fontSize: 18 });
    this.soundBtnText = sound.getByName('label') as Phaser.GameObjects.Text;
    this.label(cx, 1168, 'CHAPTER I  ·  THE FORGOTTEN HALLS', 14, '#8d9d86');
    this.label(cx, 1200, '작은 동료들이 모여, 위대한 모험이 됩니다.', 15, '#8d9d86');
  }

  private startRun(resume: boolean): void {
    if (this.starting) return;
    this.starting = true;
    this.input.enabled = false;
    soundManager.playPowerup();
    this.scene.start('GameScene', { resume });
  }

  private confirmNewRun(): void {
    // A confirmation inside the game prevents an accidental overwrite of a saved run.
    if (this.children.getByName('new-run-confirmation')) return;
    const modal = this.add.container(0, 0).setName('new-run-confirmation').setDepth(100);
    const block = this.add.rectangle(360, 640, 720, 1280, 0x0c1218, 0.9).setInteractive();
    const panel = pixelPanel(this, 50, 480, 620, 300);
    const title = this.label(360, 540, '저장된 모험을 지우고\n새로 시작할까요?', 26, '#efe4c4');
    const cancel = this.add.rectangle(210, 700, 240, 64, 0x34434a).setInteractive({ useHandCursor: true });
    const cancelLabel = this.label(210, 700, '취소', 23, '#efe4c4');
    const confirm = this.add.rectangle(510, 700, 240, 64, 0x66513b).setInteractive({ useHandCursor: true });
    const confirmLabel = this.label(510, 700, '새 모험 시작', 23, '#efe4c4');
    modal.add([block, panel, title, cancel, cancelLabel, confirm, confirmLabel]);
    cancel.on('pointerdown', () => modal.destroy());
    confirm.on('pointerdown', () => this.startRun(false));
  }

  private label(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: FANTASY.font, fontSize: `${size}px`, resolution: 2, fontStyle: 'bold', color, align: 'center' }).setOrigin(0.5);
  }
  private getSoundLabel(): string { return `효과음  ${soundManager.enabled ? '켜짐' : '꺼짐'}`; }
}
