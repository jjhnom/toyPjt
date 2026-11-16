/** Cached 192px ice artwork. Combat radius/timing remain owned by EncounterHazards. */
function glow(c:CanvasRenderingContext2D,x:number,y:number,r:number,alpha:number):void {
  const g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(167,239,255,${alpha})`);g.addColorStop(1,'rgba(71,151,228,0)');
  c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function crystal(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,angle:number):void {
  c.save();c.translate(x,y);c.rotate(angle);
  c.fillStyle='#317fae';c.beginPath();c.moveTo(-w/2,0);c.lineTo(-w*.65,-h*.55);c.lineTo(0,-h);c.lineTo(w*.55,-h*.66);c.lineTo(w/2,0);c.closePath();c.fill();
  c.fillStyle='#9be9fb';c.beginPath();c.moveTo(0,-h);c.lineTo(w*.55,-h*.66);c.lineTo(w/2,0);c.lineTo(0,-h*.14);c.closePath();c.fill();
  c.fillStyle='#dbfcff';c.beginPath();c.moveTo(0,-h);c.lineTo(w*.55,-h*.66);c.lineTo(w*.2,-h*.4);c.closePath();c.fill();
  c.strokeStyle='#e5fcff';c.lineWidth=1.3;c.beginPath();c.moveTo(-w*.65,-h*.55);c.lineTo(0,-h);c.lineTo(w*.55,-h*.66);c.stroke();c.restore();
}
export function paintFrostQueen(c:CanvasRenderingContext2D,layer:'ground'|'motes'|'intro'|'release',index:number):void {
  c.save();c.beginPath();c.arc(96,96,93,0,Math.PI*2);c.clip();
  const phase=index*Math.PI/2;
  if(layer==='ground'||layer==='intro'){
    const spread=layer==='intro'?(index+1)/4:1;
    glow(c,96,96,92*spread,layer==='intro'?.25:.35);
    // Six branching veins spread across a translucent frozen lake, with an open center.
    c.save();c.beginPath();c.arc(96,96,88*spread,0,Math.PI*2);c.clip();
    c.strokeStyle='rgba(137,219,251,.42)';c.lineWidth=1.6;
    for(let n=0;n<6;n++){
      const a=n*Math.PI/3;c.save();c.translate(96,96);c.rotate(a);
      c.beginPath();c.moveTo(13,0);c.lineTo(40,3);c.lineTo(62,-2);c.lineTo(88,0);
      for(let d=28;d<85;d+=18)for(const s of [-1,1]){c.moveTo(d,0);c.lineTo(d+9,s*10);c.lineTo(d+12,s*18);}
      c.stroke();c.restore();
    }
    c.restore();
    c.lineWidth=1.5;c.strokeStyle='rgba(204,249,255,.65)';c.beginPath();c.arc(96,96,89*spread,0,Math.PI*2);c.stroke();
    if(layer==='ground')for(let n=0;n<12;n++){
      const a=n*Math.PI/6,x=96+Math.cos(a)*77,y=96+Math.sin(a)*77;
      glow(c,x,y,7,.18+.08*Math.sin(phase+n));
      c.fillStyle='rgba(220,253,255,.75)';c.fillRect(x-1,y-1,2,2);
    }
  }else if(layer==='motes'){
    const eruption=index<4,height=eruption?[.65,1.05,1.25,.8][index]:.36+.035*Math.sin(phase);
    glow(c,96,102,85,eruption?.8:.16);
    if(eruption){
      // A bright core, broad frozen rays and an oversized central spear give the burst a strong silhouette.
      const burst=[.85,1,.7,.25][index];
      c.strokeStyle=`rgba(189,245,255,${burst*.65})`;c.lineWidth=2.4;
      for(let n=0;n<18;n++){
        const a=n*Math.PI/9+.1,r=53+index*10;
        c.beginPath();c.moveTo(96+Math.cos(a)*22,96+Math.sin(a)*22);c.lineTo(96+Math.cos(a)*r,96+Math.sin(a)*r);c.stroke();
      }
      c.fillStyle=`rgba(225,253,255,${burst*.42})`;c.beginPath();c.ellipse(96,111,41,20,0,0,Math.PI*2);c.fill();
      crystal(c,80,120,20,58*height,-.23);
      crystal(c,112,120,22,64*height,.24);
      crystal(c,96,127,27,77*height,0);
    }
    // Back crystals precede front crystals so the crown reads as a three-dimensional object.
    for(let row=0;row<2;row++)for(let n=0;n<5;n++){
      const a=Math.PI+(n+.5)*Math.PI/5+row*Math.PI,x=96+Math.cos(a)*48,y=103+Math.sin(a)*27;
      crystal(c,x,y,(eruption?16:10)+n%2*5,(30+n%3*14)*height,Math.cos(a)*(eruption?.48:.3));
    }
    for(let n=0;n<10;n++){
      const a=n*2.399+phase*.12,r=32+n%4*13,x=96+Math.cos(a)*r,y=92+Math.sin(a)*r;
      c.globalAlpha=.4+.25*Math.sin(phase+n);c.fillStyle='#e0fcff';c.fillRect(x-1,y-1,2,2);
    }
  }else{
    const u=index/3;
    for(let n=0;n<24;n++){
      const a=n*2.399,r=25+u*43+n%3*5,x=96+Math.cos(a)*r,y=96+Math.sin(a)*r*.75-18*Math.sin(u*Math.PI);
      c.globalAlpha=(1-u*.85)*.8;
      c.strokeStyle='rgba(157,232,255,.55)';c.lineWidth=1.4;
      c.beginPath();c.moveTo(x-Math.cos(a)*(5+u*9),y-Math.sin(a)*(5+u*9));c.lineTo(x,y);c.stroke();
      crystal(c,x,y,6+n%3,11+n%4*3,a+u*1.2);
    }
    glow(c,96,96,75,.15*(1-u));
  }
  c.restore();
}
