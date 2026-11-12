import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const model={};
new Function('exports',ts.transpileModule(readFileSync('src/ui/minimapLayout.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(model);
const {MINIMAP_VIEW:area,minimapLayout,minimapRoomStyle}=model;
const renderer={};
new Function('exports','require',ts.transpileModule(readFileSync('src/ui/battleMinimap.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(renderer,()=>model);
const room=(x,y,type='COMBAT',visited=false,cleared=false)=>({id:`${x}_${y}`,gridX:x,gridY:y,type,visited,cleared,
 doors:{top:false,bottom:false,left:false,right:false},waveCount:1});

test('all supported maps use the largest square tiles that fit, centered on whole pixels',()=>{
 for(let rows=1;rows<=5;rows++)for(let cols=1;cols<=5;cols++){
  const grid=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>room(x,y)));
  const snapshot=JSON.stringify(grid),r=minimapLayout(grid);
  assert.ok(r.x>=area.x&&r.y>=area.y&&r.x+r.width<=area.x+area.width&&r.y+r.height<=area.y+area.height);
  assert.ok(Math.abs(r.x+r.width/2-(area.x+area.width/2))<=.5);
  assert.ok(Math.abs(r.y+r.height/2-(area.y+area.height/2))<=.5);
  assert.equal(r.cellWidth,r.cellHeight);
  const nextWidth=cols*(r.cellWidth+1)+(cols-1)*r.gap,nextHeight=rows*(r.cellHeight+1)+(rows-1)*r.gap;
  assert.ok(nextWidth>area.width||nextHeight>area.height,'A larger square must not fit');
  assert.ok(Object.values(r).every(Number.isInteger));assert.ok(r.cellHeight>=11);
  assert.equal(JSON.stringify(grid),snapshot);
 }
});

test('occupied room bounds remove empty margins while preserving holes and original coordinates',()=>{
 const grid=Array.from({length:5},()=>Array(5).fill(null));grid[1][1]=room(1,1);grid[1][3]=room(3,1);grid[3][2]=room(2,3);
 const r=minimapLayout(grid);assert.equal(r.minX,1);assert.equal(r.minY,1);assert.equal(r.columns,3);assert.equal(r.rows,3);
 assert.equal(grid[2][2],null);assert.equal(minimapLayout([]),null);assert.equal(minimapLayout([[null,null]]),null);
});

test('special room types remain visible before exploration and differ by both symbol and fill',()=>{
 const glyphs=new Set(),fills=new Set();
 for(const type of ['RECOVERY','EVENT','BOSS','ELITE']){
  const n=room(0,0,type),unknown=minimapRoomStyle(n,false),known=minimapRoomStyle({...n,visited:true},false);
  assert.equal(unknown.glyph,known.glyph);assert.equal(unknown.fill,known.fill);
  if(type==='BOSS')assert.equal(unknown.alpha,known.alpha);else assert.ok(unknown.alpha<known.alpha);
  glyphs.add(unknown.glyph);fills.add(unknown.fill);
 }
 assert.equal(glyphs.size,4);assert.equal(fills.size,4);
});

test('player priority, cleared rooms, pending danger and supplies preserve room state without mutation',()=>{
 const n=Object.freeze(room(1,1,'BOSS')),snapshot=JSON.stringify(n);
 const current=minimapRoomStyle(n,true);assert.equal(current.glyph,'player');assert.equal(current.alpha,1);
 assert.notEqual(current.fill,minimapRoomStyle(n,false).fill);assert.equal(JSON.stringify(n),snapshot);
 assert.equal(minimapRoomStyle(room(0,0),false).glyph,'room');
 assert.equal(minimapRoomStyle(room(0,0,'COMBAT',true,false),false).glyph,'danger');
 assert.equal(minimapRoomStyle(room(0,0,'COMBAT',true,true),false).glyph,'cleared');
 assert.equal(minimapRoomStyle({...room(0,0),sideSupply:true},false).glyph,'supply');
});

test('renderer emits bounded whole-pixel shapes with opaque tile/icon fills',()=>{
 const grid=Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>room(x,y,
  ['COMBAT','ELITE','EVENT','RECOVERY','BOSS'][x],y%2===0)));
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)Object.assign(grid[y][x].doors,{right:x<4,bottom:y<4});
 const rects=[],snapshot=JSON.stringify(grid);let color,alpha;
 const g={clear(){return this;},setData(){return this;},fillStyle(c,a=1){color=c;alpha=a;return this;},
  fillRect(x,y,w,h){rects.push({x,y,w,h,color,alpha});return this;}};
 renderer.drawBattleMinimap(g,grid,2,2,true);
 assert.ok(rects.length>100,'Tile glyphs must be present');
 for(const r of rects){
  assert.ok([r.x,r.y,r.w,r.h].every(Number.isInteger));assert.ok(r.w>0&&r.h>0);
  assert.ok(r.x>=area.x&&r.y>=area.y&&r.x+r.w<=area.x+area.width&&r.y+r.h<=area.y+area.height);
  assert.equal(r.alpha,1,'Tiles and symbols must not accumulate translucent fills');
 }
 const icons=rects.filter(r=>[0xffffff,0xd6ff92,0xf3cfff,0xffebf2].includes(r.color));
 assert.ok(icons.length>20);
 for(const r of icons)assert.ok(r.w>=2&&r.h>=2,'Small-map icons need strokes visible at 360px');
 const layout=minimapLayout(grid),shapes=new Set();
 for(const col of [1,2,3,4]){
  const x=layout.x+col*(layout.cellWidth+layout.gap),y=layout.y;
  const shape=icons.filter(r=>r.x>=x&&r.x<x+layout.cellWidth&&r.y>=y&&r.y<y+layout.cellHeight)
   .map(r=>[r.x-x,r.y-y,r.w,r.h]);
  shapes.add(JSON.stringify(shape));
 }
 assert.equal(shapes.size,4,'Danger, event, heal and boss symbols must differ without color');
 assert.ok(rects.some(r=>r.color===0xffffff));assert.equal(JSON.stringify(grid),snapshot);
});
