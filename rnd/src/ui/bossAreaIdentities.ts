import {paintBindingSeal,paintBindingPower,paintBindingRelease} from './bossBindingReference';
/** Native-resolution spell artwork. Poison is a liquid silhouette; binding is constructed geometry.
 * These are distinct drawing paths, not palette swaps of a shared circular material.
 */
function glow(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha:number):void {
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function puddle(c:CanvasRenderingContext2D,phase:number):void {
  c.beginPath();
  for(let n=0;n<=96;n++){
    const a=n*Math.PI*2/96,r=Math.min(94,80+8*Math.sin(a*3+.6)+5*Math.sin(a*7-1.1)+2*Math.sin(a*11+phase));
    const x=96+Math.cos(a)*r,y=96+Math.sin(a)*r;if(n===0)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.closePath();
}
export function paintPoison(c:CanvasRenderingContext2D,phase:number,layer:'ground'|'motes',growth=1):void {
  c.save();c.beginPath();c.arc(96,96,95,0,Math.PI*2);c.clip();
  if(layer==='ground'){
    c.translate(96,96);c.scale(.15+.85*growth,.15+.85*growth);c.translate(-96,-96);
    c.save();puddle(c,phase);c.clip();
    const fill=c.createLinearGradient(30,30,160,170);fill.addColorStop(0,'rgba(72,132,31,.8)');fill.addColorStop(.45,'rgba(12,58,37,.83)');fill.addColorStop(1,'rgba(80,109,22,.8)');c.fillStyle=fill;c.fillRect(0,0,192,192);
    for(let n=0;n<17;n++){
      const a=n*2.399,dist=18+n%5*13,x=96+Math.cos(a)*dist,y=96+Math.sin(a)*dist;
      glow(c,x,y,12+n%4*7,n%3?'83,151,45':'100,91,26',.22+.05*Math.sin(phase+n));
      const q=(phase/(Math.PI*2)+n*.137)%1,r=2+(7+n%3*2)*Math.sin(q*Math.PI);
      const bubble=c.createRadialGradient(x-r*.3,y-r*.4,.2,x,y,r);
      bubble.addColorStop(0,'rgba(226,255,157,.7)');bubble.addColorStop(.3,'rgba(158,224,66,.35)');bubble.addColorStop(1,'rgba(56,117,37,.08)');
      c.fillStyle=bubble;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
      c.strokeStyle=`rgba(184,242,89,${.65*Math.sin(q*Math.PI)})`;c.lineWidth=1.5;c.stroke();
      c.strokeStyle='rgba(232,255,173,.8)';c.lineWidth=1.6;c.beginPath();c.arc(x,y,r*.7,Math.PI*1.1,Math.PI*1.65);c.stroke();
    }
    c.restore();puddle(c,phase);c.strokeStyle='rgba(72,164,50,.3)';c.lineWidth=8;c.lineJoin='round';c.stroke();
    c.strokeStyle='rgba(159,224,69,.85)';c.lineWidth=2.8;c.stroke();
    // Disconnected wet drops make the surface read as spreading contamination, not a magic ring.
    for(let n=0;n<7;n++){
      const a=n*2.399+.3,dist=88+n%2*3;c.fillStyle='rgba(106,151,38,.62)';c.beginPath();c.ellipse(96+Math.cos(a)*dist,96+Math.sin(a)*dist,2+n%2,1.5,a,0,Math.PI*2);c.fill();
    }
  }else{
    for(let n=0;n<6;n++){
      const a=n*2.399,q=(phase/(Math.PI*2)+n*.19)%1,r=28+n%3*16;
      const x=96+Math.cos(a)*r+Math.sin(q*Math.PI*2)*7,y=105+Math.sin(a)*r*.65-q*32;
      glow(c,x,y,17+n%3*5,'110,204,63',Math.sin(q*Math.PI)*.22);
      c.strokeStyle=`rgba(159,226,84,${Math.sin(q*Math.PI)*.35})`;c.lineWidth=2;
      c.beginPath();c.ellipse(x,y,10+q*9,4+q*6,a*.2,Math.PI*.1,Math.PI*1.45);c.stroke();
    }
    for(let n=0;n<14;n++){
      const a=n*2.399,dist=25+n%4*14,q=(phase/(Math.PI*2)+n*.137)%1;
      const x=96+Math.cos(a)*dist+Math.sin(q*Math.PI*2)*4,y=96+Math.sin(a)*dist-q*22;
      glow(c,x,y,8+n%3*3,'140,183,67',Math.sin(q*Math.PI)*.32);
      if(q<.55){c.strokeStyle=`rgba(183,213,103,${Math.sin(q*Math.PI)*.55})`;c.lineWidth=1.2;c.beginPath();c.arc(x,y,1.5+q*5,0,Math.PI*2);c.stroke();}
    }
  }
  c.restore();
}
/** A one-shot liquid crown; the final four frames are the quiet mist loop, never a repeated explosion. */
export function paintPoisonPower(c:CanvasRenderingContext2D,index:number):void {
  if(index>=4){paintPoison(c,(index-4)*Math.PI/2,'motes');return;}
  c.save();c.beginPath();c.arc(96,96,94,0,Math.PI*2);c.clip();
  const u=index/3,reach=24+u*48,height=[20,44,34,12][index];
  glow(c,96,100,75,'154,233,73',[.65,.5,.3,.12][index]);
  for(let n=0;n<12;n++){
    const a=n*Math.PI/6,x=96+Math.cos(a)*reach,y=101+Math.sin(a)*reach*.6;
    c.strokeStyle=`rgba(134,218,50,${.8-u*.35})`;c.lineWidth=6-u*3;c.lineCap='round';
    c.beginPath();c.moveTo(96+Math.cos(a)*17,101+Math.sin(a)*12);
    c.quadraticCurveTo(x,y-height,x,y);c.stroke();
    const r=4+(n%3)*1.6;
    c.fillStyle='#90d947';c.beginPath();c.ellipse(x,y-height*.3,r,r*1.3,a,0,Math.PI*2);c.fill();
    c.fillStyle='#e1ffa0';c.beginPath();c.ellipse(x-r*.25,y-height*.3-r*.3,r*.3,r*.55,a,0,Math.PI*2);c.fill();
  }
  c.restore();
}
export function paintPoisonRelease(c:CanvasRenderingContext2D,index:number):void {
  c.save();c.beginPath();c.arc(96,96,94,0,Math.PI*2);c.clip();
  const u=index/3;
  for(let n=0;n<9;n++){
    const a=n*2.399,r=20+n%4*15,x=96+Math.cos(a)*r*(1-u*.25),y=96+Math.sin(a)*r*.7-u*24;
    glow(c,x,y,13+u*13,'157,218,78',(1-u*.9)*.28);
    c.strokeStyle=`rgba(185,239,110,${(1-u)*.6})`;c.lineWidth=1.5;
    c.beginPath();c.ellipse(x,y,5+u*8,3+u*5,a,Math.PI*.2,Math.PI*1.5);c.stroke();
  }
  c.restore();
}
export function paintBinding(c:CanvasRenderingContext2D,phase:number,layer:'ground'|'motes',formation=1):void {
  if(layer==='ground')paintBindingSeal(c,phase,formation);
  else paintBindingPower(c,Math.round(phase/(Math.PI/4)));
}
export {paintBindingRelease};
