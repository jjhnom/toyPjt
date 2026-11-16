/** Earliest segment/circle intersection, including starts inside. Infinity means no collision. */
export function segmentCircleEntry(x:number,y:number,endX:number,endY:number,cx:number,cy:number,radius:number):number {
  const ox=x-cx,oy=y-cy,c=ox*ox+oy*oy-radius*radius;
  if(c<=0)return 0;
  const dx=endX-x,dy=endY-y,a=dx*dx+dy*dy;
  if(a<1e-12)return Infinity;
  const b=ox*dx+oy*dy,d=b*b-a*c;
  if(d<0)return Infinity;
  const t=(-b-Math.sqrt(d))/a;
  return t>=0&&t<=1?t:Infinity;
}
