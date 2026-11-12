import type { RoomNode } from '../types/game';

/** Space below the existing title, inside the unchanged gold/violet rails. */
export const MINIMAP_VIEW={x:584,y:34,width:112,height:64};
export interface MinimapLayout {
  minX:number;minY:number;columns:number;rows:number;
  x:number;y:number;width:number;height:number;cellWidth:number;cellHeight:number;gap:number;
}

export function minimapLayout(grid:readonly (readonly (RoomNode|null)[])[],area=MINIMAP_VIEW):MinimapLayout|null {
  let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
  for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++)if(grid[y][x]){
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  if(maxX<0)return null;
  const columns=maxX-minX+1,rows=maxY-minY+1;
  // Dense maps trade a pixel of gutter for larger tiles, without stretching either axis.
  const gap=Math.min(rows>=4||columns>=4?1:2,Math.floor(Math.min(area.width/columns,area.height/rows)/5));
  // Keep the same scale on both axes. Filling the wide panel must never flatten rooms.
  const side=Math.max(1,Math.floor(Math.min((area.width-(columns-1)*gap)/columns,
    (area.height-(rows-1)*gap)/rows)));
  const cellWidth=side,cellHeight=side;
  const width=columns*cellWidth+(columns-1)*gap,height=rows*cellHeight+(rows-1)*gap;
  return{minX,minY,columns,rows,cellWidth,cellHeight,gap,width,height,
    x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2)};
}

export type MinimapGlyph='player'|'heal'|'event'|'boss'|'danger'|'supply'|'cleared'|'room';
const NORMAL={fill:0x8b43bd,glyph:'room' as MinimapGlyph};
const STYLES={COMBAT:NORMAL,ELITE:{fill:0xec3054,glyph:'danger' as MinimapGlyph},
  RECOVERY:{fill:0x4c9136,glyph:'heal' as MinimapGlyph},EVENT:{fill:0xb366df,glyph:'event' as MinimapGlyph},
  BOSS:{fill:0xb51e46,glyph:'boss' as MinimapGlyph}};

/** Preserve the original reveal policy: all room types are visible; exploration affects brightness. */
export function minimapRoomStyle(node:RoomNode,current:boolean):{fill:number;glyph:MinimapGlyph;alpha:number} {
  if(current)return{fill:0x08bff4,glyph:'player',alpha:1};
  const style=STYLES[node.type];
  return{fill:node.type==='COMBAT'&&node.visited&&!node.cleared?STYLES.ELITE.fill:style.fill,
    glyph:node.sideSupply?'supply':node.type==='COMBAT'?(node.cleared?'cleared':node.visited?'danger':'room'):style.glyph,
    alpha:node.visited||node.type==='BOSS' ? .96 : .55};
}
