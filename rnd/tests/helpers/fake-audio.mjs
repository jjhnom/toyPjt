export const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
class Param {
 value=1;calls=[];
 setValueAtTime(value,time){this.value=value;this.calls.push(['set',value,time]);}
 linearRampToValueAtTime(value,time){this.value=value;this.calls.push(['linear',value,time]);}
 exponentialRampToValueAtTime(value,time){if(!Number.isFinite(value)||value<=0)throw Error('invalid exponential');this.value=value;this.calls.push(['exponential',value,time]);}
 cancelScheduledValues(time){this.calls.push(['cancel',time]);}
}
class Node {
 connections=[];disconnected=false;
 connect(node){this.connections.push(node);return node;}
 disconnect(){this.disconnected=true;this.connections=[];}
}
class Gain extends Node {gain=new Param();}
class Oscillator extends Node {
 frequency=new Param();onended=null;started=false;ended=false;stopAt=Infinity;type='sine';
 constructor(ctx){super();this.ctx=ctx;}
 start(time){if(this.ctx.failStart)throw Error('start failed');this.started=true;this.startAt=time;}
 stop(time=this.ctx.currentTime){this.stopAt=time;}
 end(){if(this.ended)return;this.ended=true;this.onended?.();}
}
export class FakeAudioContext {
 state='suspended';currentTime=0;destination={};onstatechange=null;gains=[];oscillators=[];resumeCalls=0;suspendCalls=0;closeCalls=0;
 createGain(){if(this.failGain)throw Error('gain unavailable');const g=new Gain();this.gains.push(g);return g;}
 createOscillator(){if(this.failOscillator)throw Error('oscillator unavailable');const o=new Oscillator(this);this.oscillators.push(o);return o;}
 changeState(state){this.state=state;this.onstatechange?.();}
 resume(){this.resumeCalls++;return this.resumeImpl?this.resumeImpl():Promise.resolve().then(()=>this.changeState('running'));}
 suspend(){this.suspendCalls++;return this.suspendImpl?this.suspendImpl():Promise.resolve().then(()=>this.changeState('suspended'));}
 close(){this.closeCalls++;this.changeState('closed');return this.closeImpl?this.closeImpl():Promise.resolve();}
 advance(ms){this.currentTime+=ms/1000;for(const o of this.oscillators)if(o.started&&!o.ended&&o.stopAt<=this.currentTime+1e-9)o.end();}
}
export const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
