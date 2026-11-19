import {execFile} from 'node:child_process';
import {promisify,parseArgs} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const execute=promisify(execFile);

export function parseDevices(text){
 return text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('List of devices')&&!line.startsWith('*'))
  .map(line=>{const [serial,state,...details]=line.split(/\s+/);return {serial,state,details:details.join(' ')};});
}
export function selectDevice(devices,serial){
 if(serial){
  const selected=devices.find(device=>device.serial===serial);
  if(!selected||selected.state!=='device')throw new Error('지정 기기가 연결되지 않았거나 USB 디버깅 승인이 필요합니다.');
  return selected;
 }
 const ready=devices.filter(device=>device.state==='device');
 if(ready.length===0)throw new Error('사용 가능한 기기가 없습니다. USB 디버깅 연결 및 휴대폰의 허용 메시지를 확인하세요.');
 if(ready.length>1)throw new Error('여러 기기가 연결돼 있습니다. --serial로 검증할 기기를 지정하세요.');
 return ready[0];
}

async function main(){
 const {values}=parseArgs({options:{serial:{type:'string'},install:{type:'boolean',default:false},help:{type:'boolean',default:false}}});
 if(values.help){
  console.log('node scripts/android-device-check.mjs [--serial SERIAL] [--install]\n기본: 연결 기기만 확인. --install: 검증된 최신 APK를 데이터 유지(-r)로 설치하고 실행 증거 수집.');return;
 }
 const output=resolve(root,'artifacts/android-device-qa',new Date().toISOString().replace(/[:.]/g,'-'));
 await mkdir(output,{recursive:true});
 const report={status:'running',startedAt:new Date().toISOString(),installRequested:values.install,checks:[],
  manualChecks:{multitouch:'pending',homeAndLockResume:'pending',modalPause:'pending',statePreservation:'pending',audio:'pending'}};
 const adb=resolve(root,'artifacts/android-toolchain/sdk/platform-tools/adb.exe');
 const run=(args,options={})=>execute(adb,args,{windowsHide:true,timeout:30000,maxBuffer:16*1024*1024,encoding:'utf8',...options});
 try{
  const listed=await run(['devices','-l']);await writeFile(resolve(output,'devices.txt'),listed.stdout);
  report.devices=parseDevices(listed.stdout);
  let device;
  try{device=selectDevice(report.devices,values.serial);}catch(error){report.status='blocked';report.reason=error.message;process.exitCode=2;return;}
  report.device=device;
  const deviceRun=(args,options)=>run(['-s',device.serial,...args],options);
  const properties=await Promise.all(['ro.product.model','ro.build.version.release','ro.build.version.sdk'].map(name=>deviceRun(['shell','getprop',name])));
  report.deviceInfo={model:properties[0].stdout.trim(),android:properties[1].stdout.trim(),sdk:properties[2].stdout.trim()};
  await writeFile(resolve(output,'display.txt'),(await deviceRun(['shell','wm','size'])).stdout);
  report.checks.push('device-info');
  if(!values.install){report.status='device-ready';return;}

  const apk=resolve(root,'artifacts/apk/summoners-expedition-input-fix-20261118-debug.apk');
  const expected=JSON.parse((await readFile(resolve(root,'artifacts/apk-validation-20261118/asset-verification.json'),'utf8')).replace(/^\uFEFF/,''));
  const hash=createHash('sha256').update(await readFile(apk)).digest('hex');
  if(hash!==expected.apkSha256)throw new Error('APK 해시가 빌드 검증 기록과 다릅니다. 설치를 중단합니다.');
  report.apkSha256=hash;
  const installed=await deviceRun(['install','-r',apk],{timeout:120000});
  await writeFile(resolve(output,'install.txt'),installed.stdout+installed.stderr);
  if(!installed.stdout.includes('Success'))throw new Error('APK 설치 성공 응답을 확인하지 못했습니다. 앱 삭제나 데이터 초기화는 수행하지 않습니다.');
  report.checks.push('install');
  const packageName='com.yourstudio.smashroguelike';
  const launched=await deviceRun(['shell','am','start','-W','-n',`${packageName}/.MainActivity`]);
  await writeFile(resolve(output,'launch.txt'),launched.stdout+launched.stderr);
  if(!/Status:\s*ok/.test(launched.stdout))throw new Error('Activity 실행 성공 응답을 확인하지 못했습니다.');
  report.checks.push('activity-launch');
  const activities=(await deviceRun(['shell','dumpsys','activity','activities'])).stdout;
  const resumed=activities.split(/\r?\n/).filter(line=>/mResumedActivity|topResumedActivity/.test(line));
  if(!resumed.some(line=>line.includes(packageName+'/')))throw new Error('검증 앱이 전면에 있지 않아 화면 수집을 중단합니다. 기기 잠금을 해제하고 다시 실행하세요.');
  const pid=(await deviceRun(['shell','pidof',packageName])).stdout.trim().split(/\s+/)[0];
  if(!/^\d+$/.test(pid))throw new Error('실행 중인 앱 프로세스를 확인하지 못했습니다.');
  report.pid=pid;
  const screenshot=await deviceRun(['exec-out','screencap','-p'],{encoding:null});
  if(!screenshot.stdout.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('PNG 화면 캡처가 올바르지 않습니다.');
  await writeFile(resolve(output,'launch.png'),screenshot.stdout);
  const log=await deviceRun(['logcat','--pid',pid,'-d','-t','500','-v','threadtime']);
  await writeFile(resolve(output,'app-logcat.txt'),log.stdout);
  report.checks.push('launch-evidence');report.status='manual-qa-required';
 }catch(error){report.status='failed';report.reason=error.message;process.exitCode=1;}
 finally{
  report.finishedAt=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,reason:report.reason,output,checks:report.checks},null,2));
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
