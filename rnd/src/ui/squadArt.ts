import Phaser from 'phaser';
import { DESIGN_TOKENS, FANTASY, pixelPanel } from './fantasyTheme';
import { providedSkin } from './providedArt';
import type { DroneTier } from '../types/game';

export const squadTierColor = (tier: DroneTier): number =>
  DESIGN_TOKENS.tier[tier];

/** Static decoration only; selection targets belong to the scene's controls. */
export function squadCard(scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  tier: DroneTier, selected = false): Phaser.GameObjects.Container {
  const container=scene.add.container(0,0),poster=height>width&&height>200;
  const skin=poster?providedSkin(scene,'card',x,y,width,height):null;
  if(skin)container.add(skin.setName('provided-card'));
  else container.add(pixelPanel(scene,x,y,width,height,selected?0x362442:0x21182f,squadTierColor(tier)));
  const g = scene.add.graphics(), edge = selected ? FANTASY.gold : squadTierColor(tier);
  g.lineStyle(2, edge, .25).strokeRect(x + 7, y + 7, width - 14, height - 14);
  g.fillStyle(edge, .08).fillRect(x + 9, y + 9, width - 18, Math.round(height * .55));
  for (const side of [-1, 1]) {
    const px = x + width / 2 + side * (width / 2 - 12);
    g.fillStyle(edge).fillPoints([{x:px,y:y+3},{x:px+5,y:y+9},{x:px,y:y+15},{x:px-5,y:y+9}], true);
  }
  container.add(g);return container;
}

export function squadPedestal(scene: Phaser.Scene, x: number, y: number, width: number,
  color: number, occupied: boolean): void {
  const g = scene.add.graphics();
  if (occupied) g.fillStyle(color, .1).fillEllipse(x, y - 17, width, 68);
  g.fillStyle(0x0d0b1a).fillEllipse(x, y + 10, width, 28);
  g.fillStyle(0x4b365f).fillRect(x - width / 2, y, width, 10).fillEllipse(x, y + 10, width, 22);
  g.fillStyle(0x6a4f80).fillEllipse(x, y, width, 26);
  g.lineStyle(2, color, occupied ? .9 : .25).strokeEllipse(x, y, width - 6, 23);
  if (occupied) g.lineStyle(1, color, .45).strokeEllipse(x, y, width - 19, 15);
}
