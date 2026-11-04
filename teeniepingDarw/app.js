const $ = s => document.querySelector(s);
const canvas = $('#canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
const makeCanvas = () => document.createElement('canvas');
const outline = makeCanvas(), paint = makeCanvas();
const ink = outline.getContext('2d', { willReadFrequently: true }), brush = paint.getContext('2d', { willReadFrequently: true });
let seasons = [], loadVersion = 0;
async function loadOutline(url, name) {
  const version = ++loadVersion;
  const img = new Image(); img.src = url; await img.decode();
  if (version !== loadVersion) return false;
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  setup(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
  ink.drawImage(img, 0, 0, outline.width, outline.height); cacheBoundary(); render();
  $('#filename').textContent = name; $('#sample-tag').hidden = true;
  $('#status').textContent = '도안을 불러왔어요! 원하는 색으로 칠해보세요.';
  return true;
}
function showTemplates() {
  const season = seasons.find(item => item.name === $('#season').value);
  $('#templates').replaceChildren();
  $('#library-status').textContent = season ? (season.images.length ? `${season.images.length}개의 도안 · 선택하면 새로 색칠해요` : '이 시즌에는 아직 도안이 없어요.') : '시즌 폴더에 도안을 넣고 새로고침을 눌러주세요.';
  for (const image of season?.images || []) {
    const button = document.createElement('button'); button.className = 'template'; button.type = 'button'; button.setAttribute('aria-pressed', 'false');
    const preview = document.createElement('img'); preview.src = image.url; preview.alt = ''; preview.loading = 'lazy';
    const label = document.createElement('span'); label.textContent = image.name;
    button.append(preview, label);
    button.onclick = async () => {
      try { if (!await loadOutline(image.url, image.name)) return; document.querySelectorAll('.template').forEach(b => b.setAttribute('aria-pressed', b === button ? 'true' : 'false')); }
      catch { $('#status').textContent = '도안을 열 수 없어요. 목록을 새로고침해주세요.'; }
    };
    $('#templates').append(button);
  }
}
async function refreshLibrary() {
  const refresh = $('#refresh-library'); refresh.disabled = true;
  const previous = $('#season').value;
  try {
    if (globalThis.__BUNDLED_TEMPLATES__) {
      seasons = globalThis.__BUNDLED_TEMPLATES__;
    } else {
      const response = await fetch('/api/templates', { cache: 'no-store' });
      if (!response.ok) throw new Error('Catalog unavailable');
      ({ seasons } = await response.json());
    }
    $('#season').replaceChildren();
    for (const season of seasons) { const option = document.createElement('option'); option.value = season.name; option.textContent = season.name; $('#season').append(option); }
    if (!seasons.length) { const option = document.createElement('option'); option.textContent = '등록된 시즌이 없어요'; $('#season').append(option); }
    if (seasons.some(s => s.name === previous)) $('#season').value = previous;
    $('#season').disabled = !seasons.length; showTemplates();
  } catch { $('#library-status').textContent = '목록을 불러오지 못했어요. 새로고침을 눌러주세요.'; }
  finally { refresh.disabled = false; }
}
$('#season').onchange = showTemplates;
$('#refresh-library').onclick = refreshLibrary;
let color = '#f58fa6', tool = 'fill', drawing = false, last, history = [], future = [], boundary;
const colors = ['#f58fa6','#f4b38d','#f4d674','#a9c79d','#93c8cc','#a6b4d6','#d4b0d4','#e85e69','#e8a153','#88a966','#58a9b3','#7d88b6','#b18abe','#855d53','#e9d6bb','#c9c9c4','#555c60','#ffffff'];
colors.forEach(c => { const b = document.createElement('button'); b.className = 'swatch'; b.style.background = c; b.dataset.color = c; b.setAttribute('aria-label', `색상 ${c}`); b.onclick = () => selectColor(c); $('#palette').append(b); });
function selectColor(c) { color = c; $('#custom').value = c; $('#hex').textContent = c.toUpperCase(); document.querySelectorAll('.swatch').forEach(b => { b.classList.toggle('selected', b.dataset.color === c); b.setAttribute('aria-pressed', b.dataset.color === c); }); }
selectColor(color);
$('#custom').oninput = e => selectColor(e.target.value);
document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { tool = b.dataset.tool; document.querySelectorAll('[data-tool]').forEach(t => { t.classList.toggle('active', t === b); t.setAttribute('aria-pressed', t === b); }); $('#size').disabled = tool !== 'brush'; $('#status').textContent = { fill:'색칠할 빈 공간을 눌러보세요.', brush:'드래그해서 원하는 색으로 칠해보세요.', eraser:'지울 영역을 누르면 영역 전체의 색칠이 지워집니다. 도안의 선은 유지됩니다.' }[tool]; });
$('#size').disabled = tool !== 'brush';
$('#size').oninput = e => $('#size-value').value = `${e.target.value}px`;
function render() { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(paint, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(outline, 0, 0); ctx.globalCompositeOperation = 'source-over'; }
function controls() { $('#undo').disabled = !history.length; $('#redo').disabled = !future.length; }
function snapshot() { history.push(brush.getImageData(0, 0, paint.width, paint.height)); const limit = Math.max(1, Math.min(16, Math.floor(24 * 1024 * 1024 / (paint.width * paint.height * 4)))); while (history.length > limit) history.shift(); future = []; controls(); }
function restore(from, to) { if (!from.length) return; to.push(brush.getImageData(0, 0, paint.width, paint.height)); brush.putImageData(from.pop(), 0, 0); render(); controls(); }
$('#undo').onclick = () => restore(history, future);
$('#redo').onclick = () => restore(future, history);
$('#reset').onclick = () => { snapshot(); brush.clearRect(0, 0, paint.width, paint.height); render(); $('#status').textContent = '다시 새롭게 색칠해보세요.'; };
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? restore(future, history) : restore(history, future); } });
function setup(w, h) { [canvas, outline, paint].forEach(c => { c.width = w; c.height = h; }); ink.fillStyle = '#fff'; ink.fillRect(0, 0, w, h); history = []; future = []; controls(); }
function cacheBoundary() { const pixels = ink.getImageData(0, 0, outline.width, outline.height).data; boundary = new Uint8Array(outline.width * outline.height); for (let i = 0; i < boundary.length; i++) boundary[i] = (pixels[i*4] * .299 + pixels[i*4+1] * .587 + pixels[i*4+2] * .114) < 185 ? 1 : 0; }
function fill(x, y, erase = false) {
  const w = canvas.width, h = canvas.height, start = y*w+x;
  if (boundary[start]) return;
  snapshot();
  const data = brush.getImageData(0, 0, w, h), seen = new Uint8Array(w*h), stack = new Int32Array(w*h);
  const rgb = [1,3,5].map(i => parseInt(color.slice(i,i+2),16));
  let count = 1; stack[0] = start; seen[start] = 1;
  while (count) { const p = stack[--count], offset = p*4; data.data[offset] = erase ? 0 : rgb[0]; data.data[offset+1] = erase ? 0 : rgb[1]; data.data[offset+2] = erase ? 0 : rgb[2]; data.data[offset+3] = erase ? 0 : 255;
    const px = p%w;
    const add = n => { if (!seen[n] && !boundary[n]) { seen[n] = 1; stack[count++] = n; } };
    if (px > 0) add(p-1); if (px < w-1) add(p+1); if (p >= w) add(p-w); if (p < w*(h-1)) add(p+w);
  }
  brush.putImageData(data, 0, 0); render();
}
function point(e) { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(canvas.width-1, Math.floor((e.clientX-r.left)*canvas.width/r.width))), y: Math.max(0, Math.min(canvas.height-1, Math.floor((e.clientY-r.top)*canvas.height/r.height))) }; }
function stroke(a,b) { brush.globalCompositeOperation = 'source-over'; brush.strokeStyle = color; brush.fillStyle = color; brush.lineWidth = Number($('#size').value); brush.lineCap = 'round'; brush.lineJoin = 'round'; brush.beginPath(); brush.moveTo(a.x,a.y); brush.lineTo(b.x,b.y); brush.stroke(); brush.beginPath(); brush.arc(b.x,b.y,brush.lineWidth/2,0,Math.PI*2); brush.fill(); render(); }
canvas.onpointerdown = e => { if (e.button !== 0 || drawing) return; const p = point(e); if (tool === 'fill' || tool === 'eraser') { fill(p.x,p.y,tool === 'eraser'); return; } snapshot(); drawing = true; last = p; canvas.setPointerCapture(e.pointerId); stroke(p,p); };
canvas.onpointermove = e => { if (!drawing) return; const p = point(e); stroke(last,p); last = p; };
canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = () => drawing = false;
async function upload(file) {
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { $('#status').textContent = 'PNG, JPG, WEBP 이미지를 선택해주세요.'; return; }
  if (file.size > 15*1024*1024) { $('#status').textContent = '15MB 이하의 이미지를 선택해주세요.'; return; }
  const url = URL.createObjectURL(file);
  try { if (await loadOutline(url, file.name)) document.querySelectorAll('.template').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  catch { $('#status').textContent = '이미지를 열 수 없어요. 다른 파일을 선택해주세요.'; }
  finally { URL.revokeObjectURL(url); const input = $('#upload'); if (input) input.value = ''; }
}
const uploadInput = $('#upload');
if (uploadInput) uploadInput.onchange = e => upload(e.target.files[0]);
const drop = $('#drop');
if (drop) {
  ['dragenter','dragover'].forEach(type => drop.addEventListener(type,e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(type => drop.addEventListener(type,e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => upload(e.dataTransfer.files[0]));
}
$('#save').onclick = async () => {
  if (globalThis.saveNativeDrawing) {
    try { await globalThis.saveNativeDrawing(canvas); $('#status').textContent = '공유 메뉴에서 그림 저장 또는 보내기를 선택해주세요.'; }
    catch { $('#status').textContent = '저장을 완료하지 못했어요. 그림 저장을 눌러 다시 시도해주세요.'; }
    return;
  }
  canvas.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = '나의-컬러링.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); $('#status').textContent = '색칠한 그림을 PNG 이미지로 저장했어요.'; });
};
function sample() {
  setup(800,900); ink.strokeStyle = '#41483f'; ink.lineWidth = 4; ink.lineJoin = 'round'; ink.lineCap = 'round';
  const path = d => ink.stroke(new Path2D(d));
  const ellipse = (x,y,rx,ry) => { ink.beginPath(); ink.ellipse(x,y,rx,ry,0,0,Math.PI*2); ink.fillStyle='#fff'; ink.fill(); ink.stroke(); };
  // Original flower fairy practice drawing, made with canvas paths.
  path('M160 755 Q400 705 640 755 M110 795 Q400 760 690 795');
  path('M330 503 Q177 365 159 473 Q123 562 309 578 M470 503 Q623 365 641 473 Q677 562 491 578');
  path('M317 548 Q241 558 207 632 Q285 656 345 589 M483 548 Q559 558 593 632 Q515 656 455 589');
  path('M363 683 L350 746 Q320 763 321 775 Q357 787 383 764 L394 687 M437 683 L450 746 Q480 763 479 775 Q443 787 417 764 L406 687');
  path('M352 497 Q315 559 278 667 Q328 703 400 688 Q472 703 522 667 Q485 559 448 497 Z');
  path('M352 497 Q400 552 448 497 M323 572 Q400 605 477 572 M355 597 L336 675 M400 606 L400 686 M445 597 L464 675');
  path('M344 509 Q317 528 294 559 L260 545 Q244 550 254 565 L292 587 Q310 580 331 558 M456 509 Q483 528 506 559 L540 545 Q556 550 546 565 L508 587 Q490 580 469 558');
  ellipse(400,365,123,139);
  path('M285 379 Q257 256 324 241 Q397 172 471 241 Q544 257 515 379 Q479 343 467 287 Q407 352 297 337 M300 393 Q274 440 295 483 Q251 475 251 442 Q237 397 278 350 M500 393 Q526 440 505 483 Q549 475 549 442 Q563 397 522 350');
  ellipse(354,385,8,14); ellipse(446,385,8,14); path('M377 430 Q400 448 423 430 M333 415 L349 418 M451 418 L467 415');
  path('M326 240 L307 191 L362 210 L400 160 L438 210 L493 191 L474 240 Z');
  ellipse(400,213,10,14);
  const flower = (x,y,s) => { ink.save(); ink.translate(x,y); ink.scale(s,s); for(let i=0;i<5;i++){ink.save();ink.rotate(i*Math.PI*2/5);ellipse(0,-23,14,21);ink.restore();} ellipse(0,0,12,12);ink.restore(); };
  path('M154 754 Q155 688 135 669 M643 754 Q648 680 668 657'); flower(130,645,.9); flower(672,632,1.1);
  path('M153 723 Q108 729 106 697 Q139 691 153 723 M650 709 Q692 710 700 678 Q663 673 650 709');
  flower(334,262,.65);
  ['M164 293 L170 276 L176 293 L193 299 L176 305 L170 322 L164 305 L147 299 Z','M621 333 L627 316 L633 333 L650 339 L633 345 L627 362 L621 345 L604 339 Z','M563 192 L568 179 L573 192 L586 197 L573 202 L568 215 L563 202 L550 197 Z'].forEach(path);
  cacheBoundary(); render();
}
sample();
refreshLibrary();
