import type Phaser from 'phaser';
import { BATTLE_UI, FANTASY } from './fantasyTheme';

export function hudLabel(scene: Phaser.Scene,x:number,y:number,size:number,color:string=FANTASY.cream):Phaser.GameObjects.Text {
  return scene.add.text(x,y,'',{fontFamily:FANTASY.font,fontSize:`${size}px`,fontStyle:'bold',color,
    resolution:2,stroke:BATTLE_UI.stroke,strokeThickness:2}).setDepth(BATTLE_UI.depth.text);
}

const integer = new Intl.NumberFormat('ko-KR');
const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });

/** Keep the full value on the object while fitting each display line without shrinking its font. */
export function setHudText(text: Phaser.GameObjects.Text, value: string, maxWidth: number): void {
  if (text.getData('fullText') === value && text.getData('maxWidth') === maxWidth) return;
  text.setData({ fullText: value, maxWidth });
  const lines = value.split('\n').map(line => {
    text.setText(line);
    if (text.width <= maxWidth) return line;
    const chars = Array.from(line);
    let low = 0, high = chars.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      text.setText(chars.slice(0, middle).join('') + '…');
      if (text.width <= maxWidth) low = middle;
      else high = middle - 1;
    }
    return chars.slice(0, low).join('') + '…';
  });
  text.setText(lines.join('\n'));
}

export function hudMinerals(value: number): string {
  return (value >= 1_000_000 ? compact : integer).format(value);
}
