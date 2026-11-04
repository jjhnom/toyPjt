import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { soundManager } from '../systems/SoundManager';
import { RewardOption } from '../types/game';

export interface RewardSceneData {
  title: string;
  subtitle: string;
  minerals: number;
  isShop?: boolean;
  options: RewardOption[];
  onSelect: (option: RewardOption | null) => void;
}

export class RewardScene extends Phaser.Scene {
  constructor() {
    super('RewardScene');
  }

  public create(data: RewardSceneData): void {
    const cx = GAME_WIDTH / 2;

    // 반투명 딤 오버레이
    this.add
      .rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.78)
      .setInteractive();

    // 모달 프레임
    const panel = this.add.graphics();
    panel.fillStyle(0x0f172a, 0.96);
    panel.lineStyle(3, 0x38bdf8, 1);
    panel.fillRoundedRect(46, 190, GAME_WIDTH - 92, 880, 20);
    panel.strokeRoundedRect(46, 190, GAME_WIDTH - 92, 880, 20);

    this.add
      .text(cx, 250, data.title, {
        fontFamily: 'sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 295, data.subtitle, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#94a3b8'
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 332, `보유 미네랄: ${data.minerals} M`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#facc15'
      })
      .setOrigin(0.5);

    // 3개 보상 카드 렌더링
    const startY = 445;
    const gapY = 175;

    data.options.forEach((opt, idx) => {
      const cardY = startY + idx * gapY;
      const canAfford = !opt.costMinerals || data.minerals >= opt.costMinerals;

      const cardRect = this.add
        .rectangle(cx, cardY, GAME_WIDTH - 150, 148, canAfford ? 0x1e293b : 0x0f172a, 1)
        .setStrokeStyle(3, canAfford ? opt.accentColor : 0x334155);

      if (canAfford) {
        cardRect.setInteractive({ useHandCursor: true });
      }

      // 좌측 컬러 배지 바
      this.add.rectangle(
        cx - (GAME_WIDTH - 150) / 2 + 10,
        cardY,
        12,
        136,
        canAfford ? opt.accentColor : 0x475569
      );

      this.add
        .text(cx - 245, cardY - 40, opt.title, {
          fontFamily: 'sans-serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: canAfford ? '#ffffff' : '#64748b'
        })
        .setOrigin(0, 0.5);

      this.add
        .text(cx + 255, cardY - 40, opt.subtitle, {
          fontFamily: 'monospace',
          fontSize: '16px',
          fontStyle: 'bold',
          color: canAfford ? '#38bdf8' : '#475569'
        })
        .setOrigin(1, 0.5);

      this.add
        .text(cx - 245, cardY + 14, opt.description, {
          fontFamily: 'sans-serif',
          fontSize: '17px',
          color: canAfford ? '#cbd5e1' : '#475569',
          wordWrap: { width: 500 }
        })
        .setOrigin(0, 0.5);

      if (canAfford) {
        cardRect.on('pointerover', () => {
          cardRect.setFillStyle(0x334155, 1);
        });
        cardRect.on('pointerout', () => {
          cardRect.setFillStyle(0x1e293b, 1);
        });
        cardRect.on('pointerdown', () => {
          soundManager.playPowerup();
          this.scene.stop('RewardScene');
          data.onSelect(opt);
        });
      }
    });

    // 상점이거나 선택 패스 버튼
    const skipBtn = this.add
      .rectangle(cx, 990, 260, 54, 0x334155, 1)
      .setStrokeStyle(2, 0x64748b)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, 990, data.isShop ? '상점 나가기 (닫기)' : '보상 건너뛰기 (+15 미네랄)', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#e2e8f0'
      })
      .setOrigin(0.5);

    skipBtn.on('pointerdown', () => {
      this.scene.stop('RewardScene');
      data.onSelect(null);
    });
  }
}
