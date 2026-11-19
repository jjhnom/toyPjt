import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from '../tests/helpers/browser-session.mjs';

const browser=await browserSession();
try{
 const result=await browser.evaluate(`(()=>{const gl=smash.renderer.gl,ext=gl?.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,webgl:!!gl};})()`);
 result.hardwareVerified=!!result.renderer&&!/swiftshader|llvmpipe|software|basic render|warp/i.test(result.renderer);
 await mkdir('artifacts/performance-hardware-20261119',{recursive:true});
 await writeFile('artifacts/performance-hardware-20261119/gpu-probe.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
 if(!result.hardwareVerified)process.exitCode=1;
}finally{browser.close();}
