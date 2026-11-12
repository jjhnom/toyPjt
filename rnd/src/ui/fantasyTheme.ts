import Phaser from 'phaser';
import { providedSkin, providedIcon, providedButtonFrame } from './providedArt';

/** Semantic colors from detailed design v2. Existing FANTASY keys remain compatible. */
export const DESIGN_TOKENS = {
  background: { base: 0x12152f, deep: 0x0c1022 },
  surface: { panel: 0x2a1e3f, raised: 0x473872, slate: 0x1b2633, light: 0xede6ff },
  accent: { magic: 0x6a30f0, ice: 0x3fb7ff, fire: 0xff9f3a, gold: 0xffd966, heal: 0x4ade80 },
  text: { primary: '#ede6ff', secondary: '#b9b0d2', onPrimary: '#302035', selected: '#ffe9aa' },
  state: { danger: 0xff5a5a, disabledFill: 0x302d43, disabledEdge: 0x6c627e, disabledText: '#b9b0c6' },
  stroke: { soft: 0x8b6eb6, light: 0xc5a0f2, goldShade: 0xb67b36 },
  material: { goldLight: 0xfff3bd, goldMid: 0xffd966, goldLow: 0xf0a52e, goldDark: 0x78451f,
    violetLight: 0x9c6dff, violetMid: 0x68459b, violetLow: 0x35234f },
  tier: { 1: 0x9cb2cf, 2: 0x77d5ae, 3: 0xbf8dff, 4: 0xffd966 },
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

/** Visual-only battle geometry; arena, collision and input contracts live in their existing owners. */
export const BATTLE_UI = {
  allyScale: 1.25, stroke: '#140e24', currency: '#6edcff',
  color: {background:0x12152f,panel:0x2a1f3f,hp:0xff5a65,xp:0x3fb7ff,alive:0x68d96c},
  hp: {x:154,y:52,width:220,height:24},
  xp: {x:174,y:78,width:164,height:20},
  heroPanel: {x:12,y:6,width:548,height:106},
  stagePanel: {x:56,y:98,width:608,height:58},
  slot: {x:12,step:92,y:1106,width:84,height:72,portrait:50,portraitY:1140,statusY:1167},
  control: {y:1230,width:112,height:88},
  depth: {environment:3,ground:16,unitStatus:28,effect:35,warning:38,panel:50,text:54,control:65}
} as const;

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
  g.lineStyle(1, edge, .38).strokeRect(x + 7, y + 7, width - 14, height - 14);
  g.fillStyle(0xffffff, 0.045).fillRect(x + 9, y + 8, width - 18, Math.min(24, height / 4));
  g.fillStyle(DESIGN_TOKENS.stroke.light, 0.6).fillRect(x + 9, y + 1, width - 18, 1);
  g.fillStyle(0x000000, 0.18).fillRect(x + 6, y + height - 7, width - 12, 3);
  for (const px of [x + 4, x + width - 14]) {
    for (const py of [y + 4, y + height - 14]) {
      const dx = px === x + 4 ? 0 : 8, dy = py === y + 4 ? 0 : 8;
      g.fillStyle(edge, .95).fillRect(px, py + dy, 10, 3).fillRect(px + dx, py, 3, 10);
      g.fillStyle(DESIGN_TOKENS.material.goldLight, .8).fillRect(px + dx, py + dy, 3, 3);
    }
  }
}

