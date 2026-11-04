import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { soundManager } from '../systems/SoundManager';
import { dungeonFloor, FANTASY, pixelPanel } from '../ui/fantasyTheme';
import { unitAnimation, unitTexture } from '../ui/pixelCharacters';
import type { DroneArchetype } from '../types/game';

export class MenuScene extends Phaser.Scene {
  private soundBtnText!: Phaser.GameObjects.Text;
  constructor() { super('MenuScene'); }

  public create(): void {
    const cx = GAME_WIDTH / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x151d25).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 42; i++) {
      bg.fillStyle(i % 3 === 0 ? 0xb6bca1 : 0x526466).fillRect(28 + i * 137 % 660, 40 + i * 73 % 500, 3, 3);
    }
    bg.fillStyle(0xd7d6ac).fillRect(557, 76, 40, 48).fillRect(549, 84, 56, 32);
    bg.fillStyle(0x151d25).fillRect(545, 72, 34, 34);
    for (let i = 0; i < 11; i++) {
      const height = 80 + i * 37 % 130;
      bg.fillStyle(0x1d2b30).fillRect(i * 70, 590 - height, 54, height);
      bg.fillRect(i * 70 - 5, 590 - height - 12, 64, 12);
      bg.fillStyle(0x30403c).fillRect(i * 70 + 22, 590 - height + 24, 8, 12);
    }
    dungeonFloor(bg, 32, 566, GAME_WIDTH - 64, 230);
    bg.fillStyle(0x35483f).fillRect(32, 560, GAME_WIDTH - 64, 6);
    pixelPanel(this, 24, 24, GAME_WIDTH - 48, GAME_HEIGHT - 48, 0x000000, 0x58644f).setAlpha(0.3);
    this.label(cx, 101, 'A PIXEL FANTASY ADVENTURE', 16, '#a9b79a').setLetterSpacing(3);
    this.label(cx, 207, 'SMASH', 88, '#e8cf8d').setStroke('#172029', 8);
    this.label(cx, 291, '소환사의 원정', 35, '#efe4c4');
    this.label(cx, 348, '잊힌 회랑에서, 당신의 원정대가 깨어납니다.', 18, '#a9b79a');
    const portal = this.add.graphics();
    portal.fillStyle(0x3d4946).fillRect(282, 405, 156, 172);
    portal.fillStyle(0x626b56).fillRect(290, 397, 140, 12);
    portal.fillStyle(0x121e26).fillRect(306, 417, 108, 160);
    portal.fillStyle(0x484160).fillRect(318, 429, 84, 145);
    portal.fillStyle(0x76638d).fillRect(330, 441, 60, 130);
    for (let i = 0; i < 6; i++) portal.fillStyle(0xd5bb75).fillRect(290, 427 + i * 23, 6, 8).fillRect(424, 427 + i * 23, 6, 8);
    const hero = this.add.sprite(cx, 538, 'spr_player_leader').play('anim_player_leader').setScale(2);
    this.tweens.add({ targets: hero, y: 532, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const companions: DroneArchetype[] = ['BASIC_LASER', 'ROCKET_BOT', 'STUN_BOT', 'PIERCE_BEAM'];
    companions.forEach((type, i) => {
      this.add.sprite(154 + i * 136, 654, unitTexture(type)).play(unitAnimation(type)).setScale(1.9);
    });
    this.label(cx, 723, '소환하고, 조합하고, 함께 나아가세요.', 21, '#e7d8b1');
    pixelPanel(this, 66, 771, 588, 82);
    this.label(cx, 796, '동료 소환   /   조합의 제단   /   던전 탐험', 19, '#d9bd7f');
    this.label(cx, 828, '마력석을 모아 원정대를 이끌고 황혼의 마왕에 도전하세요.', 15, '#aab39b');
    pixelPanel(this, 164, 872, 392, 76, 0x3d5343, 0xc3a76d);
    const start = this.add.rectangle(cx, 910, 392, 76, 0, 0).setInteractive({ useHandCursor: true });
    this.label(cx, 910, '모험 시작', 29, '#f3e6c1');
    start.on('pointerover', () => start.setFillStyle(0xf2d68c, 0.08));
    start.on('pointerout', () => start.setFillStyle(0, 0));
    start.once('pointerdown', () => { soundManager.playPowerup(); this.scene.start('GameScene'); });
    pixelPanel(this, 215, 992, 290, 56);
    const sound = this.add.rectangle(cx, 1020, 290, 56, 0, 0).setInteractive({ useHandCursor: true });
    this.soundBtnText = this.label(cx, 1020, this.getSoundLabel(), 18, '#b9c3a6');
    sound.on('pointerdown', () => {
      soundManager.enabled = !soundManager.enabled;
      this.soundBtnText.setText(this.getSoundLabel());
    });
    this.label(cx, 1168, 'CHAPTER I  ·  THE FORGOTTEN HALLS', 14, '#8d9d86');
    this.label(cx, 1200, '작은 동료들이 모여, 위대한 모험이 됩니다.', 15, '#8d9d86');
  }

  private label(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: FANTASY.font, fontSize: `${size}px`, resolution: 2, fontStyle: 'bold', color, align: 'center' }).setOrigin(0.5);
  }
  private getSoundLabel(): string { return `효과음  ${soundManager.enabled ? '켜짐' : '꺼짐'}`; }
}
