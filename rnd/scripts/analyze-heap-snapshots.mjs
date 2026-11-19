import {readFile,writeFile} from 'node:fs/promises';
import {analyzeHeapCheckpoints} from '../tests/helpers/analyze-heap.mjs';
const path='artifacts/heap-snapshot-20261119/report.json';
const report=JSON.parse(await readFile(path,'utf8'));
const names=[...new Set([...Object.keys(report.analysis.summaries[0].tracked),'Text2','CanvasTexture2','TextureManager2'])];
report.analysis=await analyzeHeapCheckpoints(report.checkpoints,names);
await writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checkpoints:report.checkpoints.length,growthPaths:report.analysis.growth.map(row=>row.exampleNewObjectPaths.length)}));
