import Phaser from 'phaser';
import { FANTASY, dungeonFloor, pixelPanel } from '../ui/fantasyTheme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { soundManager } from '../systems/SoundManager';
import { RunStats } from '../types/game';

export interface GameOverSceneData {
  victory: boolean;
  stats: RunStats;
  droneSummary: string[];
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  public create(data: GameOverSceneData): void {
    const cx = GAME_WIDTH / 2;

    const bg = this.add.graphics();
    dungeonFloor(bg, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x111a20, 0.75);

    const accentColor = data.victory ? 0xb8ab6c : 0xa46957;
    const headerTitle = data.victory ? '회랑에 빛이 돌아왔다' : '아직 끝나지 않은 이야기';
    const subTitle = data.victory
      ? '최종 보스를 물리치고 모든 스테이지를 정화했습니다!'
      : '소환사의 생명력이 모두 소진되어 원정이 종료되었습니다.';

    this.add
      .text(cx, 200, headerTitle, {
        fontFamily: FANTASY.font,
        fontSize: '36px',
        fontStyle: 'bold',
        color: data.victory ? '#e3ce94' : '#dbb09a',
        stroke: '#000000',
        strokeThickness: 6
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 265, subTitle, {
        fontFamily: FANTASY.font,
        fontSize: '19px',
        color: '#bbc5ac'
      })
      .setOrigin(0.5);

    // 통계 패널
    pixelPanel(this, 60, 330, GAME_WIDTH - 120, 520, FANTASY.panel, accentColor);

    const s = data.stats;
    const rows: [string, string][] = [
      ['정화한 회랑', `${s.roomsCleared} 개`],
      ['물리친 몬스터', `${s.enemiesDefeated} 기`],
      ['남은 마력석', `${s.mineralsCollected} ◆`],
      ['도달 스테이지', `${s.stageIndex + 1}`],
      ['토벌한 보스', `${s.bossesDefeated} 기`],
      ['마왕 토벌 여부', s.bossDefeated ? '성공 (CLEAR)' : '미달성']
    ];

    rows.forEach(([label, val], idx) => {
      const y = 395 + idx * 54;
      this.add
        .text(105, y, label, {
          fontFamily: FANTASY.font,
          fontSize: '21px',
          color: '#aab39b'
        })
        .setOrigin(0, 0.5);

      this.add
        .text(GAME_WIDTH - 105, y, val, {
          fontFamily: 'monospace',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#efe4c4'
        })
        .setOrigin(1, 0.5);
    });

    this.add
      .text(105, 735, '최종 출전 유닛:', {
        fontFamily: FANTASY.font,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#d9b969'
      })
      .setOrigin(0, 0.5);

    this.add
      .text(
        105,
        780,
        data.droneSummary.length > 0 ? data.droneSummary.join('  |  ') : '동료 없음',
        {
          fontFamily: FANTASY.font,
          fontSize: '16px',
          color: '#e2e8f0',
          wordWrap: { width: GAME_WIDTH - 210 }
        }
      )
      .setOrigin(0, 0.5);

    // 재도전 버튼
    const retryBtn = this.add
      .rectangle(cx, 945, 340, 74, 0x3d5343, 1)
      .setStrokeStyle(3, 0xc3a76d)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, 945, '다시 모험하기', {
        fontFamily: FANTASY.font,
        fontSize: '25px',
        fontStyle: 'bold',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    retryBtn.on('pointerdown', () => {
      soundManager.playPowerup();
      this.scene.start('GameScene');
    });

    // 메인 메뉴 버튼
    const menuBtn = this.add
      .rectangle(cx, 1045, 260, 56, 0x243039, 1)
      .setStrokeStyle(2, 0x657167)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, 1045, '타이틀 화면으로', {
        fontFamily: FANTASY.font,
        fontSize: '20px',
        color: '#bbc5ac'
      })
      .setOrigin(0.5);

    menuBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
  }
}
