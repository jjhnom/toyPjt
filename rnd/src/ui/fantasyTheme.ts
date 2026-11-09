import Phaser from 'phaser';

/** Semantic colors from detailed design v2. Existing FANTASY keys remain compatible. */
export const DESIGN_TOKENS = {
  background: { base: 0x12152f, deep: 0x0c1022 },
  surface: { panel: 0x2a1f3f, raised: 0x473b72, slate: 0x1b2633 },
  accent: { magic: 0x6a30f0, ice: 0x3fb7ff, fire: 0xff9f3a, gold: 0xffd966, heal: 0x68d96c },
  text: { primary: '#f4e9ff', secondary: '#b9b0d2', onPrimary: '#302035', selected: '#ffe9aa' },
  state: { danger: 0xff5a65, disabledFill: 0x302d43, disabledEdge: 0x6c627e, disabledText: '#b9b0c6' },
  stroke: { soft: 0x8b6eb6, light: 0xc5a0f2, goldShade: 0xb67b36 },
  font: '"Malgun Gothic", "Segoe UI", sans-serif'
};

export const FANTASY = {
  ink: DESIGN_TOKENS.background.base, panel: DESIGN_TOKENS.surface.panel,
  raised: DESIGN_TOKENS.surface.raised, edge: DESIGN_TOKENS.stroke.soft,
  gold: DESIGN_TOKENS.accent.gold, cream: DESIGN_TOKENS.text.primary, muted: DESIGN_TOKENS.text.secondary,
  green: DESIGN_TOKENS.accent.heal, hp: DESIGN_TOKENS.state.danger, ally: DESIGN_TOKENS.accent.ice,
  danger: DESIGN_TOKENS.state.danger, currency: DESIGN_TOKENS.accent.gold,
  primary: DESIGN_TOKENS.accent.gold, slate: DESIGN_TOKENS.surface.slate, violet: 0xb78bff,
  font: DESIGN_TOKENS.font
};

/** Integer corner cuts keep panel/button silhouettes crisp with nearest-neighbor rendering. */
function clippedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number,
  color: number, cut = 6): void {
  const c = Math.min(cut, width / 4, height / 4);
  g.fillStyle(color).fillPoints([
    { x: x + c, y }, { x: x + width - c, y }, { x: x + width, y: y + c },
    { x: x + width, y: y + height - c }, { x: x + width - c, y: y + height },
    { x: x + c, y: y + height }, { x, y: y + height - c }, { x, y: y + c }
  ], true);
}

export function paintPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number,
  fill = FANTASY.panel, edge = FANTASY.gold): void {
  clippedRect(g, x, y + 5, width, height, DESIGN_TOKENS.background.deep);
  clippedRect(g, x, y, width, height, edge);
  clippedRect(g, x + 2, y + 2, width - 4, height - 4, DESIGN_TOKENS.background.deep, 4);
  clippedRect(g, x + 4, y + 4, width - 8, height - 8, fill, 2);
  g.fillStyle(0xffffff, 0.035).fillRect(x + 6, y + 5, width - 12, Math.min(24, height / 4));
  g.fillStyle(DESIGN_TOKENS.stroke.light, 0.32).fillRect(x + 8, y + 1, width - 16, 1);
  g.fillStyle(0x000000, 0.18).fillRect(x + 6, y + height - 7, width - 12, 3);
  for (const px of [x + 4, x + width - 14]) {
    for (const py of [y + 4, y + height - 14]) {
      const dx = px === x + 4 ? 0 : 8, dy = py === y + 4 ? 0 : 8;
      g.fillStyle(FANTASY.gold, 0.7).fillRect(px, py + dy, 10, 2).fillRect(px + dx, py, 2, 10);
    }
  }
}

/** Geometry-only button art shared by ordinary and release-to-cast controls. */
export function paintButton(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number,
  primary = false, enabled = true, pressed = false, selected = false): void {
  const gold = primary && !selected;
  const fill = !enabled ? DESIGN_TOKENS.state.disabledFill : gold ? pressed ? 0xe7b64f : FANTASY.primary
    : selected ? pressed ? 0x4b2797 : 0x6036ad : pressed ? 0x352747 : FANTASY.raised;
  const edge = !enabled ? DESIGN_TOKENS.state.disabledEdge : gold ? 0xffedaf
    : selected ? DESIGN_TOKENS.stroke.light : DESIGN_TOKENS.stroke.soft;
  const top = y + (pressed ? 2 : 0);
  clippedRect(g, x, y + 6, width, height, gold && enabled ? 0x724321 : DESIGN_TOKENS.background.deep);
  clippedRect(g, x, top, width, height, edge);
  clippedRect(g, x + 2, top + 2, width - 4, height - 4,
    gold && enabled ? DESIGN_TOKENS.stroke.goldShade : DESIGN_TOKENS.background.deep, 4);
  clippedRect(g, x + 4, top + 4, width - 8, height - 8, fill, 2);
  // Banded pixel highlights give depth without shaders, textures or continuous tweens.
  g.fillStyle(0xffffff, !enabled ? 0.035 : gold ? 0.25 : 0.10)
    .fillRect(x + 7, top + 5, width - 14, Math.floor((height - 12) / 2));
  g.fillStyle(gold ? 0x8b4f18 : 0x160b2b, !enabled ? 0.08 : 0.22)
    .fillRect(x + 7, top + height - 12, width - 14, 6);
  if (gold && enabled) {
    g.fillStyle(0xfff5cb, 0.85).fillRect(x + 9, top + 5, width - 18, 2);
    g.fillStyle(0xffefaa).fillRect(x + 4, top + height / 2 - 2, 4, 4)
      .fillRect(x + width - 8, top + height / 2 - 2, 4, 4);
  }
  if (selected && enabled) {
    g.fillStyle(DESIGN_TOKENS.accent.magic, 0.25).fillRect(x + 8, top + height - 15, width - 16, 9);
    g.fillStyle(FANTASY.gold).fillRect(x + 10, top + height - 7, width - 20, 3)
      .fillRect(x + width / 2 - 3, top + height - 10, 6, 6);
  }
}

