import {readFile} from 'node:fs/promises';
import {HeapGraph} from './heap-graph.mjs';

export async function analyzeHeapCheckpoints(checkpoints,names){
 const summaries=[],growth=[];let baselineHistogram,baselineInstances,baselineIds;
 for(const checkpoint of checkpoints){
  const graph=new HeapGraph(JSON.parse(await readFile(checkpoint.file,'utf8'))),hist=graph.histogram(),tracked=graph.instances(names);
  const totalsByType={};for(const value of hist.values()){const row=totalsByType[value.type]??={count:0,selfBytes:0};row.count+=value.count;row.selfBytes+=value.selfBytes;}
  summaries.push({label:checkpoint.label,nodes:graph.count,totalSelfBytes:[...hist.values()].reduce((n,v)=>n+v.selfBytes,0),totalsByType,tracked:Object.fromEntries([...tracked].map(([name,nodes])=>[name,{count:nodes.length,selfBytes:nodes.reduce((n,v)=>n+v.selfBytes,0)}]))});
  if(!baselineHistogram){baselineHistogram=hist;baselineInstances=tracked;baselineIds=new Set();for(let i=0;i<graph.count;i++)baselineIds.add(graph.node(i).id);continue;}
  // Scenes are reused; inactive UI and shared textures legitimately survive a restart.
  const persistentNames=new Set(['GameScene','Text2','CanvasTexture2','TextureManager2']);
  const oldIds=new Set([...baselineInstances].filter(([name])=>!persistentNames.has(name)).flatMap(([,nodes])=>nodes.map(n=>n.id)));
  checkpoint.baselineSurvivorPaths=graph.rootPaths(oldIds);
  const topSelfGrowth=[...hist].map(([key,value])=>({...value,countDelta:value.count-(baselineHistogram.get(key)?.count??0),selfBytesDelta:value.selfBytes-(baselineHistogram.get(key)?.selfBytes??0)})).filter(row=>row.selfBytesDelta>0).sort((a,b)=>b.selfBytesDelta-a.selfBytesDelta).slice(0,30);
  const keys=new Set(topSelfGrowth.slice(0,10).map(row=>row.type+':'+row.name)),examples=new Set();
  for(let i=0;i<graph.count&&keys.size;i++){const node=graph.node(i),key=node.type+':'+node.name;if(keys.has(key)&&!baselineIds.has(node.id)){examples.add(node.id);keys.delete(key);}}
  growth.push({label:checkpoint.label,topSelfGrowth,exampleNewObjectPaths:graph.rootPaths(examples)});
 }
 return{summaries,growth};
}
