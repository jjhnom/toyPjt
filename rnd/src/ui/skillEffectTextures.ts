import type Phaser from 'phaser';
import type { DroneArchetype, SkillShape } from '../types/game';
import { UNIT_COMBAT_STYLES } from '../config/skillData';

export const skillProjectileTexture = (unit: DroneArchetype): string => `skill_projectile_${unit}`;
export const skillGlyphTexture = (shape: SkillShape): string => `skill_glyph_${shape}`;
export const skillWaveTexture = (shape: SkillShape): string => `skill_wave_${shape}`;

/** Tiny original pixel silhouettes, prepared once at boot; no bitmap downloads or frame-time drawing. */
function paint(ctx: CanvasRenderingContext2D, shape: SkillShape, color: number, accent: number): void {
  const rect = (x: number, y: number, w: number, h: number, c = color) => {
    ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
    ctx.fillRect(x, y, w, h);
  };
  switch (shape) {
    case 'arrow':
      rect(3, 15, 22, 3); rect(18, 11, 6, 3); rect(21, 13, 7, 3); rect(21, 17, 5, 3);
      rect(18, 20, 6, 2); rect(5, 12, 5, 2); rect(4, 19, 5, 2); rect(11, 15, 13, 1, accent); break;
    case 'streak':
      rect(1, 12, 20, 2); rect(5, 16, 24, 3); rect(2, 21, 18, 2); rect(19, 14, 9, 7);
      rect(10, 17, 18, 1, accent); break;
    case 'fire':
      rect(2, 10, 8, 3); rect(0, 19, 11, 3); rect(6, 13, 19, 11); rect(12, 9, 12, 18);
      rect(22, 12, 6, 11); rect(8, 7, 4, 5); rect(16, 13, 8, 10, accent); rect(21, 15, 6, 5, 0xfff5d6); break;
    case 'frost':
      rect(13, 3, 6, 26); rect(4, 13, 24, 6); rect(7, 7, 4, 4); rect(21, 7, 4, 4);
      rect(7, 22, 4, 4); rect(21, 22, 4, 4); rect(14, 9, 3, 14, accent); rect(10, 14, 13, 3, accent); break;
    case 'star':
      rect(2, 15, 28, 2); rect(16, 5, 4, 22); rect(10, 12, 16, 8); rect(13, 9, 10, 14);
      rect(16, 12, 4, 9, accent); break;
    case 'void':
      rect(8, 4, 16, 3); rect(4, 8, 3, 16); rect(25, 8, 3, 16); rect(8, 25, 16, 3);
      rect(8, 8, 16, 16, 0x21132f); rect(11, 8, 12, 3, accent); rect(21, 11, 3, 9, accent);
      rect(10, 20, 11, 3); break;
    case 'bolt':
      rect(15, 2, 6, 8); rect(11, 9, 7, 8); rect(15, 15, 7, 7); rect(10, 21, 7, 9);
      rect(5, 12, 6, 3, accent); rect(23, 8, 5, 3, accent); rect(18, 14, 10, 2, accent); break;
    case 'stone':
      rect(7, 6, 18, 21); rect(4, 11, 24, 11); rect(10, 8, 11, 4, accent);
      rect(7, 12, 4, 9, accent); rect(18, 20, 7, 5, 0x655544); break;
    case 'leaf':
      rect(9, 6, 15, 16); rect(5, 11, 21, 7); rect(8, 20, 10, 6); rect(13, 13, 4, 14, accent);
      rect(17, 9, 6, 3, accent); break;
    case 'slash':
      rect(21, 3, 7, 4); rect(17, 7, 7, 5); rect(13, 12, 7, 6); rect(9, 18, 7, 6);
      rect(4, 24, 8, 3); rect(18, 9, 3, 6, accent); rect(13, 15, 3, 7, accent); break;
    case 'thorn':
      rect(3, 15, 26, 3); rect(8, 8, 3, 7); rect(14, 17, 3, 9); rect(21, 7, 3, 9);
      rect(11, 15, 15, 1, accent); break;
    case 'poison':
      rect(14, 3, 4, 6); rect(11, 9, 10, 5); rect(7, 14, 18, 11);
      rect(10, 25, 12, 3); rect(10, 16, 4, 6, accent); rect(23, 6, 4, 4, accent); break;
    case 'holy':
      rect(13, 3, 6, 26); rect(5, 11, 22, 6); rect(15, 5, 2, 21, accent);
      rect(7, 13, 18, 2, accent); rect(3, 3, 3, 3); rect(25, 25, 3, 3); break;
    case 'feather':
      rect(7, 5, 8, 5); rect(12, 8, 8, 5); rect(16, 12, 9, 5); rect(12, 17, 9, 5);
      rect(7, 21, 9, 4); rect(4, 25, 7, 3); rect(14, 10, 3, 15, accent); break;
  }
}