export function fantasyRibbon(scene: Phaser.Scene, x: number, y: number, width: number, label: string,
  size = 32, danger = false): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  paintPanel(g, -width / 2, -35, width, 70, danger ? 0x503448 : 0x50316b, danger ? 0xa8788c : FANTASY.gold);
  for (const side of [-1, 1]) g.fillStyle(danger ? 0xc6a0b7 : 0xe9c480)
    .fillPoints([{x:side*(width/2+9),y:0},{x:side*width/2,y:-9},{x:side*(width/2-9),y:0},{x:side*width/2,y:9}],true);
  const text = scene.add.text(0, 0, label, {fontFamily:FANTASY.font,fontSize:`${size}px`,fontStyle:'bold',
    color:danger?'#edcbd8':'#ffe7a6',stroke:'#28152e',strokeThickness:3,resolution:2}).setOrigin(0.5);
  if(text.width>width-40)text.setFontSize(size*(width-40)/text.width);
  container.add([g,text]);return container;
}

export function fantasyCrest(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const container=scene.add.container(x,y),g=scene.add.graphics();
  const points=[[-316,-31],[-291,-58],[-162,-53],[-117,-68],[0,-54],[117,-68],[162,-53],[291,-58],[316,-31],[305,49],[281,66],[116,58],[0,83],[-116,58],[-281,66],[-305,49]]
    .map(([px,py])=>({x:px,y:py}));
  g.fillStyle(0x1d152e).fillPoints(points,true);g.lineStyle(5,FANTASY.gold).strokePoints(points,true,true);
  g.lineStyle(2,0xffd58f,0.65).strokePoints(points.map(p=>({x:p.x*0.955,y:p.y*0.86})),true,true);
  const gem=[{x:0,y:-116},{x:24,y:-89},{x:17,y:-61},{x:0,y:-42},{x:-17,y:-61},{x:-24,y:-89}];
  g.fillStyle(0x69d4f5).fillPoints(gem,true);g.lineStyle(3,0xd8eeff).strokePoints(gem,true,true);
  g.fillStyle(0x4876bd).fillPoints([{x:0,y:-114},{x:24,y:-89},{x:17,y:-61},{x:0,y:-43}],true);
  const text=scene.add.text(0,-4,'소환사의 원정',{fontFamily:FANTASY.font,fontSize:'65px',fontStyle:'bold',color:'#ffe4a1',
    resolution:2,stroke:'#28172d',strokeThickness:5}).setOrigin(0.5);
  const sub=scene.add.text(0,52,'SUMMONER’S EXPEDITION',{fontFamily:'Georgia, serif',fontSize:'18px',color:'#e8ca90',letterSpacing:2}).setOrigin(0.5);
  container.add([g,text,sub]);return container;
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
  label: string, action: () => void, options: { enabled?: boolean; icon?: 'book'; fontSize?: number; primary?: boolean;
    hitWidth?: number; hitHeight?: number; selected?: boolean } = {}): Phaser.GameObjects.Container {
  const enabled = options.enabled !== false;
  const container = scene.add.container(x, y);
  const frame = scene.add.graphics();
  const hit = scene.add.rectangle(0, 0, options.hitWidth ?? width, options.hitHeight ?? height, 0, 0).setName('hit');
  const text = scene.add.text(options.icon ? 15 : 0, 0, label, {
    fontFamily: FANTASY.font, fontSize: `${options.fontSize ?? 20}px`, fontStyle: 'bold', resolution: 2,
    color: !enabled ? DESIGN_TOKENS.state.disabledText : options.selected ? DESIGN_TOKENS.text.selected
      : options.primary ? DESIGN_TOKENS.text.onPrimary : FANTASY.cream, align: 'center'
  }).setOrigin(0.5).setName('label');
  if (text.width > width - (options.icon ? 58 : 24)) text.setFontSize(Math.floor((options.fontSize ?? 20) * (width - (options.icon ? 58 : 24)) / text.width));
  const draw = (pressed: boolean) => {
    frame.clear();
    paintButton(frame, -width / 2, -height / 2, width, height, options.primary, enabled, pressed, options.selected);
    if (options.icon) pixelIcon(frame, options.icon, -width / 2 + 13, -12 + (pressed ? 2 : 0), 1.5);
    text.y = pressed ? 2 : 0;
  };
  draw(false);
  container.add([frame, hit, text]);
  if (enabled) hit.setInteractive({ useHandCursor: true })
    .on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); draw(true); action();
    })
    .on('pointerup', () => draw(false)).on('pointerout', () => draw(false));
  return container;
}

export function pixelPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  fill = FANTASY.panel, edge = FANTASY.edge): Phaser.GameObjects.Graphics {
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
