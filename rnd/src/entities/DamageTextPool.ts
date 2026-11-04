import Phaser from 'phaser';

export class DamageText extends Phaser.GameObjects.Text {
  private elapsedMs = 0;
  private durationMs = 520;
  private velocityY = -55;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.setOrigin(0.5, 0.5);
    this.setDepth(45);
  }

  public show(x: number, y: number, text: string, colorHex = '#ffffff'): void {
    this.setPosition(x, y);
    this.setText(text);
    this.setColor(colorHex);
    this.setAlpha(1);
    this.setScale(1);
    this.elapsedMs = 0;
    this.setActive(true);
    this.setVisible(true);
  }

  public override update(_time: number, delta: number): void {
    if (!this.active) return;

    this.elapsedMs += delta;
    this.y += (this.velocityY * delta) / 1000;
    const progress = this.elapsedMs / this.durationMs;
    this.setAlpha(Math.max(0, 1 - progress));

    if (this.elapsedMs >= this.durationMs) {
      this.setActive(false);
      this.setVisible(false);
    }
  }
}

export class DamageTextGroup extends Phaser.GameObjects.Group {
  constructor(scene: Phaser.Scene) {
    super(scene, {
      classType: DamageText,
      maxSize: 60,
      runChildUpdate: true
    });
    scene.sys.updateList.add(this as unknown as Phaser.GameObjects.GameObject);
  }

  public spawnText(x: number, y: number, value: number | string, colorHex = '#ffffff'): void {
    const item = this.get(x, y) as DamageText | null;
    if (!item) return;
    item.show(x, y, String(value), colorHex);
  }
}
