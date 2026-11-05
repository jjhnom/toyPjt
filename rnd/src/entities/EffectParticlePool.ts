import Phaser from 'phaser';
import { UNIT_COMBAT_STYLES, UNIQUE_SKILLS } from '../config/skillData';
import type { DroneArchetype, SkillEffectKind } from '../types/game';
import { skillGlyphTexture, skillWaveTexture } from '../ui/skillEffectTextures';

export class EffectParticle extends Phaser.GameObjects.Sprite {
  private vx = 0;
  private vy = 0;
  private elapsedMs = 0;
  private durationMs = 300;
  private startScale = 1;
  private isRing = false;
  private isLine = false;
  private spin = 0;
  private startAlpha = 1;

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
    this.anims.stop();
    this.setRotation(0).setDepth(35).setFlip(false, false).setOrigin(0.5).clearTint();
    this.spin = 0;
    this.startAlpha = 1;
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
    this.isLine = false;
    this.setActive(true);
    this.setVisible(true);
  }

  public launchShockwave(x: number, y: number, radius: number, color: number, texture = 'tex_ring', spin = 0): void {
    this.launchSpark(x, y, 0, 0, color);
    this.setTexture(texture);
    this.spin = spin;
    this.setPosition(x, y);
    this.setTint(color);
    this.vx = 0;
    this.vy = 0;
    this.startScale = Math.max(0.1, radius / 42);
    this.setScale(this.startScale * 0.25);
    this.fadeFrom(0.65);
    this.elapsedMs = 0;
    this.durationMs = 260;
    this.isRing = true;
    this.setActive(true);
    this.setVisible(true);
  }

  public launchGlyph(texture: string, x: number, y: number, color: number, size: number, duration: number, angle = 0): void {
    this.launchSpark(x, y, 0, 0, color, size / 32, duration);
    this.setTexture(texture).setRotation(angle);
  }

  public launchFragment(texture: string, x: number, y: number, vx: number, vy: number,
    color: number, size: number, duration: number, angle = 0, spin = 0): void {
    this.launchGlyph(texture, x, y, color, size, duration, angle);
    this.vx = vx;
    this.vy = vy;
    this.spin = spin;
  }

  public launchLine(x: number, y: number, toX: number, toY: number, color: number, thickness: number): void {
    this.launchSpark((x + toX) / 2, (y + toY) / 2, 0, 0, color, 1, 110);
    this.setTexture('skill_line').setDisplaySize(Math.hypot(toX - x, toY - y), thickness);
    this.setRotation(Math.atan2(toY - y, toX - x));
    this.isLine = true;
  }

  public fadeFrom(alpha: number): this {
    this.startAlpha = alpha;
    return this.setAlpha(alpha);
  }

  public override update(_time: number, delta: number): void {
    if (!this.active) return;

    this.elapsedMs += delta;
    const t = Math.min(1, this.elapsedMs / this.durationMs);
    this.rotation += this.spin * delta / 1000;

    if (this.isLine) {
      this.setAlpha(this.startAlpha * (1 - t));
    } else if (this.isRing) {
      this.setScale(this.startScale * (0.25 + 0.75 * (1 - (1 - t) ** 3)));
      this.setAlpha(this.startAlpha * (1 - t));
    } else {
      const dt = delta / 1000;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.setScale(this.startScale * (1 - t * 0.7));
      this.setAlpha(this.startAlpha * (1 - t));
    }

    if (this.elapsedMs >= this.durationMs) {
      this.setActive(false);
      this.setVisible(false);
    }
  }
}

export class EffectParticleGroup extends Phaser.GameObjects.Group {
  private trailsThisFrame = 0;
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
      if (this.countActive(true) >= 100) break; // Reserve the last 20 slots for skill feedback.
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

  public beginFrame(): void { this.trailsThisFrame = 0; }

  public emitCast(unit: DroneArchetype, x: number, y: number, angle: number): void {
    const style = UNIT_COMBAT_STYLES[unit];
    const p = this.get(x, y) as EffectParticle | null;
    p?.launchGlyph(skillGlyphTexture(style.shape), x, y, style.accent, style.intensity === 'S' ? 12 : 18, 130, angle);
    if (style.intensity !== 'S') {
      const rune = this.get(x, y) as EffectParticle | null;
      rune?.launchFragment('skill_rune', x, y + 14, 0, 0, style.color, 34, 180, 0, 1.5);
      rune?.setDepth(18).fadeFrom(0.55);
    }
  }

