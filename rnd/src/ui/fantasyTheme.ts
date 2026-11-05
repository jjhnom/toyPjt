import Phaser from 'phaser';

export const FANTASY = {
  ink: 0x101720, panel: 0x1b2633, raised: 0x303e4c, edge: 0x64717c,
  gold: 0xb79a62, cream: '#f5f1dd', muted: '#b6c0c8', green: 0x88b887,
  hp: 0xdb5655, ally: 0x5bc8f3, danger: 0xf17b53, currency: 0xf3c64d,
  font: '"Malgun Gothic", "Segoe UI", sans-serif'
};

export function paintPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number,
  fill = FANTASY.panel, edge = FANTASY.gold): void {
  g.fillStyle(0x080d14).fillRect(x + 3, y + 5, width, height);
  g.fillStyle(edge).fillRect(x + 4, y, width - 8, height).fillRect(x, y + 4, width, height - 8);
  g.fillStyle(0x080e17).fillRect(x + 3, y + 5, width - 6, height - 10);
  g.fillStyle(fill).fillRect(x + 5, y + 5, width - 10, height - 10);
  g.fillStyle(0xffffff, 0.09).fillRect(x + 6, y + 6, width - 12, 3);
  g.fillStyle(0x000000, 0.24).fillRect(x + 5, y + height - 10, width - 10, 5);
  for (const px of [x + 6, x + width - 10]) {
    g.fillStyle(0xe8ce8e).fillRect(px, y + 6, 3, 3).fillRect(px, y + height - 10, 3, 3);
  }
}

export function pixelIcon(g: Phaser.GameObjects.Graphics, kind: 'book' | 'gem' | 'heart', x: number, y: number, scale = 1): void {
  const rect = (px: number, py: number, w: number, h: number, color: number) =>
    g.fillStyle(color).fillRect(x + px * scale, y + py * scale, w * scale, h * scale);
  if (kind === 'book') {
    rect(0, 5, 18, 11, 0x0a101a); rect(1, 5, 16, 10, FANTASY.gold);
    rect(2, 2, 6, 11, 0xf3e6bb); rect(10, 2, 6, 11, 0xf3e6bb);
    rect(8, 3, 2, 12, 0x805e91); rect(3, 1, 4, 2, 0xfff6d9); rect(11, 1, 4, 2, 0xfff6d9);
    for (let row = 0; row < 3; row++) {
      rect(3, 5 + row * 2, 4, 1, 0xb9a57b); rect(11, 5 + row * 2, 4, 1, 0xb9a57b);
    }
  } else if (kind === 'gem') {
    rect(5, 0, 4, 2, 0xdff8ff); rect(3, 2, 8, 3, 0xa9efff); rect(1, 5, 12, 5, FANTASY.ally);
    rect(3, 10, 8, 2, 0x2f8fbf); rect(5, 12, 4, 2, 0x18517f); rect(4, 4, 2, 7, 0xeafcff);
  } else {
    rect(1, 0, 4, 2, 0xff9a8d); rect(7, 0, 4, 2, 0xff9a8d); rect(0, 2, 12, 4, FANTASY.hp);
    rect(2, 6, 8, 2, FANTASY.hp); rect(4, 8, 4, 2, 0xa93540); rect(2, 2, 2, 2, 0xffd4b8);
  }
}

