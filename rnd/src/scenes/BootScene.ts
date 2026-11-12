import Phaser from 'phaser';
import { DRONE_SPECS, ENEMY_SPECS } from '../config/gameData';
import type { DroneArchetype, EnemyArchetype } from '../types/game';
import { drawCharacter, unitTexture, unitPortrait, unitAnimation, enemyTexture, enemyAnimation } from '../ui/pixelCharacters';
import { ART_ASSETS, PROVIDED_ATLAS } from '../ui/artAssets';
import { PROVIDED_UI } from '../ui/providedArt';
import { HUD_ART, REFERENCE_HUD } from '../ui/hudArt';
import { BOTTOM_HUD, BOTTOM_HUD_ART } from '../ui/bottomHudArt';
import { UNIT_ART_CELL, UNIT_ART_COLUMNS, UNIT_ART_FRAMES } from '../ui/unitArt';
import { createSkillEffectTextures } from '../ui/skillEffectTextures';
import { LOBBY_CHARACTER_CELL, LOBBY_CHARACTER_COLUMNS, LOBBY_CHARACTER_FRAMES, lobbyCharacterPortrait } from '../ui/lobbyCharacters';
import type { LobbyCharacter } from '../ui/lobbyCharacters';

export class BootScene extends Phaser.Scene {
  private characterArt = new Map<string, HTMLCanvasElement>();
  constructor() {
    super('BootScene');
  }

  public preload(): void {
    for (const [key, url] of Object.entries(ART_ASSETS)) this.load.image(key, url);
    this.load.atlas(PROVIDED_UI,PROVIDED_ATLAS.image,PROVIDED_ATLAS.data);
    this.load.atlas(REFERENCE_HUD,HUD_ART.image,HUD_ART.data);
    this.load.atlas(BOTTOM_HUD,BOTTOM_HUD_ART.image,BOTTOM_HUD_ART.data);
  }

  public create(): void {
    this.createArtFrame();
    const leaderPortrait = this.textures.createCanvas('portrait_leader', 192, 192)!;
    leaderPortrait.getContext().drawImage(this.textures.get('art_mage').getSourceImage() as HTMLImageElement, 0, 0, 192, 192);
    leaderPortrait.refresh();
    // Reuse the existing mage art as a larger bust inside the reference HUD's portrait frame.
    const mage=this.textures.get('art_mage').getSourceImage() as HTMLImageElement;
    const hudPortrait=this.textures.createCanvas('portrait_leader_hud',240,192)!;
    const hudContext=hudPortrait.getContext();hudContext.imageSmoothingEnabled=true;
    hudContext.drawImage(mage,mage.width*.08,mage.height*.02,mage.width*.82,mage.height*.62,0,0,240,192);
    hudPortrait.refresh();
    const familiar = this.textures.createCanvas('portrait_lobby_familiar', 96, 96)!;
    const familiarContext = familiar.getContext();
    familiarContext.imageSmoothingEnabled = true;
    familiarContext.imageSmoothingQuality = 'high';
    familiarContext.drawImage(this.textures.get('art_lobby_familiar_source').getSourceImage() as HTMLImageElement, 0, 0, 96, 96);
    familiar.refresh();
    this.createLobbyPortraits();
    this.createAnimatedSpriteSheets();
    // Only the small runtime textures are used after preparation.
    for (const key of ['art_frame_source', 'art_mage', 'art_units_source', 'art_lobby_familiar_source', 'art_lobby_party_source']) this.textures.remove(key);
    this.characterArt.clear();
    this.createStaticUiTextures();
    createSkillEffectTextures(this);
    this.registerAnimations();
    this.scene.start('MenuScene');
  }

