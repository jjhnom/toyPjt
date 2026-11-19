import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { FANTASY } from './fantasyTheme';
import {BOTTOM_HUD} from './bottomHudArt';

export class VirtualJoystick {
  public dirX = 0;
  public dirY = 0;

  private scene: Phaser.Scene;
  private baseSprite: Phaser.GameObjects.Image;
  private thumbSprite: Phaser.GameObjects.Image;
  private hintText: Phaser.GameObjects.Text;

  private activePointerId: number | null = null;
  private anchorX = 90;
  private anchorY = GAME_HEIGHT - 50;
  private maxRadius = 64;
  private readonly onCancelled = () => {
    this.reset();
    this.onInputCancelled();
  };

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, private readonly onInputCancelled: () => void = () => {}) {
    this.scene = scene;

    this.baseSprite = scene.add
      .image(this.anchorX, this.anchorY,BOTTOM_HUD,'joystick')
      .setDisplaySize(94,94)
      .setDepth(60)
      .setAlpha(1);
    this.thumbSprite = scene.add
      .image(this.anchorX, this.anchorY, 'tex_joy_thumb')
      .setDisplaySize(46,46)
      .setDepth(61)
      .setAlpha(1);

    this.hintText = scene.add
      .text(181,1230,'드래그 이동\nWASD',{
        fontFamily:FANTASY.font,
        fontSize:'12px',align:'center',resolution:2,
        color:FANTASY.muted,stroke:'#140e24',strokeThickness:2
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
    scene.game.events.on('blur', this.onCancelled);
    scene.game.canvas.addEventListener('touchcancel', this.onCancelled, true);
    scene.game.canvas.addEventListener('pointercancel', this.onCancelled, true);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== null) return;

    // Logical canvas coordinates: left lower arena, or the joystick's own bottom slot.
    // The squad board occupies y=1080..1180; bottom action buttons start at x=220.
    const inArena = pointer.x >= 0 && pointer.x < GAME_WIDTH / 2
      && pointer.y >= GAME_HEIGHT / 2 && pointer.y < 1080;
    const inControlSlot = pointer.x >= 0 && pointer.x < 220
      && pointer.y >= 1180 && pointer.y <= GAME_HEIGHT;
    if (!inArena && !inControlSlot) return;

    this.activePointerId = pointer.id;
    this.anchorX = Phaser.Math.Clamp(pointer.x, 85, GAME_WIDTH / 2 - this.maxRadius);
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
    this.anchorX = 90;
    this.anchorY = GAME_HEIGHT - 50;
    this.baseSprite.setPosition(this.anchorX, this.anchorY).setAlpha(1);
    this.thumbSprite.setPosition(this.anchorX, this.anchorY).setAlpha(1);
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
    this.anchorX = 90;
    this.anchorY = GAME_HEIGHT - 50;
    this.baseSprite.setPosition(this.anchorX, this.anchorY).setAlpha(1);
    this.thumbSprite.setPosition(this.anchorX, this.anchorY).setAlpha(1);
    this.scene.input.keyboard?.resetKeys();
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.scene.game.events.off('blur', this.onCancelled);
    this.scene.game.canvas.removeEventListener('touchcancel', this.onCancelled, { capture: true });
    this.scene.game.canvas.removeEventListener('pointercancel', this.onCancelled, { capture: true });
    this.baseSprite.destroy();
    this.thumbSprite.destroy();
    this.hintText.destroy();
  }
}
