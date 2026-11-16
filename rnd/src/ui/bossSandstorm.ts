/** Both cached layers share one spiral: outer dust sweeps inward and then lifts into the eye.
 * The 192px canvas stays centered on the hazard. This artwork never owns damage or movement.
 */
import type Phaser from 'phaser';
export const SANDSTORM_SOURCE='sandstorm_source_v1';
/** Reference-derived air sprites; procedural artwork is retained as a resource fallback. */
export function paintSandstormAir(scene:Phaser.Scene,c:CanvasRenderingContext2D,index:number):void {
 if(scene.textures.exists(SANDSTORM_SOURCE)){
  const texture=scene.textures.get(SANDSTORM_SOURCE),name=`sand_${index}`;
  if(texture.has(name)){const f=texture.get(name);c.drawImage(f.source.image as HTMLImageElement,f.cutX,f.cutY,192,192,0,0,192,192);return;}
 }
 paintSandstorm(c,'motes',Math.min(7,index));
}
/** Broad, broken wind fronts fill the outer 80–98% of the existing radius.
 * Six repeated arms advance 15 degrees per frame for a seamless four-frame loop.
 * Baked once into the ground cache; no extra runtime objects or damage geometry.
 */
function paintSandPeriphery(c:CanvasRenderingContext2D,index:number):void {
 const phase=-(index%4)*Math.PI/12;
 c.save();c.lineCap='round';
 for(let arm=0;arm<6;arm++){
  const start=arm*Math.PI/3+phase;
  // A wide translucent dust bank with a brighter inward-flowing lip, rather than a solid ring.
  for(let pass=0;pass<3;pass++)for(let n=0;n<24;n++){
   const u=n/24,v=(n+1)/24,a=start+u*.94,b=start+v*.94;
   const r=90-u*15,rr=90-v*15;
   c.lineWidth=pass===0?12:pass===1?5.5:1.3;
   c.strokeStyle=pass===0?'#c68d45':pass===1?'#edbd72':'#ffe1a0';
   c.globalAlpha=Math.sin(Math.PI*(.06+u*.88))*(pass===0?.2:pass===1?.34:.48);
   c.beginPath();c.moveTo(96+Math.cos(a)*r,96+Math.sin(a)*r);c.lineTo(96+Math.cos(b)*rr,96+Math.sin(b)*rr);c.stroke();
  }
  // Short tangential grain trails make the complete boundary feel active on small screens.
  for(let n=0;n<5;n++){
   const a=start+n*.18,r=84+n%3*3;
   c.strokeStyle=n%2?'#f8d491':'#d7a15c';c.globalAlpha=.45;c.lineWidth=n%2?1:1.8;
   c.beginPath();c.arc(96,96,r,a,a+.035+n*.007);c.stroke();
  }
  const a=start+.32,r=83,x=96+Math.cos(a)*r,y=96+Math.sin(a)*r;
  c.save();c.translate(x,y);c.rotate(a);const haze=c.createRadialGradient(0,0,0,0,0,14);
  haze.addColorStop(0,'rgba(230,180,101,.26)');haze.addColorStop(1,'rgba(207,149,67,0)');
  c.globalAlpha=1;c.fillStyle=haze;c.scale(.7,1.5);c.fillRect(-14,-14,28,28);c.restore();
 }
 c.restore();
}
export function paintSandstorm(c:CanvasRenderingContext2D,layer:'ground'|'motes',index:number):void {
 const phase=(index<4?index:index-4)*Math.PI/2,growth=index<4?[0,.4,.8,1][index]:1;
 const air=layer==='motes';
 c.save();c.beginPath();c.arc(96,96,94,0,Math.PI*2);c.clip();
 if(!air){
  const dust=c.createRadialGradient(96,96,9,96,96,94);
  dust.addColorStop(0,'rgba(92,53,20,.3)');dust.addColorStop(.45,'rgba(207,142,51,.22)');dust.addColorStop(.85,'rgba(215,155,67,.16)');dust.addColorStop(1,'rgba(255,215,132,0)');
  c.fillStyle=dust;c.fillRect(0,0,192,192);
  paintSandPeriphery(c,index);
 }
 const point=(arm:number,u:number):[number,number]=>{
  const a=phase+arm*Math.PI*2/3+u*Math.PI*2.4,r=90-u*78;
  return [96+Math.cos(a)*r,96+Math.sin(a)*r*(air?1-u*.55:1)-(air?u*u*30*growth:0)];
 };
 for(let arm=0;arm<3;arm++){
  for(let pass=0;pass<3;pass++)for(let n=0;n<40;n++){
   const u=n/40,v=(n+1)/40,[x,y]=point(arm,u),[nx,ny]=point(arm,v);
   const fade=Math.sin(Math.PI*(.05+u*.9));
   c.lineCap='round';c.lineWidth=pass===0?(air?12:17):pass===1?(air?5:7):1.2;
   c.strokeStyle=pass===0?'#bc8034':pass===1?'#eab75f':'#ffe4a2';
   c.globalAlpha=fade*(pass===0?.1:pass===1?(air?.22:.14):air?.75:.12);
   c.beginPath();c.moveTo(x,y);c.lineTo(nx,ny);c.stroke();
  }
  if(air)for(let n=0;n<6;n++){
   const u=(n+.25)/6,[x,y]=point(arm,u),[nx,ny]=point(arm,Math.min(1,u+.02));
   c.save();c.translate(x,y);c.rotate(Math.atan2(ny-y,nx-x));c.globalAlpha=.7;
   c.fillStyle=n%2?'#d4a05b':'#896034';c.strokeStyle='#f9d487';c.lineWidth=.7;
   c.beginPath();c.moveTo(-2,-2);c.lineTo(2,-3);c.lineTo(4,1);c.lineTo(-1,3);c.closePath();c.fill();c.stroke();c.restore();
  }
 }
 if(air){
  const y=96-30*growth,g=c.createRadialGradient(96,y,1,96,y,23);
  g.addColorStop(0,'rgba(255,237,184,.65)');g.addColorStop(.35,'rgba(240,187,88,.36)');g.addColorStop(1,'rgba(219,156,55,0)');
  c.globalAlpha=1;c.fillStyle=g;c.fillRect(73,y-23,46,46);
 }
 c.restore();
}
