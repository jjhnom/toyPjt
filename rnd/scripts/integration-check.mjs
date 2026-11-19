import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Sequential browsers avoid competing for rendering/CPU and give each suite an isolated profile.
const suites=['browser-smoke','checkpoint-v2-browser','abilities-browser','facilities-browser',
  'identity-browser','legacy-browser','endless-browser','class-balance-browser','boss-telegraph-browser','boss-audio-browser','audio-mix-browser','performance-browser','heap-snapshot-browser','full-load-browser'];
const args=process.argv.slice(2);
const serve=args.includes('--serve');
const requested=args.filter(arg=>arg!=='--serve');
if (requested.some(name=>!suites.includes(name))) {
  console.error(`Unknown suite. Choose from: ${suites.join(', ')}`); process.exit(1);
}
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const output='artifacts/integration';
await mkdir(output,{recursive:true});
const report={status:'running',startedAt:new Date().toISOString(),suites:[]};
const save=()=>writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');
let child;
let server;
let serverLog;
let interrupted=false;
const stop=()=>{interrupted=true;child?.kill();server?.kill();};
process.once('SIGINT',stop); process.once('SIGTERM',stop);
try {
  // These suites import source modules through Vite and require a running development server.
  const url=process.env.SMASH_TEST_URL ?? 'http://127.0.0.1:5173/';
  report.testUrl=url; report.node=process.version;
  const checkServer=async()=>{
    for(const [path,marker]of [[url,'/src/main.ts'],[new URL('src/main.ts',url),'new Phaser.Game']]){
      const response=await fetch(path,{signal:AbortSignal.timeout(5000)});
      if(!response.ok||!(await response.text()).includes(marker)){
        throw new Error(`Expected game Vite source at ${path}. Start npm run dev or use --serve.`);
      }
    }
  };
  if(serve){
    const target=new URL(url);
    if(!['127.0.0.1','localhost'].includes(target.hostname)||target.protocol!=='http:'||target.pathname!=='/'||target.search||target.username||target.password){
      throw new Error('--serve requires an HTTP localhost URL with root path.');
    }
    report.serverLog=`${output}/vite.log`;
    serverLog=createWriteStream(report.serverLog);
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host',target.hostname,
      '--port',target.port||'80','--strictPort'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    server.stdout.pipe(serverLog,{end:false});server.stderr.pipe(serverLog,{end:false});
    let serverError;
    let startupOutput='';
    server.stdout.on('data',data=>{startupOutput=(startupOutput+data).slice(-4096);});
    server.once('error',error=>{serverError=error;});
    const deadline=Date.now()+20000;
    while(true){
      if(interrupted)throw new Error('Integration run interrupted during server startup.');
      if(serverError)throw serverError;
      if(server.exitCode!==null)throw new Error(`Vite exited with code ${server.exitCode}; see ${report.serverLog}.`);
      if(!startupOutput.includes('Local:')){
        if(Date.now()>=deadline)throw new Error(`Vite startup timed out; see ${report.serverLog}.`);
        await new Promise(resolve=>setTimeout(resolve,150));continue;
      }
      try{await checkServer();break;}catch(error){
        if(Date.now()>=deadline)throw new Error(`Vite readiness failed: ${error.message}; see ${report.serverLog}.`);
        await new Promise(resolve=>setTimeout(resolve,150));
      }
    }
  }else{
    await checkServer();
  }
  await save();
  // Timed profiling runs alone so routine integration runs do not skew its baseline.
  for (const name of requested.length?requested:suites.filter(name=>!['performance-browser','heap-snapshot-browser','full-load-browser'].includes(name))) {
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
  server?.kill();
  if(serverLog){
    server?.stdout.unpipe(serverLog);server?.stderr.unpipe(serverLog);
    await new Promise(resolve=>serverLog.end(resolve));
  }
  process.removeListener('SIGINT',stop); process.removeListener('SIGTERM',stop);
  report.finishedAt=new Date().toISOString(); await save();
  console.log(`${report.status.toUpperCase()} · ${output}/report.json`);
}
