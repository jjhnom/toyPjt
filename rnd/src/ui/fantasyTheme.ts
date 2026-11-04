import Phaser from 'phaser';

export const FANTASY = {
  ink: 0x151b22, panel: 0x243039, raised: 0x34434a, edge: 0x657167,
  gold: 0xd9b969, cream: '#efe4c4', muted: '#aab39b', green: 0x73965e,
  font: '"Courier New", "Malgun Gothic", monospace'
};

export function pixelPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  fill = FANTASY.panel, edge = FANTASY.edge): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x0c1218).fillRect(x + 4, y + 6, width, height);
  g.fillStyle(edge).fillRect(x, y, width, height);
  g.fillStyle(fill).fillRect(x + 3, y + 3, width - 6, height - 6);
  g.fillStyle(0xffffff, 0.08).fillRect(x + 3, y + 3, width - 6, 3);
  g.fillStyle(FANTASY.gold);
  for (const [cx, cy] of [[x + 6, y + 6], [x + width - 10, y + 6], [x + 6, y + height - 10], [x + width - 10, y + height - 10]]) {
    g.fillRect(cx, cy, 4, 4);
  }
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
      const seed = (col * 17 + row * 31) % 13;
      g.fillStyle(palette.floor, seed < 3 ? 1 : seed < 8 ? 0.9 : 0.8).fillRect(px + 1, py + 1, w, h);
      g.fillStyle(0x54605a, 0.35).fillRect(px + 2, py + 2, w - 2, 2);
      if (seed === 2 || seed === 7) {
        g.fillStyle(palette.moss, 0.5).fillRect(px + 4, py + h - 7, 10, 4).fillRect(px + 4, py + h - 11, 4, 4);
      }
      if (seed === 5) g.fillStyle(0x172127).fillRect(px + 20, py + 5, 3, 15).fillRect(px + 23, py + 17, 8, 3);
    }
  }
}
