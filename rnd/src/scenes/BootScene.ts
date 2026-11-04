import Phaser from 'phaser';
import { DRONE_SPECS, ENEMY_SPECS } from '../config/gameData';
import type { DroneArchetype, EnemyArchetype } from '../types/game';
import { drawCharacter, unitTexture, unitAnimation, enemyTexture, enemyAnimation } from '../ui/pixelCharacters';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  public create(): void {
    this.createAnimatedSpriteSheets();
    this.createStaticUiTextures();
    this.registerAnimations();
    this.scene.start('MenuScene');
  }

  private createSheet(
    key: string,
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
    drawFrame: (ctx: CanvasRenderingContext2D, frameIndex: number, w: number, h: number) => void
  ): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    const canvasTex = this.textures.createCanvas(key, frameWidth * frameCount, frameHeight);
    if (!canvasTex) return;

    const ctx = canvasTex.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, frameWidth * frameCount, frameHeight);

    for (let f = 0; f < frameCount; f++) {
      ctx.save();
      ctx.translate(f * frameWidth, 0);
      drawFrame(ctx, f, frameWidth, frameHeight);
      ctx.restore();
      canvasTex.add(f, 0, f * frameWidth, 0, frameWidth, frameHeight);
    }

    canvasTex.refresh();
  }

  private createAnimatedSpriteSheets(): void {
    this.createSheet('spr_player_leader', 64, 64, 4,
      (ctx, f, w, h) => drawCharacter(ctx, 'LEADER', f, w, h));
    for (const type of Object.keys(DRONE_SPECS) as DroneArchetype[]) {
      this.createSheet(unitTexture(type), 48, 48, 4,
        (ctx, f, w, h) => drawCharacter(ctx, type, f, w, h));
    }
    for (const type of Object.keys(ENEMY_SPECS) as EnemyArchetype[]) {
      const size = type === 'BOSS_CORE' ? 104 : type === 'ELITE_BRUTE' ? 72 : 52;
      this.createSheet(enemyTexture(type), size, size, 4,
        (ctx, f, w, h) => drawCharacter(ctx, type, f, w, h));
    }
    this.createSheet('spr_bullet', 20, 20, 2, (ctx, f) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 8, 12, 4);
      ctx.fillRect(10, 4 + f * 2, 4, 12 - f * 4);
      ctx.fillStyle = '#fff8db';
      ctx.fillRect(12, 8, 4, 4);
    });
  }

  private createStaticUiTextures(): void {
    const g = this.add.graphics();

    // 파티클 & 충격파 링
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 2, 8, 8);
    g.generateTexture('tex_particle', 12, 12);

    g.clear();
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(48, 48, 42);
    g.generateTexture('tex_ring', 96, 96);

    // 가상 조이스틱 베이스 & 스틱
    g.clear();
    g.fillStyle(0x263a34, 0.75);
    g.lineStyle(3, 0xd9b969, 0.85);
    g.fillCircle(68, 68, 62);
    g.strokeCircle(68, 68, 62);
    g.generateTexture('tex_joy_base', 136, 136);

    g.clear();
    g.fillStyle(0xd9b969, 0.95);
    g.lineStyle(3, 0xefe4c4, 1);
    g.fillCircle(28, 28, 24);
    g.strokeCircle(28, 28, 24);
    g.generateTexture('tex_joy_thumb', 56, 56);

    // 사방 게이트 도어 텍스처
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.lineStyle(2, 0x0f172a, 1);
    g.fillRect(0, 0, 110, 22);
    g.strokeRect(0, 0, 110, 22);
    g.fillStyle(0x777e68);
    for (let x = 8; x < 106; x += 14) g.fillRect(x, 3, 4, 16);
    g.fillStyle(0xbeb28b);
    g.fillRect(2, 2, 106, 3);
    g.fillRect(2, 17, 106, 3);
    g.generateTexture('tex_door_h', 110, 22);

    g.clear();
    g.fillStyle(0xffffff, 1);
    g.lineStyle(2, 0x0f172a, 1);
    g.fillRect(0, 0, 22, 110);
    g.strokeRect(0, 0, 22, 110);
    g.fillStyle(0x777e68);
    for (let y = 8; y < 106; y += 14) g.fillRect(3, y, 16, 4);
    g.fillStyle(0xbeb28b);
    g.fillRect(2, 2, 3, 106);
    g.fillRect(17, 2, 3, 106);
    g.generateTexture('tex_door_v', 22, 110);

    g.destroy();
  }

  private registerAnimations(): void {
    const definitions = [
      { key: 'anim_player_leader', sheet: 'spr_player_leader', end: 3 },
      { key: 'anim_bullet', sheet: 'spr_bullet', end: 1 },
      ...(Object.keys(DRONE_SPECS) as DroneArchetype[]).map(type => ({ key: unitAnimation(type), sheet: unitTexture(type), end: 3 })),
      ...(Object.keys(ENEMY_SPECS) as EnemyArchetype[]).map(type => ({ key: enemyAnimation(type), sheet: enemyTexture(type), end: 3 }))
    ];
    for (const def of definitions) {
      if (!this.anims.exists(def.key)) this.anims.create({
        key: def.key, frames: this.anims.generateFrameNumbers(def.sheet, { start: 0, end: def.end }),
        frameRate: 6, repeat: -1
      });
    }
  }
}