  public emitTrail(unit: DroneArchetype, x: number, y: number, angle: number): void {
    if (this.trailsThisFrame >= 12 || this.countActive(true) >= 60) return;
    this.trailsThisFrame++;
    const style = UNIT_COMBAT_STYLES[unit];
    const p = this.get(x, y) as EffectParticle | null;
    const drifting = style.shape === 'fire' || style.shape === 'feather' || style.shape === 'frost';
    p?.launchFragment(skillGlyphTexture(style.shape), x, y,
      -Math.cos(angle) * (drifting ? 28 : 0), -Math.sin(angle) * (drifting ? 28 : 0),
      style.color, style.intensity === 'S' ? 7 : 11, drifting ? 180 : 100, angle,
      style.shape === 'void' ? 5 : drifting ? 2 : 0);
  }

  public emitHit(unit: DroneArchetype, x: number, y: number): void {
    const style = UNIT_COMBAT_STYLES[unit];
    const p = this.get(x, y) as EffectParticle | null;
    p?.launchGlyph(skillGlyphTexture('star'), x, y, 0xfff5d6, style.intensity === 'S' ? 14 : 22, 90);
    const shard = this.get(x, y) as EffectParticle | null;
    shard?.launchFragment(skillGlyphTexture(style.shape), x, y, 0, -28, style.accent,
      style.intensity === 'S' ? 12 : 20, 170, 0, style.shape === 'void' ? 5 : 0);
    this.emitBurst(x, y, style.color, style.intensity === 'S' ? 2 : 4, 80);
  }

  public emitExplosion(unit: DroneArchetype, x: number, y: number, radius: number): void {
    const style = UNIT_COMBAT_STYLES[unit];
    const ring = this.get(x, y) as EffectParticle | null;
    ring?.launchShockwave(x, y, radius, style.color, skillWaveTexture(style.shape), style.shape === 'void' ? 3 : 0);
    // Fragments stay within the instantaneous damage radius and fade in under 300ms.
    for (let i = 0; i < 6; i++) {
      if (this.countActive(true) >= 100) break;
      const angle = Math.PI * 2 * i / 6;
      const p = this.get(x, y) as EffectParticle | null;
      p?.launchFragment(skillGlyphTexture(style.shape), x + Math.cos(angle) * radius * 0.35,
        y + Math.sin(angle) * radius * 0.35, Math.cos(angle) * radius, Math.sin(angle) * radius,
        style.accent, style.shape === 'frost' ? 16 : 12, 260, angle, style.shape === 'void' ? 5 : 1.5);
    }
  }

  public emitSkill(kind: SkillEffectKind, x: number, y: number, unit: DroneArchetype): void {
    const style = UNIT_COMBAT_STYLES[unit];
    const texture = kind === 'poison' ? 'skill_poison' : kind === 'heal' ? 'skill_heal' : kind === 'shield' ? 'skill_shield'
      : kind === 'buff' && unit !== 'SHADOW_ASSASSIN' ? 'skill_buff' : kind === 'summon' ? 'skill_rune'
      : skillGlyphTexture(kind === 'revive' ? 'feather' : kind === 'burn' ? 'fire' : style.shape);
    const color = kind === 'poison' ? 0x79d842 : kind === 'heal' ? 0x79d878 : kind === 'shield' ? 0x9ceeff
      : kind === 'buff' && unit !== 'SHADOW_ASSASSIN' ? 0xffb55a : style.accent;
    const p = this.get(x, y) as EffectParticle | null;
    p?.launchFragment(texture, x, y + (kind === 'summon' ? 14 : kind === 'heal' || kind === 'buff' ? -24 : 0),
      0, kind === 'heal' ? -65 : kind === 'buff' || kind === 'poison' ? -35 : 0, color,
      kind === 'summon' ? 52 : kind === 'revive' ? 44 : kind === 'poison' ? 14 : 26,
      kind === 'split' ? 150 : kind === 'heal' ? 480 : 380,
      0, kind === 'summon' ? 2 : 0);
    if (kind === 'summon') p?.setDepth(18);
    if (kind === 'summon' || kind === 'revive') this.emitShockwave(x, y + 12, 34, color);
    if (kind === 'burn') this.emitExplosion(unit, x, y, UNIQUE_SKILLS.lava.radius);
    if (kind === 'revive') this.emitBurst(x, y, style.color, 6, 95);
  }

  public emitLightning(x: number, y: number, toX: number, toY: number, color: number, branch: number): void {
    const dx = toX - x, dy = toY - y, length = Math.max(1, Math.hypot(dx, dy));
    let fromX = x, fromY = y;
    for (let i = 1; i <= 4; i++) {
      const bend = i === 4 ? 0 : (i % 2 ? 5 : -5);
      const endX = x + dx * i / 4 - dy / length * bend;
      const endY = y + dy * i / 4 + dx / length * bend;
      const p = this.get(fromX, fromY) as EffectParticle | null;
      p?.launchLine(fromX, fromY, endX, endY, color, Math.max(1, 3 - branch * 0.3));
      p?.fadeFrom(Math.max(0.4, 1 - branch * 0.08));
      fromX = endX; fromY = endY;
    }
  }
}