export function createSkillEffectTextures(scene: Phaser.Scene): void {
  for (const [unit, style] of Object.entries(UNIT_COMBAT_STYLES)) {
    const canvas = scene.textures.createCanvas(skillProjectileTexture(unit as DroneArchetype), 32, 32)!;
    paint(canvas.getContext(), style.shape, style.color, style.accent);
    canvas.refresh();
    if (!scene.textures.exists(skillGlyphTexture(style.shape))) {
      const glyph = scene.textures.createCanvas(skillGlyphTexture(style.shape), 32, 32)!;
      paint(glyph.getContext(), style.shape, 0xffffff, 0xffffff);
      glyph.refresh();
    }
    if (!scene.textures.exists(skillWaveTexture(style.shape))) {
      const wave = scene.textures.createCanvas(skillWaveTexture(style.shape), 96, 96)!;
      const ctx = wave.getContext();
      ctx.fillStyle = '#ffffff';
      // A sparse pixel outline, with a maximum radius of 42 like tex_ring.
      // Shape changes the contour, rather than relying on element color alone.
      for (let y = 4; y < 92; y += 2) for (let x = 4; x < 92; x += 2) {
        const dx = x + 1 - 48, dy = y + 1 - 48;
        const angle = Math.atan2(dy, dx);
        const radius = Math.hypot(dx, dy);
        const edge = style.shape === 'frost' ? 38 + 4 * Math.cos(angle * 6)
          : style.shape === 'fire' || style.shape === 'feather' ? 38 + 4 * Math.sin(angle * 9)
          : style.shape === 'stone' ? 38 + 4 * Math.cos(angle * 4)
          : 42;
        const gap = style.shape === 'void' && Math.sin(angle * 3) > 0.65;
        if (!gap && radius <= edge && radius >= edge - 2.5) ctx.fillRect(x, y, 2, 2);
      }
      wave.refresh();
    }
  }
  for (const kind of ['heal', 'shield', 'buff', 'rune', 'slow', 'poison'] as const) {
    const canvas = scene.textures.createCanvas(`skill_${kind}`, 32, 32)!;
    const ctx = canvas.getContext();
    ctx.fillStyle = '#ffffff';
    if (kind === 'heal') {
      ctx.fillRect(13, 5, 6, 22); ctx.fillRect(5, 13, 22, 6);
    } else if (kind === 'buff') {
      ctx.fillRect(13, 13, 6, 15); ctx.fillRect(9, 9, 14, 5); ctx.fillRect(13, 5, 6, 5);
    } else if (kind === 'slow') {
      paint(ctx, 'frost', 0xffffff, 0xffffff);
    } else if (kind === 'poison') {
      paint(ctx, 'poison', 0xffffff, 0xffffff);
    } else {
      for (let y = 2; y < 30; y += 2) for (let x = 2; x < 30; x += 2) {
        const r = (x - 16) ** 2 + (y - 16) ** 2;
        if (r >= 130 && r <= 200) ctx.fillRect(x, y, 2, 2);
      }
      if (kind === 'rune') {
        ctx.fillRect(14, 5, 3, 22); ctx.fillRect(5, 14, 22, 3);
      } else {
        ctx.fillRect(10, 10, 12, 3); ctx.fillRect(10, 13, 3, 7); ctx.fillRect(19, 13, 3, 7); ctx.fillRect(13, 20, 6, 3);
      }
    }
    canvas.refresh();
  }
  const line = scene.textures.createCanvas('skill_line', 2, 2)!;
  line.getContext().fillStyle = '#ffffff';
  line.getContext().fillRect(0, 0, 2, 2); line.refresh();
}
