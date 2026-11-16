/** Reference: the sheet's 'dark mage / dark binding' row. A chained seal rises and closes,
 * holds its target zone, then breaks into shadow fragments. This is not the meteor sequence.
 */
function glow(c:CanvasRenderingContext2D,x:number,y:number,r:number,alpha:number):void {
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(184,81,246,${alpha})`);g.addColorStop(1,'rgba(112,35,171,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function link(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,a:number,alpha=1):void {
  c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(a);c.beginPath();c.ellipse(0,0,w,h,0,0,Math.PI*2);
  c.strokeStyle='#180c26';c.lineWidth=3.4;c.stroke();c.strokeStyle='#aa64db';c.lineWidth=1.35;c.stroke();
  c.strokeStyle='rgba(232,183,255,.72)';c.lineWidth=.8;c.beginPath();c.ellipse(0,-.5,w*.8,h*.8,0,Math.PI,Math.PI*1.85);c.stroke();c.restore();
}
function seal(c:CanvasRenderingContext2D,phase:number,formation:number):void {
  c.save();c.globalAlpha*=formation;glow(c,96,96,90,.2);glow(c,96,96,28,.32);
  c.strokeStyle='#b45fec';c.lineWidth=1.6;c.beginPath();c.arc(96,96,83,-Math.PI/2,-Math.PI/2+Math.PI*2*formation);c.stroke();
  c.strokeStyle='rgba(198,134,244,.62)';c.lineWidth=1.1;c.beginPath();c.arc(96,96,63,0,Math.PI*2);c.stroke();
  for(let n=0;n<36;n++){const a=n*Math.PI*2/36+phase/36;link(c,96+Math.cos(a)*84,96+Math.sin(a)*84,6,3,a+Math.PI/2,.92);}
  for(let n=0;n<4;n++){
    const a=n*Math.PI/2;c.save();c.translate(96,96);c.rotate(a);c.strokeStyle='#dab1ff';c.lineWidth=1.8;c.beginPath();c.moveTo(0,-80);c.lineTo(7,-71);c.lineTo(0,-62);c.lineTo(-7,-71);c.closePath();c.stroke();c.restore();
  }
  // Four convergent sigil arms and a central eye/lock differ from binding's previous hexagram.
  c.strokeStyle='rgba(223,173,255,.85)';c.lineWidth=1.5;
  c.beginPath();c.moveTo(96,45);c.lineTo(108,96);c.lineTo(96,147);c.lineTo(84,96);c.closePath();c.moveTo(49,96);c.quadraticCurveTo(96,66,143,96);c.quadraticCurveTo(96,126,49,96);c.stroke();
  c.beginPath();c.moveTo(96,82);c.lineTo(105,96);c.lineTo(96,110);c.lineTo(87,96);c.closePath();c.stroke();
  for(let n=0;n<8;n++){const a=n*Math.PI/4,q=(phase/(Math.PI*2)+n/8)%1,r=61-q*28;c.save();c.translate(96+Math.cos(a)*r,96+Math.sin(a)*r);c.rotate(a+Math.PI);c.strokeStyle=`rgba(230,185,255,${Math.sin(q*Math.PI)*.7})`;c.beginPath();c.moveTo(-3,-2);c.lineTo(2,0);c.lineTo(-3,2);c.stroke();c.restore();}
  c.restore();
}
function column(c:CanvasRenderingContext2D,x:number,y:number,h:number):void {
  glow(c,x,y-h*.4,h*.55,.38);const g=c.createLinearGradient(x,y-h,x,y);g.addColorStop(0,'rgba(149,49,225,0)');g.addColorStop(.25,'rgba(175,65,246,.72)');g.addColorStop(1,'rgba(245,209,255,.95)');c.fillStyle=g;c.fillRect(x-3,y-h,6,h);c.fillStyle='rgba(255,237,255,.9)';c.fillRect(x-1,y-h*.8,2,h*.8);
}
function cage(c:CanvasRenderingContext2D,index:number,alpha=1,scale=1):void {
  const initial=index<4,u=initial?index/3:1,phase=initial?0:(index-4)*Math.PI/2;
  const rx=(80-u*10)*scale,ry=rx*.53,cy=initial?108-u*22:86+Math.sin(phase)*1.2;
  c.save();c.globalAlpha*=alpha;glow(c,96,99,63,.24);
  for(let n=0;n<4;n++){
    const a=n*Math.PI/2,bx=96+Math.cos(a)*80,by=109+Math.sin(a)*43,tx=96+Math.cos(a)*rx,ty=cy+Math.sin(a)*ry;
    for(let k=0;k<4;k++){const t=(k+.5)/4;link(c,bx+(tx-bx)*t,by+(ty-by)*t,4.5,2.6,Math.atan2(ty-by,tx-bx),.85);}
  }
  for(let n=0;n<28;n++){
    const a=n*Math.PI*2/28+phase/28,x=96+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
    link(c,x,y,5.5,2.8,Math.atan2(ry*Math.cos(a),-rx*Math.sin(a)),.95);
  }
  glow(c,96,96,23,.35);c.strokeStyle='rgba(237,186,255,.82)';c.lineWidth=1.3;c.beginPath();c.arc(96,96,11+Math.sin(phase)*1.1,0,Math.PI*2);c.stroke();c.restore();
}
export function paintBindingSeal(c:CanvasRenderingContext2D,phase:number,formation=1):void {
  c.save();c.beginPath();c.arc(96,96,95,0,Math.PI*2);c.clip();seal(c,phase,formation);c.restore();
}
export function paintBindingPower(c:CanvasRenderingContext2D,index:number):void {
  c.save();c.beginPath();c.arc(96,96,95,0,Math.PI*2);c.clip();
  if(index<4){const h=[13,43,76,40][index];column(c,96,99,h);column(c,77,103,h*.72);column(c,115,103,h*.8);}
  cage(c,index);
  if(index>=4)for(let n=0;n<8;n++){
    const a=n*Math.PI/4,q=((index-4)/4+n/8)%1,r=71-q*47,x=96+Math.cos(a)*r,y=96+Math.sin(a)*r;
    glow(c,x,y,5,Math.sin(q*Math.PI)*.25);
  }
  c.restore();
}
export function paintBindingRelease(c:CanvasRenderingContext2D,index:number):void {
  c.save();c.beginPath();c.arc(96,96,95,0,Math.PI*2);c.clip();
  const fade=[.85,.65,.35,.08][index];cage(c,4,fade,1-index*.1);glow(c,96,104,56,fade*.35);
  for(let n=0;n<10;n++){
    const a=n*2.399,r=20+index*12,x=96+Math.cos(a)*r,y=103+Math.sin(a)*r*.62,h=[21,32,16,4][index]*(.6+n%3*.2);
    c.globalAlpha=fade;c.fillStyle='#261033';c.strokeStyle='#a051cb';c.lineWidth=1;c.beginPath();c.moveTo(x-4,y);c.lineTo(x+Math.cos(a)*h*.2,y-h);c.lineTo(x+5,y-3);c.closePath();c.fill();c.stroke();
  }
  c.restore();
}
