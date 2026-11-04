// Generate the app's simple flower mark without external graphics dependencies.
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
function crc32(bytes) { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
function chunk(name, data) { const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([length, type, data, crc]); }
const root = new URL('../icons/', import.meta.url); await mkdir(root, { recursive: true });
for (const [name, size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) {
  const pixels = Buffer.alloc((size*4+1)*size);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const px = (x+.5)/size-.5, py = (y+.5)/size-.5;
    let rgb = [71,105,78];
    for(let i=0;i<5;i++){ const a=i*Math.PI*2/5-Math.PI/2; if(Math.hypot(px-Math.cos(a)*.16,py-Math.sin(a)*.16)<.12) rgb=[250,220,224]; }
    if(Math.hypot(px,py)<.09) rgb=[244,214,116];
    const p=y*(size*4+1)+1+x*4; pixels[p]=rgb[0];pixels[p+1]=rgb[1];pixels[p+2]=rgb[2];pixels[p+3]=255;
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  await writeFile(new URL(name,root),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
}