/** Geometry-only button art shared by ordinary and release-to-cast controls. */
export function paintButton(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number,
  primary = false, enabled = true, pressed = false, selected = false): void {
  const gold = primary && !selected;
  const m = DESIGN_TOKENS.material;
  const fill = !enabled ? DESIGN_TOKENS.state.disabledFill : gold ? pressed ? 0xe4a537 : m.goldMid
    : selected ? pressed ? 0x48218b : DESIGN_TOKENS.accent.magic : pressed ? 0x30203e : FANTASY.raised;
  const edge = !enabled ? DESIGN_TOKENS.state.disabledEdge : gold || selected ? m.goldLight : DESIGN_TOKENS.stroke.light;
  const top = y + (pressed ? 2 : 0);
  clippedRect(g, x, y + 6, width, height, gold && enabled ? m.goldDark : DESIGN_TOKENS.background.deep);
  clippedRect(g, x, top, width, height, edge, 10);
  clippedRect(g, x + 2, top + 2, width - 4, height - 4,
    gold && enabled ? m.goldDark : DESIGN_TOKENS.background.deep, 8);
  clippedRect(g, x + 4, top + 4, width - 8, height - 8, fill, 6);
  if (enabled) {
    // Discrete material bands keep highlights crisp at the game's pixel scale.
    const inner = height - 14, upper = Math.floor(inner * .42), lower = Math.floor(inner * .32);
    g.fillStyle(gold ? m.goldLight : selected ? m.violetLight : m.violetMid, pressed ? .18 : gold ? .55 : selected ? .25 : .5)
      .fillRect(x + 9, top + 7, width - 18, upper);
    g.fillStyle(gold ? m.goldLow : m.violetLow, pressed ? .45 : .5)
      .fillRect(x + 9, top + height - 7 - lower, width - 18, lower);
    g.lineStyle(1, gold ? m.goldLight : m.violetLight, .75).strokeRect(x + 7, top + 7, width - 14, height - 14);
    g.fillStyle(gold ? m.goldLight : DESIGN_TOKENS.stroke.light, .9).fillRect(x + 13, top + 4, width - 26, 2);
    for (const px of [x + 4, x + width - 9]) {
      const py = top + height / 2;
      g.fillStyle(gold || selected ? m.goldLight : m.violetLight).fillPoints([
        {x:px,y:py-5},{x:px+5,y:py},{x:px,y:py+5},{x:px-5,y:py}
      ], true);
    }
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

export const PIXEL_ICON_KINDS = ['book','gem','heart','swords','helmet','summon','merge','growth','relic',
  'coin','skull','hourglass','settings','check','lock','bolt','sound'] as const;
export type PixelIconKind = typeof PIXEL_ICON_KINDS[number];

/** Original pixel glyphs: shared palette, dark outline and bounded 18px grid. */
export function pixelIcon(g: Phaser.GameObjects.Graphics, kind: PixelIconKind, x: number, y: number, scale = 1): void {
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
  } else if (kind === 'heart') {
    rect(1, 0, 4, 2, 0xff9a8d); rect(7, 0, 4, 2, 0xff9a8d); rect(0, 2, 12, 4, FANTASY.hp);
    rect(2, 6, 8, 2, FANTASY.hp); rect(4, 8, 4, 2, 0xa93540); rect(2, 2, 2, 2, 0xffd4b8);
  } else {
    const dark=0x1a102e,white=0xf4efff,gold=FANTASY.gold,purple=DESIGN_TOKENS.material.violetLight;
    if(kind==='swords'){
      for(let i=0;i<10;i++){
        rect(1+i,1+i,4,4,dark);rect(12-i,1+i,4,4,dark);
        rect(2+i,1+i,2,3,white);rect(13-i,1+i,2,3,0xc6d5f5);
      }
      rect(1,11,6,2,gold);rect(10,11,6,2,gold);rect(3,13,2,4,0xb27643);rect(12,13,2,4,0xb27643);
    }else if(kind==='helmet'){
      rect(3,2,12,13,dark);rect(5,1,8,3,gold);rect(4,4,10,9,0x7182b6);
      rect(5,3,8,4,0xdde7ff);rect(2,6,14,3,0xa6b5d7);rect(8,4,2,12,white);
      rect(4,9,3,3,dark);rect(11,9,3,3,dark);rect(7,14,4,2,0xb6c4e3);
    }else if(kind==='summon'){
      rect(6,1,6,13,dark);rect(7,0,4,2,white);rect(5,4,8,7,0x713cce);
      rect(7,2,3,10,0xd5b0ff);rect(10,3,2,8,purple);rect(7,12,4,3,0x59248f);
      rect(1,8,3,5,purple);rect(14,7,3,6,0xbe80ff);rect(3,14,12,2,0xc8b1f0);
    }else if(kind==='merge'){
      rect(1,2,5,5,dark);rect(2,3,3,3,purple);rect(12,2,5,5,dark);rect(13,3,3,3,FANTASY.ally);
      rect(4,8,2,2,gold);rect(12,8,2,2,gold);rect(7,7,4,2,white);rect(6,9,6,4,gold);
      rect(8,8,2,8,gold);rect(5,11,8,2,0xfff3bd);
    }else if(kind==='growth'){
      rect(2,11,4,5,0x65429c);rect(7,8,4,8,purple);rect(12,5,4,11,0xcba7ff);
      rect(7,0,4,3,dark);rect(5,3,8,3,dark);rect(3,6,12,2,dark);
      rect(8,1,2,11,gold);rect(6,3,6,2,gold);rect(4,5,10,2,gold);rect(8,2,1,5,0xfff3bd);
    }else if(kind==='relic'){
      rect(2,3,14,10,dark);rect(3,4,12,6,0xb064ca);rect(4,8,10,3,0xefb8f1);
      rect(7,11,4,3,gold);rect(4,14,10,2,gold);rect(7,1,4,4,gold);rect(8,0,2,6,white);
      rect(5,5,2,3,0xf6dbff);
    }else if(kind==='coin'){
      rect(4,0,10,2,dark);rect(2,2,14,13,dark);rect(4,15,10,2,dark);
      rect(4,1,10,14,0xf0a52e);rect(2,4,14,9,gold);rect(5,3,8,11,0xbb741c);
      rect(6,4,6,9,gold);rect(8,5,2,7,0xfff3bd);rect(4,3,2,2,white);
    }else if(kind==='skull'){
      rect(3,1,12,11,dark);rect(5,11,8,5,dark);rect(4,2,10,9,white);rect(6,10,6,5,0xc4c1d8);
      rect(5,5,3,3,dark);rect(10,5,3,3,dark);rect(8,9,2,2,dark);rect(7,13,1,3,dark);rect(10,13,1,3,dark);
    }else if(kind==='hourglass'){
      rect(3,0,12,3,dark);rect(3,14,12,3,dark);rect(4,2,10,13,0x695285);
      rect(5,3,8,3,0xbddfff);rect(7,6,4,2,FANTASY.ally);rect(8,8,2,4,gold);rect(6,12,6,2,gold);
      rect(3,1,12,2,gold);rect(3,14,12,2,gold);
    }else if(kind==='settings'){
      rect(6,0,6,17,dark);rect(0,6,18,5,dark);rect(2,2,14,13,0x9483b7);
      rect(7,0,4,17,0xb9b1cd);rect(0,7,18,3,0xb9b1cd);rect(5,5,8,7,dark);rect(7,7,4,3,0x695285);
    }else if(kind==='check'){
      rect(1,1,16,15,dark);rect(2,2,14,13,gold);rect(3,3,12,11,0xeaa23c);
      rect(4,7,2,3,white);rect(6,9,2,3,white);rect(8,7,2,3,white);rect(10,5,2,3,white);rect(12,3,2,3,white);
    }else if(kind==='lock'){
      rect(5,0,8,9,dark);rect(6,1,6,7,gold);rect(8,3,2,4,dark);rect(3,7,12,10,dark);
      rect(4,8,10,8,0xba85e4);rect(8,10,2,4,dark);rect(5,8,2,6,0xe6c9ff);
    }else if(kind==='bolt'){
      rect(7,0,6,3,dark);rect(5,3,6,3,dark);rect(3,6,12,5,dark);rect(8,10,4,4,dark);
      rect(8,1,4,3,gold);rect(6,4,4,3,gold);rect(4,7,10,2,gold);rect(9,9,3,3,gold);rect(8,12,2,3,gold);rect(7,15,2,2,gold);
    }else if(kind==='sound'){
      rect(1,6,5,6,0xb49ad4);rect(5,3,4,12,0xe6d5ff);rect(8,1,3,16,0xb28bdf);
      rect(13,4,2,10,0xe6d5ff);rect(16,6,2,6,0xe6d5ff);
    }
  }
}

/** Live component icon: use supplied raster art where a matching asset exists. */
export function uiIcon(scene: Phaser.Scene, kind: PixelIconKind, x: number, y: number, size = 32): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const image=providedIcon(scene,kind,x,y,size);
  if(image)return image;
  const g=scene.add.graphics().setPosition(x,y),scale=size/18;
  pixelIcon(g,kind,-9*scale,-8*scale,scale);return g;
}

