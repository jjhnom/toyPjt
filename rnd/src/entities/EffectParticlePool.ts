import Phaser from 'phaser';

export class EffectParticle extends Phaser.GameObjects.Sprite {
  private vx = 0;
  private vy = 0;
  private elapsedMs = 0;
  private durationMs = 300;
  private startScale = 1;
  private isRing = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'tex_particle');
    this.setDepth(35);
  }

  public launchSpark(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: number,
    scale = 1,
    durationMs = 280
  ): void {
    this.setTexture('tex_particle');
    this.setPosition(x, y);
    this.setTint(color);
    this.vx = vx;
    this.vy = vy;
    this.startScale = scale;
    this.setScale(scale);
    this.setAlpha(1);
    this.elapsedMs = 0;
    this.durationMs = durationMs;
    this.isRing = false;
    this.setActive(true);
    this.setVisible(true);
  }

  public launchShockwave(x: number, y: number, radius: number, color: number): void {
    this.setTexture('tex_ring');
    this.setPosition(x, y);
    this.setTint(color);
    this.vx = 0;
    this.vy = 0;
    this.startScale = Math.max(0.4, radius / 48);
    this.setScale(0.2);
    this.setAlpha(0.85);
    this.elapsedMs = 0;
    this.durationMs = 260;
    this.isRing = true;
    this.setActive(true);
    this.setVisible(true);
  }

  public override update(_time: number, delta: number): void {
    if (!this.active) return;

    this.elapsedMs += delta;
    const t = Math.min(1, this.elapsedMs / this.durationMs);

    if (this.isRing) {
      this.setScale(0.2 + (this.startScale - 0.2) * t);
      this.setAlpha(0.85 * (1 - t));
    } else {
      const dt = delta / 1000;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.setScale(this.startScale * (1 - t * 0.7));
      this.setAlpha(1 - t);
    }

    if (this.elapsedMs >= this.durationMs) {
      this.setActive(false);
      this.setVisible(false);
    }
  }
}

export class EffectParticleGroup extends Phaser.GameObjects.Group {
  constructor(scene: Phaser.Scene) {
    super(scene, {
      classType: EffectParticle,
      maxSize: 120,
      runChildUpdate: true
    });
    scene.sys.updateList.add(this as unknown as Phaser.GameObjects.GameObject);
  }

  public emitBurst(x: number, y: number, color: number, count = 6, speed = 150): void {
    for (let i = 0; i < count; i++) {
      const p = this.get(x, y) as EffectParticle | null;
      if (!p) break;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.6 + Math.random() * 0.6);
      p.launchSpark(
        x,
        y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        0.8 + Math.random() * 0.5,
        240 + Math.random() * 120
      );
    }
  }

  public emitShockwave(x: number, y: number, radius: number, color: number): void {
    const ring = this.get(x, y) as EffectParticle | null;
    if (ring) {
      ring.launchShockwave(x, y, radius, color);
    }
  }
}
