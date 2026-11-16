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
    const fill=c.createLinearGradient(30,30,160,170);fill.addColorStop(0,'rgba(45,91,32,.88)');fill.addColorStop(.45,'rgba(15,51,29,.92)');fill.addColorStop(1,'rgba(54,79,19,.85)');c.fillStyle=fill;c.fillRect(0,0,192,192);
    for(let n=0;n<17;n++){
      const a=n*2.399,dist=18+n%5*13,x=96+Math.cos(a)*dist,y=96+Math.sin(a)*dist;
      glow(c,x,y,12+n%4*7,n%3?'83,151,45':'100,91,26',.22+.05*Math.sin(phase+n));
      const q=(phase/(Math.PI*2)+n*.137)%1,r=1+5*Math.sin(q*Math.PI);
      c.fillStyle='rgba(112,168,50,.18)';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
      c.strokeStyle=`rgba(166,205,77,${.4*Math.sin(q*Math.PI)})`;c.lineWidth=1.3;c.stroke();
      c.fillStyle='rgba(208,227,130,.5)';c.beginPath();c.arc(x-r*.3,y-r*.3,.8,0,Math.PI*2);c.fill();
    }
    c.restore();puddle(c,phase);c.strokeStyle='rgba(126,181,58,.72)';c.lineWidth=2.4;c.lineJoin='round';c.stroke();
    // Disconnected wet drops make the surface read as spreading contamination, not a magic ring.
    for(let n=0;n<7;n++){
      const a=n*2.399+.3,dist=88+n%2*3;c.fillStyle='rgba(106,151,38,.62)';c.beginPath();c.ellipse(96+Math.cos(a)*dist,96+Math.sin(a)*dist,2+n%2,1.5,a,0,Math.PI*2);c.fill();
    }
  }else{
    for(let n=0;n<14;n++){
      const a=n*2.399,dist=25+n%4*14,q=(phase/(Math.PI*2)+n*.137)%1;
      const x=96+Math.cos(a)*dist+Math.sin(q*Math.PI*2)*4,y=96+Math.sin(a)*dist-q*22;
      glow(c,x,y,8+n%3*3,'140,183,67',Math.sin(q*Math.PI)*.32);
      if(q<.55){c.strokeStyle=`rgba(183,213,103,${Math.sin(q*Math.PI)*.55})`;c.lineWidth=1.2;c.beginPath();c.arc(x,y,1.5+q*5,0,Math.PI*2);c.stroke();}
    }
  }
  c.restore();
}
export function paintBinding(c:CanvasRenderingContext2D,phase:number,layer:'ground'|'motes',formation=1):void {
  if(layer==='ground')paintBindingSeal(c,phase,formation);
  else paintBindingPower(c,Math.round(phase/(Math.PI/4)));
}
export {paintBindingRelease};
