import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the real input handlers without starting a renderer or loading bitmap assets.
const module={exports:{}};
const code=ts.transpileModule(readFileSync('src/ui/VirtualJoystick.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
new Function('require','module','exports',code)(name=>{
 if(name==='phaser')return {__esModule:true,default:{Math:{Clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}}};
 if(name==='../config/gameData')return {GAME_WIDTH:720,GAME_HEIGHT:1280};
 if(name==='./fantasyTheme')return {FANTASY:{}};
 if(name==='./bottomHudArt')return {BOTTOM_HUD:'bottom_hud'};
 throw Error(`Unexpected import: ${name}`);
},module,module.exports);
const {VirtualJoystick}=module.exports;
class Signals {
 handlers=[];
 on(event,fn,context){this.handlers.push({event,fn,context});}
 off(event,fn,context){this.handlers=this.handlers.filter(h=>h.event!==event||h.fn!==fn||h.context!==context);}
 emit(event,...args){for(const h of this.handlers.filter(h=>h.event===event))h.fn.apply(h.context,args);}
}
function fixture(){
 const image=()=>({setDisplaySize(){return this;},setDepth(){return this;},setOrigin(){return this;},
  setAlpha(alpha){this.alpha=alpha;return this;},setPosition(x,y){Object.assign(this,{x,y});return this;},destroy(){}});
 const input=new Signals(),events=new Signals(),canvas=new EventTarget();let stops=0;
 const joystick=new VirtualJoystick({add:{image,text:image},input,game:{events,canvas}},()=>stops++);
 const down=(id,x,y)=>input.emit('pointerdown',{id,x,y});
 const move=(id,x,y)=>input.emit('pointermove',{id,x,y});
 return {joystick,input,events,canvas,down,move,stops:()=>stops};
}
test('only the lower left arena and joystick slot can acquire movement',()=>{
 const f=fixture();
 for(const [x,y]of [[-1,900],[80,639],[360,900],[640,900],[80,1080],[80,1179],[220,1230],[484,1230],[80,1281]]){
  f.down(1,x,y);assert.equal(f.joystick.activePointerId,null,`${x},${y}`);
 }
 for(const [x,y]of [[80,640],[359,1079],[130,1180],[130,1230]]){
  f.down(1,x,y);assert.equal(f.joystick.activePointerId,1,`${x},${y}`);f.joystick.reset();
 }
});
test('both finger orders preserve movement when the skill finger moves or releases',()=>{
 for(const skillFirst of [false,true]){
  const f=fixture();
  if(skillFirst)f.down(2,484,1230);
  f.down(1,130,1230);f.move(1,190,1230);
  if(!skillFirst)f.down(2,484,1230);
  f.move(2,100,900);f.input.emit('pointerup',{id:2});
  assert.equal(f.joystick.activePointerId,1);assert.ok(f.joystick.dirX>0);
  f.input.emit('pointerupoutside',{id:1});
  assert.equal(f.joystick.activePointerId,null);assert.equal(f.joystick.dirX,0);assert.equal(f.joystick.dirY,0);
 }
});
test('cancel and blur clear movement immediately and stale moves cannot reacquire it',()=>{
 for(const kind of ['touchcancel','pointercancel','blur']){
  const f=fixture();f.down(1,130,1230);f.move(1,190,1230);
  if(kind==='blur')f.events.emit(kind);else f.canvas.dispatchEvent(new Event(kind));
  assert.equal(f.stops(),1);assert.equal(f.joystick.activePointerId,null);
  f.move(1,220,900);assert.equal(f.joystick.dirX,0);assert.equal(f.joystick.dirY,0);
  assert.equal(f.joystick.baseSprite.alpha,1);
 }
});
test('modal reset releases ownership and destroy removes external listeners',()=>{
 const f=fixture();f.down(1,100,900);f.move(1,150,900);f.joystick.reset();
 assert.equal(f.joystick.activePointerId,null);assert.equal(f.joystick.dirX,0);
 f.joystick.destroy();assert.equal(f.input.handlers.length,0);assert.equal(f.events.handlers.length,0);
 f.canvas.dispatchEvent(new Event('touchcancel'));f.canvas.dispatchEvent(new Event('pointercancel'));
 assert.equal(f.stops(),0);
});
