/** Rebuilt from the supplied design sheet's silhouettes, not cropped opaque grid cells.
 * Native 192px facets + soft light preserve readable pixel-fantasy shapes without enlarging tiny art.
 */
export type ReferenceEffectStyle='earth'|'fire'|'void'|'frost';
export const REFERENCE_IMPACT_TIMES=[0,35,70,120,190,280,420,600] as const;
export function referenceImpactIndex(after:number):number {
  let i=0;while(i+1<REFERENCE_IMPACT_TIMES.length&&after>=REFERENCE_IMPACT_TIMES[i+1])i++;return i;
}
function glow(c:CanvasRenderingContext2D,x:number,y:number,r:number,rgb:string,alpha:number):void {
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${rgb},${alpha})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function rock(c:CanvasRenderingContext2D,x:number,y:number,r:number,angle:number,voidStone=false):void {
  c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(-r,r*.2);c.lineTo(-r*.65,-r*.7);c.lineTo(r*.15,-r);c.lineTo(r*.9,-r*.35);c.lineTo(r*.8,r*.6);c.lineTo(-r*.2,r*.85);c.closePath();c.fillStyle=voidStone?'#180c26':'#3b291c';c.fill();
  c.beginPath();c.moveTo(-r*.65,-r*.7);c.lineTo(r*.15,-r);c.lineTo(r*.9,-r*.35);c.lineTo(r*.15,r*.2);c.lineTo(-r,r*.2);c.closePath();c.fillStyle=voidStone?'#623383':'#9c784a';c.fill();
  c.strokeStyle=voidStone?'#b777ee':'#c4a274';c.lineWidth=.9;c.beginPath();c.moveTo(-r*.6,-r*.65);c.lineTo(r*.1,-r*.9);c.lineTo(r*.7,-r*.35);c.stroke();c.restore();
}
function crystal(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,tilt:number,ice:boolean):void {
  c.save();c.translate(x,y);c.rotate(tilt);const g=c.createLinearGradient(0,-h,0,0);
  g.addColorStop(0,ice?'#d7fcff':'#a664e5');g.addColorStop(.45,ice?'#52bde8':'#321247');g.addColorStop(1,ice?'#22698c':'#12081d');
  c.fillStyle=g;c.beginPath();c.moveTo(-w*.5,0);c.lineTo(-w*.7,-h*.42);c.lineTo(0,-h);c.lineTo(w*.65,-h*.63);c.lineTo(w*.5,0);c.closePath();c.fill();
  c.fillStyle=ice?'rgba(204,248,255,.7)':'rgba(137,64,207,.7)';c.beginPath();c.moveTo(0,-h);c.lineTo(w*.65,-h*.63);c.lineTo(w*.5,0);c.lineTo(0,-h*.1);c.closePath();c.fill();
  c.strokeStyle=ice?'rgba(243,255,255,.9)':'rgba(218,158,255,.85)';c.lineWidth=1.2;c.beginPath();c.moveTo(-w*.6,-h*.4);c.lineTo(0,-h);c.lineTo(w*.6,-h*.62);c.stroke();c.restore();
}
function leaf(c:CanvasRenderingContext2D,x:number,y:number,r:number,a:number):void {
  c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#80b93b';c.beginPath();c.moveTo(-r,0);c.quadraticCurveTo(0,-r,r,0);c.quadraticCurveTo(0,r,-r,0);c.fill();c.strokeStyle='#cce98b';c.lineWidth=.8;c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.stroke();c.restore();
}
function beam(c:CanvasRenderingContext2D,x:number,y:number,h:number,w:number,rgb:string):void {
  if(h<=0)return;glow(c,x,y-h*.4,h*.65,rgb,.3);
  const g=c.createLinearGradient(x,y-h,x,y);g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(.28,`rgba(${rgb},.9)`);g.addColorStop(1,'rgba(255,255,231,.96)');
  c.fillStyle=g;c.beginPath();c.moveTo(x-w,y);c.quadraticCurveTo(x-w*.45,y-h*.4,x,y-h);c.quadraticCurveTo(x+w*.4,y-h*.35,x+w,y);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,240,.9)';c.fillRect(x-1.6,y-h*.78,3.2,h*.78);
  c.beginPath();c.moveTo(x-1.6,y-h*.78);c.lineTo(x,y-h*.98);c.lineTo(x+1.6,y-h*.78);c.fill();
}
function snowflake(c:CanvasRenderingContext2D,r:number,alpha:number):void {
  c.strokeStyle=`rgba(210,249,255,${alpha})`;c.lineWidth=1.4;
  for(let n=0;n<6;n++){
    const a=n*Math.PI/3;c.beginPath();c.moveTo(96,96);c.lineTo(96+Math.cos(a)*r,96+Math.sin(a)*r);
    for(let d=24;d<r;d+=19)for(const sign of [-1,1]){const x=96+Math.cos(a)*d,y=96+Math.sin(a)*d;c.moveTo(x,y);c.lineTo(x-Math.cos(a)*10+Math.cos(a+Math.PI/2)*sign*8,y-Math.sin(a)*10+Math.sin(a+Math.PI/2)*sign*8);}c.stroke();
  }
}
function basaltCells():{x:number;y:number;points:{x:number;y:number}[]}[] {
  const seeds=Array.from({length:27},(_,n)=>{const a=n*2.399,r=n===0?0:88*Math.sqrt(n/27);return{x:96+Math.cos(a)*r,y:96+Math.sin(a)*r};});
  return seeds.map((seed,index)=>{
    let points=[{x:0,y:0},{x:192,y:0},{x:192,y:192},{x:0,y:192}];
    for(let j=0;j<seeds.length;j++)if(j!==index){
      const other=seeds[j],dx=other.x-seed.x,dy=other.y-seed.y,mx=(other.x+seed.x)/2,my=(other.y+seed.y)/2,next:typeof points=[];
      for(let n=0;n<points.length;n++){
        const a=points[n],b=points[(n+1)%points.length],da=(a.x-mx)*dx+(a.y-my)*dy,db=(b.x-mx)*dx+(b.y-my)*dy;
        if(da<=0)next.push(a);
        if((da<=0)!==(db<=0)){const u=da/(da-db);next.push({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u});}
      }
      points=next;
    }
    return{...seed,points};
  });
}
// Fixed irregular rock plates; generated once, never during combat or separately per frame.
const BASALT=basaltCells();
function fireGround(c:CanvasRenderingContext2D,i:number):void {
  const heat=[.55,.9,1,1,.9,.65,.35,.1][i];
  c.save();c.beginPath();c.arc(96,96,88,0,Math.PI*2);c.clip();glow(c,96,96,91,'243,63,13',.55*heat);
  for(const [index,cell]of BASALT.entries()){
    const shade=index*13%14,localHeat=heat*(.4+.6*Math.max(0,1-Math.hypot(cell.x-96,cell.y-96)/105));
    c.beginPath();for(const [n,p]of cell.points.entries()){if(n===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}c.closePath();
    c.fillStyle=`rgba(${32+shade},${17+shade/2},15,.82)`;c.fill();c.strokeStyle=`rgba(255,75,11,${localHeat*.32})`;c.lineWidth=6;c.stroke();c.strokeStyle=`rgba(255,166,45,${localHeat*.85})`;c.lineWidth=1.8;c.stroke();
  }
  glow(c,96,96,42,'255,187,80',heat*.55);c.restore();
}
function voidGround(c:CanvasRenderingContext2D,i:number):void {
  const light=[.55,.75,.95,1,.8,.55,.35,.16][i];glow(c,96,96,92,'112,35,176',.28*light);
  c.strokeStyle=`rgba(197,119,255,${light*.8})`;c.lineWidth=1.8;c.beginPath();c.arc(96,96,85,0,Math.PI*2);c.stroke();
  c.beginPath();c.ellipse(96,96,72,56,0,0,Math.PI*2);c.ellipse(96,96,49,38,0,0,Math.PI*2);c.stroke();
  for(let n=0;n<4;n++){
    const a=n*Math.PI/2;c.save();c.translate(96,96);c.rotate(a);c.beginPath();c.moveTo(0,-78);c.lineTo(9,-63);c.lineTo(0,-48);c.lineTo(-9,-63);c.closePath();c.stroke();c.restore();
  }
  c.beginPath();c.moveTo(96,37);c.lineTo(111,96);c.lineTo(96,155);c.lineTo(81,96);c.closePath();c.moveTo(37,96);c.lineTo(96,81);c.lineTo(155,96);c.lineTo(96,111);c.closePath();c.stroke();
  if(i>=2)for(let n=0;n<11;n++){const a=n*2.399;rock(c,96+Math.cos(a)*70,96+Math.sin(a)*70,3+n%3,a,true);}
}
function earthGround(c:CanvasRenderingContext2D,i:number):void {
  const energy=[.8,1,1,.85,.6,.4,.2,.08][i];glow(c,96,96,89,'84,117,34',.5);
  c.fillStyle='rgba(55,40,25,.55)';c.beginPath();c.arc(96,96,67,0,Math.PI*2);c.fill();
  c.strokeStyle=`rgba(187,234,92,${energy*.65})`;c.lineWidth=1.6;
  for(let n=0;n<9;n++){const a=n*2.399;c.beginPath();c.moveTo(96,96);c.lineTo(96+Math.cos(a+.1)*38,96+Math.sin(a+.1)*38);c.lineTo(96+Math.cos(a)*79,96+Math.sin(a)*79);c.stroke();}
  for(let n=0;n<17;n++){const a=n*Math.PI*2/17,r=65+n%3*5;rock(c,96+Math.cos(a)*r,96+Math.sin(a)*r,6+n%4,a);}
  glow(c,96,96,49,'175,238,76',energy*.32);
}
function frostGround(c:CanvasRenderingContext2D,phase:number):void {
  glow(c,96,96,94,'95,180,234',.38);glow(c,96,96,70,'172,230,255',.17+.03*Math.sin(phase));snowflake(c,84,.55);
  c.strokeStyle='rgba(183,239,255,.55)';c.lineWidth=2;c.beginPath();c.arc(96,96,89,0,Math.PI*2);c.stroke();
  for(let n=0;n<12;n++){const a=n*Math.PI/6+.07*Math.sin(phase+n),x=96+Math.cos(a)*77,y=96+Math.sin(a)*77;glow(c,x,y,9,'206,248,255',.22);}
}
function air(c:CanvasRenderingContext2D,style:ReferenceEffectStyle,i:number):void {
  if(style==='frost'){
    const height=[.2,.55,1,.48,.24,.2,.26,.22][i];
    glow(c,96,105,69,'116,218,255',i<4?.55:.25);
    for(let n=0;n<7;n++){const a=n*Math.PI*2/7,r=22+n%3*12;crystal(c,96+Math.cos(a)*r,101+Math.sin(a)*r*.55,12+n%3*3,(35+n%3*17)*height,Math.cos(a)*.16,true);}
    for(let n=0;n<13;n++){const a=n*2.399+i*.13,r=33+n%4*14,x=96+Math.cos(a)*r,y=96+Math.sin(a)*r-5*Math.sin(i+n);glow(c,x,y,5,'209,249,255',.35);c.fillStyle='rgba(231,254,255,.75)';c.fillRect(x-1,y-2,2,4);}
    return;
  }
  const h=[28,52,84,82,60,0,0,0][i],earth=style==='earth',voidEffect=style==='void';
  const rgb=earth?'168,244,57':voidEffect?'185,67,255':'255,111,19';
  if(i<=4){glow(c,96,101,45,rgb,.65);beam(c,96,101,h,earth?7:voidEffect?5:10,rgb);if(style==='fire'){beam(c,71,107,h*.7,7,rgb);beam(c,122,107,h*.77,6,rgb);}}
  if(style==='fire'&&i<=4)for(let n=0;n<6;n++)beam(c,77+n*7,108+Math.sin(n)*4,h*(.22+n%3*.08),2.5,rgb);
  const travel=[12,24,36,50,65,76,80,84][i],fade=i<5?1:[.58,.3,.12][i-5];
  for(let n=0;n<11;n++){
    const a=n*2.399,r=travel*(.55+n%3*.14),x=96+Math.cos(a)*r,y=100+Math.sin(a)*r*.8-(i<5?Math.sin(i*Math.PI/5)*14:0);
    c.globalAlpha=fade;
    if(voidEffect&&i<5)crystal(c,x,y,8+n%3*3,14+n%4*10,Math.cos(a)*.42,false);
    else if(earth&&n%2)leaf(c,x,y,4+n%3,a+i*.15);
    else rock(c,x,y,3+n%3*2,a,voidEffect);
    c.globalAlpha=1;
  }
  if(i>=5)for(let n=0;n<8;n++){const a=n*2.399,x=96+Math.cos(a)*54,y=96+Math.sin(a)*35-8*(i-5);glow(c,x,y,11,earth?'154,143,93':voidEffect?'140,73,185':'140,108,91',fade*.28);}
}
export function paintReferenceEffect(c:CanvasRenderingContext2D,style:ReferenceEffectStyle,layer:'ground'|'motes',i:number):void {
  c.save();c.beginPath();c.arc(96,96,95,0,Math.PI*2);c.clip();
  if(layer==='motes')air(c,style,i);
  else if(style==='fire')fireGround(c,i);
  else if(style==='void')voidGround(c,i);
  else if(style==='earth')earthGround(c,i);
  else frostGround(c,i*Math.PI/4);
  c.restore();
}
export function paintReferenceWarning(c:CanvasRenderingContext2D,style:'earth'|'frost'):void {
  const color=style==='earth'?'rgba(203,244,136,.8)':'rgba(192,241,255,.85)';c.strokeStyle=color;c.lineWidth=1.7;c.beginPath();c.arc(96,96,86,0,Math.PI*2);c.stroke();
  if(style==='frost')snowflake(c,32,.85);
  else{c.beginPath();for(let n=0;n<6;n++){const a=n*Math.PI/3;c.moveTo(96,96);c.lineTo(96+Math.cos(a)*25,96+Math.sin(a)*25);}c.stroke();}
}
export function paintReferenceFall(c:CanvasRenderingContext2D,style:'fire'|'void'):void {
  const rgb=style==='fire'?'255,116,30':'183,78,255';const g=c.createLinearGradient(96,8,96,99);g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(1,`rgba(${rgb},.9)`);c.fillStyle=g;c.fillRect(92,8,8,91);glow(c,96,96,19,rgb,.65);rock(c,96,96,10,.2,style==='void');
}