  private createLobbyPortraits(): void {
    const source = this.textures.get('art_lobby_party_source').getSourceImage() as HTMLImageElement;
    const cell = LOBBY_CHARACTER_CELL;
    for (const role of Object.keys(LOBBY_CHARACTER_FRAMES) as LobbyCharacter[]) {
      const frame = LOBBY_CHARACTER_FRAMES[role];
      const portrait = this.textures.createCanvas(lobbyCharacterPortrait(role), cell, cell)!;
      const ctx = portrait.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, frame % LOBBY_CHARACTER_COLUMNS * cell,
        Math.floor(frame / LOBBY_CHARACTER_COLUMNS) * cell, cell, cell, 0, 0, cell, cell);
      portrait.refresh();
    }
  }

  private createArtFrame(): void {
    const source = this.textures.get('art_frame_source').getSourceImage() as HTMLImageElement;
    const canvas = this.textures.createCanvas('art_frame', 512, 128)!;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, 512, 128);
    canvas.refresh();

    // Cards need narrow rails and a clear reading area. Keep the full ornament
    // for buttons, and assemble a separate panel from the same source artwork.
    const panel = this.textures.createCanvas('art_panel', 512, 128)!;
    const p = panel.getContext();
    p.imageSmoothingEnabled = true;
    p.fillStyle = '#111a2b';
    p.fillRect(0, 0, 512, 128);
    const part = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) =>
      p.drawImage(source, sx * source.width, sy * source.height, sw * source.width, sh * source.height, dx, dy, dw, dh);
    part(.17, .185, .17, .10, 16, 0, 480, 7);
    part(.17, .775, .17, .10, 16, 121, 480, 7);
    part(.028, .42, .035, .18, 0, 16, 6, 96);
    part(.945, .42, .035, .18, 506, 16, 6, 96);
    part(.005, .10, .15, .32, 0, 0, 24, 24);
    part(.845, .10, .15, .32, 488, 0, 24, 24);
    part(.005, .62, .15, .32, 0, 104, 24, 24);
    part(.845, .62, .15, .32, 488, 104, 24, 24);
    panel.refresh();
  }

  private paintCharacter(ctx: CanvasRenderingContext2D, kind: string, frame: number, width: number, height: number): void {
    const leader = kind === 'LEADER';
    let source = this.characterArt.get(kind);
    if (!source) {
      source = document.createElement('canvas');
      source.width = leader ? width / 2 : width;
      source.height = leader ? height / 2 : height;
      const small = source.getContext('2d')!;
      small.imageSmoothingEnabled = true;
      small.imageSmoothingQuality = 'high';
      small.filter = leader ? 'brightness(1.2) contrast(1.08)' : 'brightness(1.08)';
      if (leader) small.drawImage(this.textures.get('art_mage').getSourceImage() as HTMLImageElement, 0, 0, source.width, source.height);
      else this.drawUnitArt(small, kind as DroneArchetype, source.width, source.height);
      this.characterArt.set(kind, source);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, frame % 2, width, height - 2);
  }

  private drawUnitArt(ctx: CanvasRenderingContext2D, type: DroneArchetype, width: number, height: number): void {
    const frame = UNIT_ART_FRAMES[type];
    const source = this.textures.get('art_units_source').getSourceImage() as HTMLImageElement;
    ctx.drawImage(source, frame % UNIT_ART_COLUMNS * UNIT_ART_CELL,
      Math.floor(frame / UNIT_ART_COLUMNS) * UNIT_ART_CELL, UNIT_ART_CELL, UNIT_ART_CELL, 0, 0, width, height);
  }

  private createUnitPortrait(type: DroneArchetype): void {
    const texture = this.textures.createCanvas(unitPortrait(type), 96, 96)!;
    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    this.drawUnitArt(ctx, type, 96, 96);
    texture.refresh();
  }

  private createSheet(
    key: string,
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
    drawFrame: (ctx: CanvasRenderingContext2D, frameIndex: number, w: number, h: number) => void,
    outline?: string
  ): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    const canvasTex = this.textures.createCanvas(key, frameWidth * frameCount, frameHeight);
    if (!canvasTex) return;

    const ctx = canvasTex.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, frameWidth * frameCount, frameHeight);
    const mask = document.createElement('canvas');
    mask.width = frameWidth; mask.height = frameHeight;
    const maskCtx = mask.getContext('2d')!;

    for (let f = 0; f < frameCount; f++) {
      ctx.save();
      ctx.translate(f * frameWidth, 0);
      drawFrame(ctx, f, frameWidth, frameHeight);
      if (outline) {
        maskCtx.clearRect(0, 0, frameWidth, frameHeight);
        drawFrame(maskCtx, f, frameWidth, frameHeight);
        maskCtx.save();
        maskCtx.globalCompositeOperation = 'source-in';
        maskCtx.fillStyle = outline;
        maskCtx.fillRect(0, 0, frameWidth, frameHeight);
        maskCtx.restore();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(mask, -1, 0); ctx.drawImage(mask, 1, 0); ctx.drawImage(mask, 0, -1); ctx.drawImage(mask, 0, 1);
      }
      ctx.restore();
      canvasTex.add(f, 0, f * frameWidth, 0, frameWidth, frameHeight);
    }

    canvasTex.refresh();
  }

  private createAnimatedSpriteSheets(): void {
    this.createSheet('spr_player_leader', 64, 64, 4,
      (ctx, f, w, h) => this.paintCharacter(ctx, 'LEADER', f, w, h), '#0a1220');
    for (const type of Object.keys(DRONE_SPECS) as DroneArchetype[]) {
      this.createUnitPortrait(type);
      this.createSheet(unitTexture(type), 48, 48, 4,
        (ctx, f, w, h) => this.paintCharacter(ctx, type, f, w, h), '#101c29');
    }
    for (const type of Object.keys(ENEMY_SPECS) as EnemyArchetype[]) {
      const size = type === 'BOSS_CORE' ? 104 : type === 'ELITE_BRUTE' ? 72 : 52;
      this.createSheet(enemyTexture(type), size, size, 4,
        (ctx, f, w, h) => drawCharacter(ctx, type, f, w, h), '#321e27');
    }
    this.createSheet('spr_bullet', 20, 20, 2, (ctx, f) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 8, 14, 4);
      ctx.fillRect(10, 6 + f, 6, 8 - f * 2);
      ctx.fillStyle = '#eaffff'; ctx.fillRect(14, 8, 4, 4);
      ctx.fillStyle = '#ffffff66'; ctx.fillRect(0, 9, 4, 2);
    });
  }

  private createStaticUiTextures(): void {
    const g = this.add.graphics();

    // 파티클 & 충격파 링
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 2, 8, 8);
    g.generateTexture('tex_particle', 12, 12);

    g.clear();
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(48, 48, 42);
    g.generateTexture('tex_ring', 96, 96);

    // 가상 조이스틱 베이스 & 스틱
    g.clear();
    g.fillStyle(0x221c32, 0.4).fillCircle(68, 68, 63);
    g.lineStyle(3, 0xcbb5e4, 0.6).strokeCircle(68, 68, 61);
    g.lineStyle(5, 0x9b80bd, 0.12).strokeCircle(68, 68, 55);
    g.lineStyle(1, 0xcbb5e4, 0.2).strokeCircle(68, 68, 40);
    for (const [x, y] of [[65, 11], [65, 119], [11, 65], [119, 65]]) {
      g.fillStyle(0xcbb5e4,0.4).fillRect(x,y,6,6);
    }
    g.lineStyle(1,0xcbb5e4,0.12).lineBetween(24,68,112,68).lineBetween(68,24,68,112);
    g.generateTexture('tex_joy_base', 136, 136);

    g.clear();
    g.fillStyle(0x170e25).fillCircle(28,28,27);
    g.fillStyle(0xc68cea).fillCircle(28,28,24);
    g.fillStyle(0x6b3594).fillCircle(28,29,21);
    g.fillStyle(0x9b5bc9).fillCircle(28,25,19);
    g.fillStyle(0xbb7cdb).fillEllipse(25,17,27,15);
    g.fillStyle(0xefd4ff,.8).fillEllipse(18,13,9,6);
    g.lineStyle(1,0xe0c9f3).strokeCircle(28,27,22);
    g.generateTexture('tex_joy_thumb', 56, 56);

    // 사방 게이트 도어 텍스처
    g.clear();
    g.fillStyle(0x0a111a).fillRect(0, 0, 110, 22);
    g.fillStyle(0xffffff).fillRect(3, 2, 104, 18);
    g.fillStyle(0x4e5d63).fillRect(7, 6, 96, 12);
    for (let x = 10; x < 106; x += 14) g.fillStyle(0xafbdba).fillRect(x, 5, 5, 13);
    g.fillStyle(0xebddad).fillRect(3, 2, 104, 3).fillRect(3, 17, 104, 3);
    g.fillStyle(0x7f6947).fillRect(1, 3, 5, 16).fillRect(104, 3, 5, 16);
    g.generateTexture('tex_door_h', 110, 22);

    g.clear();
    g.fillStyle(0x0a111a).fillRect(0, 0, 22, 110);
    g.fillStyle(0xffffff).fillRect(2, 3, 18, 104);
    g.fillStyle(0x4e5d63).fillRect(6, 7, 12, 96);
    for (let y = 10; y < 106; y += 14) g.fillStyle(0xafbdba).fillRect(5, y, 13, 5);
    g.fillStyle(0xebddad).fillRect(2, 3, 3, 104).fillRect(17, 3, 3, 104);
    g.fillStyle(0x7f6947).fillRect(3, 1, 16, 5).fillRect(3, 104, 16, 5);
    g.generateTexture('tex_door_v', 22, 110);

    g.destroy();
  }

  private registerAnimations(): void {
    const definitions = [
      { key: 'anim_player_leader', sheet: 'spr_player_leader', end: 3 },
      { key: 'anim_bullet', sheet: 'spr_bullet', end: 1 },
      ...(Object.keys(DRONE_SPECS) as DroneArchetype[]).map(type => ({ key: unitAnimation(type), sheet: unitTexture(type), end: 3 })),
      ...(Object.keys(ENEMY_SPECS) as EnemyArchetype[]).map(type => ({ key: enemyAnimation(type), sheet: enemyTexture(type), end: 3 }))
    ];
    for (const def of definitions) {
      if (!this.anims.exists(def.key)) this.anims.create({
        key: def.key, frames: this.anims.generateFrameNumbers(def.sheet, { start: 0, end: def.end }),
        frameRate: 6, repeat: -1
      });
    }
  }
}
