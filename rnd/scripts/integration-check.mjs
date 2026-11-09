import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Sequential browsers avoid competing for rendering/CPU and give each suite an isolated profile.
const suites=['browser-smoke','checkpoint-v2-browser','abilities-browser','facilities-browser',
  'identity-browser','legacy-browser','endless-browser','class-balance-browser'];
const requested=process.argv.slice(2);
if (requested.some(name=>!suites.includes(name))) {
  console.error(`Unknown suite. Choose from: ${suites.join(', ')}`); process.exit(1);
}
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const output='artifacts/integration';
await mkdir(output,{recursive:true});
const report={status:'running',startedAt:new Date().toISOString(),suites:[]};
const save=()=>writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');
let child;
let interrupted=false;
const stop=()=>{interrupted=true;child?.kill();};
process.once('SIGINT',stop); process.once('SIGTERM',stop);
try {
  // These suites import source modules through Vite and require a running development server.
  const url=process.env.SMASH_TEST_URL ?? 'http://127.0.0.1:5173/';
  report.testUrl=url; report.node=process.version;
  const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
  if (!response.ok || !(await response.text()).includes('/src/main.ts')) {
    throw new Error('Expected the game Vite development server. Start npm run dev or set SMASH_TEST_URL.');
  }
  await save();
  for (const name of requested.length?requested:suites) {
    if (interrupted) break;
    const row={name,status:'running',log:`${output}/${name}.log`};
    report.suites.push(row); await save();
    console.log(`RUN ${name}`);
    const start=Date.now(),log=createWriteStream(row.log);
    try {
      const exit=await new Promise((resolve,reject)=>{
        child=spawn(process.execPath,[`tests/${name}.mjs`],{
          env:{...process.env,SMASH_TEST_URL:url},windowsHide:true,stdio:['ignore','pipe','pipe']});
        child.stdout.pipe(log,{end:false}); child.stderr.pipe(log,{end:false});
        child.once('error',reject); child.once('close',(code,signal)=>resolve({code,signal}));
      });
      row.status=exit.code===0?'passed':'failed'; row.exitCode=exit.code; row.signal=exit.signal;
    } catch (error) { row.status='failed'; row.error=error.message; }
    finally { child=undefined; await new Promise(resolve=>log.end(resolve)); }
    row.durationMs=Date.now()-start; await save();
    console.log(`${row.status.toUpperCase()} ${name} (${row.durationMs}ms) · ${row.log}`);
    if (row.status!=='passed') { process.exitCode=1; break; }
  }
  report.status=interrupted?'interrupted':report.suites.some(row=>row.status!=='passed')?'failed':'passed';
} catch (error) {
  report.status='failed'; report.error=error.message; console.error(error); process.exitCode=1;
} finally {
  if (interrupted) process.exitCode=1;
  child?.kill();
  process.removeListener('SIGINT',stop); process.removeListener('SIGTERM',stop);
  report.finishedAt=new Date().toISOString(); await save();
  console.log(`${report.status.toUpperCase()} · ${output}/report.json`);
}
