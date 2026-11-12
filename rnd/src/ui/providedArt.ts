import Phaser from 'phaser';
import type { StageDef } from '../types/game';

export const PROVIDED_UI = 'provided_ui';
export type ProvidedSkin = Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image;

/** Slice only visual art. Every input target remains owned by its existing component. */
export function providedSkin(scene: Phaser.Scene, frame: string, x: number, y: number, width: number, height: number): ProvidedSkin | null {
  if (!scene.textures.exists(PROVIDED_UI)) return null;
  if (scene.game.renderer.type === Phaser.WEBGL) {
    // The assembled panel has 24px corners; keep them intact at every display size.
    if (frame === 'panel') return scene.add.nineslice(x,y,PROVIDED_UI,frame,width,height,24,24,24,24).setOrigin(0);
    const border = Math.min(16, Math.floor(Math.min(width, height) / 3));
    return scene.add.nineslice(x,y,PROVIDED_UI,frame,width,height,border,border,12,12).setOrigin(0);
  }
  return scene.add.image(x,y,PROVIDED_UI,frame).setOrigin(0).setDisplaySize(width,height);
}

const PROVIDED_ICONS: Record<string, string> = {
  swords:'swords',merge:'swords',helmet:'helmet',book:'book',settings:'settings',heart:'heart',bolt:'bolt',
  gem:'gem',summon:'gem',coin:'coin',skull:'skull',hourglass:'hourglass',shop:'shop',crown:'crown'
};
export function providedIcon(scene: Phaser.Scene, kind: string, x: number, y: number, size: number): Phaser.GameObjects.Image | null {
  const icon=PROVIDED_ICONS[kind];
  if(!icon||!scene.textures.exists(PROVIDED_UI))return null;
  return scene.add.image(x,y,PROVIDED_UI,'icon_'+icon).setDisplaySize(size,size);
}

export function providedFloor(theme: StageDef['themeId']): string {
  return theme==='volcano'?'floor_lava':theme==='glacier'?'floor_ice':theme==='citadel'?'floor_dungeon':'floor_grass';
}

export function providedButtonFrame(primary: boolean, enabled: boolean, selected: boolean, tab = false): string {
  return !enabled?'button_disabled':tab?selected?'tab_selected':'tab_normal':primary?'button_primary':'button_secondary';
}

export function setProvidedFrame(skin: ProvidedSkin, frame: string): void {
  if(skin.frame.name===frame)return;
  skin.setTexture(PROVIDED_UI,frame);
  if(skin instanceof Phaser.GameObjects.NineSlice)skin.updateUVs();
}