/** Same rectangular hit area; pressed feedback never moves the input target. */
export function fantasyButton(scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  label: string, action: () => void, options: { enabled?: boolean; icon?: 'book'; fontSize?: number; primary?: boolean } = {}): Phaser.GameObjects.Container {
  const enabled = options.enabled !== false;
  const container = scene.add.container(x, y);
  const frame = scene.add.graphics();
  const artFrame = scene.textures.exists('art_frame') ? scene.add.image(0, 0, 'art_frame').setDisplaySize(width, height) : null;
  const hit = scene.add.rectangle(0, 0, width, height, 0, 0);
  const text = scene.add.text(options.icon ? 15 : 0, 0, label, {
    fontFamily: FANTASY.font, fontSize: `${options.fontSize ?? 20}px`, fontStyle: 'bold', resolution: 2,
    color: enabled ? FANTASY.cream : '#7d8993', align: 'center'
  }).setOrigin(0.5).setName('label');
  if (text.width > width - (options.icon ? 58 : 24)) text.setFontSize(Math.floor((options.fontSize ?? 20) * (width - (options.icon ? 58 : 24)) / text.width));
  const draw = (pressed: boolean) => {
    frame.clear();
    if (artFrame) artFrame.setTint(!enabled ? 0x647083 : pressed ? 0xbc9be2 : options.primary ? 0xffe5b1 : 0xe5d5ba);
    else paintPanel(frame, -width / 2, -height / 2, width, height,
        !enabled ? 0x202934 : pressed ? 0x49516a : options.primary ? 0x3a344d : FANTASY.raised,
        enabled ? FANTASY.gold : 0x46525e);
    if (options.icon) pixelIcon(frame, options.icon, -width / 2 + 13, -12 + (pressed ? 2 : 0), 1.5);
    text.y = pressed ? 2 : 0;
  };
  draw(false);
  if (artFrame) container.add(artFrame);
  container.add([frame, hit, text]);
  if (enabled) hit.setInteractive({ useHandCursor: true })
    .on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); draw(true); action();
    })
    .on('pointerup', () => draw(false)).on('pointerout', () => draw(false));
  return container;
}

export function pixelPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  fill = FANTASY.panel, edge = FANTASY.edge): Phaser.GameObjects.Graphics | Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice {
  if (scene.textures.exists('art_panel') && width >= 64 && height >= 48) {
    if (scene.game.renderer.type === Phaser.WEBGL) {
      const capX = Math.min(24, Math.floor(width / 4)), capY = Math.min(24, Math.floor(height / 4));
      return scene.add.nineslice(x + width / 2, y + height / 2, 'art_panel', undefined, width, height, capX, capX, capY, capY);
    }
    // NineSlice is WebGL-only; Canvas keeps fixed-width rails with paintPanel.
  }
  const g = scene.add.graphics();
  paintPanel(g, x, y, width, height, fill, edge);
  return g;
}

export function dungeonFloor(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number,
  palette = { background: 0x151d25, floor: 0x2a3439, moss: 0x54704a }): void {
  g.fillStyle(palette.background).fillRect(x, y, width, height);
  const tile = 48;
  for (let row = 0; row * tile < height; row++) {
    for (let col = 0; col * tile < width; col++) {
      const px = x + col * tile, py = y + row * tile;
      const w = Math.min(tile - 3, width - col * tile - 2);
      const h = Math.min(tile - 3, height - row * tile - 2);
      const seed = (col * 17 + row * 31) % 6;
      g.fillStyle(0x070d15, 0.65).fillRect(px, py, w + 2, h + 2);
      g.fillStyle(palette.floor, 0.82 + seed * 0.035).fillRect(px + 1, py + 1, w, h);
      g.fillStyle(0xc1c8c5, 0.13).fillRect(px + 2, py + 2, w - 3, 2).fillRect(px + 2, py + 2, 2, h - 3);
      g.fillStyle(0x080c15, 0.38).fillRect(px + 2, py + h - 2, w - 2, 2);
      const edge = col === 0 || row === 0 || (col + 1) * tile >= width || (row + 1) * tile >= height;
      if ((seed === 2 || seed === 4) && edge) {
        g.fillStyle(palette.moss, 0.65).fillRect(px + 4, py + h - 7, 14, 4).fillRect(px + 6, py + h - 12, 6, 5);
        g.fillStyle(0xb5c68a, 0.2).fillRect(px + 8, py + h - 10, 3, 3);
      }
      if (seed === 1 || seed === 5) g.fillStyle(0x10151f, 0.7).fillRect(px + 18, py + 5, 2, 12)
        .fillRect(px + 20, py + 15, 6, 2).fillRect(px + 25, py + 17, 2, 6);
      if (seed === 3) g.fillStyle(0xbac0b8, 0.08).fillRect(px + 10, py + 18, 9, 3).fillRect(px + 29, py + 31, 6, 2);
      if (seed === 0) g.lineStyle(1, 0xb0bec8, 0.08).strokeRect(px + 8, py + 8, Math.max(1, w - 16), Math.max(1, h - 16));
    }
  }
}
