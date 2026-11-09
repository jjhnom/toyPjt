import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';

export class VirtualJoystick {
  public dirX = 0;
  public dirY = 0;

  private scene: Phaser.Scene;
  private baseSprite: Phaser.GameObjects.Image;
  private thumbSprite: Phaser.GameObjects.Image;
  private hintText: Phaser.GameObjects.Text;

  private activePointerId: number | null = null;
  private anchorX = 130;
  private anchorY = GAME_HEIGHT - 50;
  private maxRadius = 64;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.baseSprite = scene.add
      .image(this.anchorX, this.anchorY, 'tex_joy_base')
      .setDisplaySize(100,100)
      .setDepth(60)
      .setAlpha(0.82);
    this.thumbSprite = scene.add
      .image(this.anchorX, this.anchorY, 'tex_joy_thumb')
      .setDisplaySize(42,42)
      .setDepth(61)
      .setAlpha(0.92);

    this.hintText = scene.add
      .text(130,1184,'드래그 이동 / WASD',{
        fontFamily: 'sans-serif',
        fontSize:'13px',
        color: '#94a3b8'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(60);

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasdKeys = scene.input.keyboard.addKeys('W,A,S,D') as {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
      };
    }

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== null) return;

    // 좌측 하단 및 하단 조작 영역(Y > 220) 터치 시 해당 위치에 동적 앵커링
    if (pointer.y < 160) return;

    this.activePointerId = pointer.id;
    this.anchorX = Phaser.Math.Clamp(pointer.x, 85, GAME_WIDTH - 85);
    this.anchorY = Phaser.Math.Clamp(pointer.y,240,GAME_HEIGHT-55);

    this.baseSprite.setPosition(this.anchorX, this.anchorY).setAlpha(0.85);
    this.thumbSprite.setPosition(this.anchorX, this.anchorY).setAlpha(1.0);
    this.dirX = 0;
    this.dirY = 0;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) return;

    const dx = pointer.x - this.anchorX;
    const dy = pointer.y - this.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.001) {
      const clampedDist = Math.min(dist, this.maxRadius);
      const nx = dx / dist;
      const ny = dy / dist;

      this.thumbSprite.setPosition(
        this.anchorX + nx * clampedDist,
        this.anchorY + ny * clampedDist
      );

      this.dirX = nx * (clampedDist / this.maxRadius);
      this.dirY = ny * (clampedDist / this.maxRadius);
    } else {
      this.thumbSprite.setPosition(this.anchorX, this.anchorY);
      this.dirX = 0;
      this.dirY = 0;
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) return;

    this.activePointerId = null;
    this.dirX = 0;
    this.dirY = 0;

    // 기본 좌측 하단 대기 위치로 복귀
    this.anchorX = 130;
    this.anchorY = GAME_HEIGHT - 50;
    this.baseSprite.setPosition(this.anchorX, this.anchorY).setAlpha(0.82);
    this.thumbSprite.setPosition(this.anchorX, this.anchorY).setAlpha(0.92);
  }

  public update(): void {
    if (this.activePointerId !== null) return;

    let kx = 0;
    let ky = 0;
    if (this.cursors) {
      if (this.cursors.left.isDown) kx -= 1;
      if (this.cursors.right.isDown) kx += 1;
      if (this.cursors.up.isDown) ky -= 1;
      if (this.cursors.down.isDown) ky += 1;
    }
    if (this.wasdKeys) {
      if (this.wasdKeys.A.isDown) kx -= 1;
      if (this.wasdKeys.D.isDown) kx += 1;
      if (this.wasdKeys.W.isDown) ky -= 1;
      if (this.wasdKeys.S.isDown) ky += 1;
    }

    if (kx !== 0 || ky !== 0) {
      const len = Math.sqrt(kx * kx + ky * ky);
      this.dirX = kx / len;
      this.dirY = ky / len;
      this.thumbSprite.setPosition(
        this.anchorX + this.dirX * (this.maxRadius * 0.75),
        this.anchorY + this.dirY * (this.maxRadius * 0.75)
      );
    } else {
      this.dirX = 0;
      this.dirY = 0;
      this.thumbSprite.setPosition(this.anchorX, this.anchorY);
    }
  }

  public reset(): void {
    this.activePointerId = null;
    this.dirX = 0;
    this.dirY = 0;
    this.anchorX = 130;
    this.anchorY = GAME_HEIGHT - 50;
    this.baseSprite.setPosition(this.anchorX, this.anchorY);
    this.thumbSprite.setPosition(this.anchorX, this.anchorY);
    this.scene.input.keyboard?.resetKeys();
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.baseSprite.destroy();
    this.thumbSprite.destroy();
    this.hintText.destroy();
  }
}
