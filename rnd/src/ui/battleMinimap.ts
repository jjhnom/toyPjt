import type Phaser from 'phaser';
import type { RoomNode } from '../types/game';
import { minimapLayout,minimapRoomStyle } from './minimapLayout';
import type { MinimapGlyph } from './minimapLayout';

const GLYPHS:Record<MinimapGlyph,readonly string[]>={
  player:['0001100','0001100','0011000','0111100','1001010','0001001','0010100'],
  heal:['00100','00100','11111','00100','00100'],
  event:['00100','01110','11111','01110','00100'],
  boss:['01110','11111','10101','01110','01010'],
  danger:['10001','01010','00100','01010','10001'],
  supply:['11111','10001','11111','10001','11111'],
  cleared:['00000','00001','00010','10100','01000'],
  room:['00000','00000','00100','00000','00000']
};

const COMPACT:Record<MinimapGlyph,readonly string[]>={
  player:['010','111','101'],heal:['010','111','010'],event:['010','101','010'],
  boss:['111','101','010'],danger:['101','010','101'],supply:['111','101','111'],
  cleared:['001','101','010'],room:['000','000','000']
};
const INK:Record<MinimapGlyph,number>={player:0xffffff,heal:0xd6ff92,event:0xf3cfff,
  boss:0xffebf2,danger:0xffffff,supply:0xffe694,cleared:0xc4a1df,room:0xffffff};

function glyph(g:Phaser.GameObjects.Graphics,kind:MinimapGlyph,x:number,y:number,w:number,h:number,padding:number):void {
  if(kind==='room')return;
  const available=Math.min(w,h)-padding*2;
  const detail=GLYPHS[kind],source=available>=detail.length*2?detail:COMPACT[kind];
  const rows=source.length,cols=source[0].length,unit=Math.floor(available/rows);
  if(unit<1)return;
  const width=cols*unit,height=rows*unit;
  g.fillStyle(INK[kind],1);
  const ox=x+Math.floor((w-width)/2),oy=y+Math.floor((h-height)/2);
  // Each source pixel has the same integer scale; small-map strokes stay >= 2 logical px.
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)if(source[row][col]==='1'){
    g.fillRect(ox+col*unit,oy+row*unit,unit,unit);
  }
}

/** Integer HUD pixels, with no writes to the room graph or exploration state. */
export function drawBattleMinimap(g:Phaser.GameObjects.Graphics,grid:readonly (readonly (RoomNode|null)[])[],
  currentX:number,currentY:number,hasEnemies:boolean):void {
  g.clear();const layout=minimapLayout(grid);
  g.setData({minimapLayout:layout,currentRoomId:grid[currentY]?.[currentX]?.id??null,hasEnemies});
  if(!layout)return;
  const {minX,minY,rows,columns,x,y,cellWidth:w,cellHeight:h,gap}=layout;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const gx=minX+col,gy=minY+row,node=grid[gy]?.[gx];if(!node)continue;
    const rx=x+col*(w+gap),ry=y+row*(h+gap);
    g.fillStyle(0x704487,1);
    if(node.doors.right&&grid[gy]?.[gx+1])g.fillRect(rx+w,ry+Math.floor(h/2)-1,gap,2);
    if(node.doors.bottom&&grid[gy+1]?.[gx])g.fillRect(rx+Math.floor(w/2)-1,ry+h,2,gap);
    const current=gx===currentX&&gy===currentY,style=minimapRoomStyle(node,current);
    const border=current&&h>=10?2:0;
    // Full-color tile faces keep tiny special rooms recognizable; only the player gets a bright rail.
    const fill=style.alpha<.9?dimColor(style.fill):style.fill;
    g.fillStyle(current?0xc9fcff:fill,1).fillRect(rx,ry,w,h);
    if(current&&w>border*2&&h>border*2)g.fillStyle(fill,1).fillRect(rx+border,ry+border,w-border*2,h-border*2);
    glyph(g,style.glyph,rx,ry,w,h,border+1);
    if(current&&hasEnemies){
      const size=w>=12&&h>=8?2:1;g.fillStyle(0xff4963).fillRect(rx+w-size-2,ry+2,size,size);
    }
  }
}

function dimColor(color:number):number {
  const dark=0x20132f,brightness=.82;
  const channel=(shift:number)=>Math.round(((color>>shift)&255)*brightness+((dark>>shift)&255)*(1-brightness));
  return channel(16)*65536+channel(8)*256+channel(0);
}