/** Same rectangular hit area; pressed feedback never moves the input target. */
export function fantasyButton(scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  label: string, action: () => void, options: { enabled?: boolean; icon?: PixelIconKind; fontSize?: number; primary?: boolean;
    hitWidth?: number; hitHeight?: number; selected?: boolean } = {}): Phaser.GameObjects.Container {
  const enabled = options.enabled !== false;
  const container = scene.add.container(x, y);
  const frame = scene.add.graphics();
  const isTab=options.selected!==undefined&&height<=80&&width>=140;
  const skin=providedSkin(scene,providedButtonFrame(!!options.primary,enabled,!!options.selected,isTab),-width/2,-height/2,width,height)?.setName('provided-skin');
  const hit = scene.add.rectangle(0, 0, options.hitWidth ?? width, options.hitHeight ?? height, 0, 0).setName('hit');
  const text = scene.add.text(options.icon ? 15 : 0, 0, label, {
    fontFamily: FANTASY.font, fontSize: `${options.fontSize ?? 20}px`, fontStyle: 'bold', resolution: 2,
    color: !enabled ? DESIGN_TOKENS.state.disabledText : options.selected ? DESIGN_TOKENS.text.selected
      : options.primary ? DESIGN_TOKENS.text.onPrimary : FANTASY.cream, align: 'center',
    stroke: options.primary&&!options.selected ? '#4b2b18' : '#180e2d', strokeThickness: options.primary&&!options.selected ? 0 : options.selected ? 3 : 2
  }).setOrigin(0.5).setName('label');
  if (text.width > width - (options.icon ? 58 : 24)) text.setFontSize(Math.floor((options.fontSize ?? 20) * (width - (options.icon ? 58 : 24)) / text.width));
  const iconScale=Math.min(1.5,(height-18)/18),iconWidth=18*iconScale;
  if(options.icon)text.x=(iconWidth+10)/2;
  const imageIcon=options.icon?providedIcon(scene,options.icon,-(text.width+10)/2,0,iconWidth):null;
  if(imageIcon&&!enabled)imageIcon.setAlpha(.55);
  const draw = (pressed: boolean) => {
    frame.clear();
    if(skin){
      skin.y=-height/2+(pressed?2:0);skin.setAlpha(pressed?.85:1);
      if(options.selected&&!isTab)frame.lineStyle(2,FANTASY.gold).strokeRect(-width/2+6,-height/2+6,width-12,height-12);
    }else paintButton(frame, -width / 2, -height / 2, width, height, options.primary, enabled, pressed, options.selected);
    if(imageIcon)imageIcon.y=pressed?2:0;
    else if(options.icon)pixelIcon(frame, options.icon, -(text.width+iconWidth+10)/2, -8*iconScale+(pressed?2:0), iconScale);
    text.y = pressed ? 2 : 0;
  };
  draw(false);
  if(skin)container.add(skin);
  container.add([frame,hit]);if(imageIcon)container.add(imageIcon);container.add(text);
  if (enabled) hit.setInteractive({ useHandCursor: true })
    .on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); draw(true); action();
    })
    .on('pointerup', () => draw(false)).on('pointerout', () => draw(false));
  return container;
}

export function pixelPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  fill = FANTASY.panel, edge = FANTASY.edge): Phaser.GameObjects.Container {
  const container=scene.add.container(0,0);
  const skin=providedSkin(scene,height>=280&&width>=400?'popup':'panel',x,y,width,height);
  if(skin){
    container.add(scene.add.rectangle(x+width/2,y+height/2,Math.max(1,width-16),Math.max(1,height-16),fill));
    container.add(skin.setName('provided-panel'));return container;
  }
  const g = scene.add.graphics();
  paintPanel(g, x, y, width, height, fill, edge);
  container.add(g);return container;
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
