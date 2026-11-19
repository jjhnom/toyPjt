import test from 'node:test';
import assert from 'node:assert/strict';
import {HeapGraph} from './helpers/heap-graph.mjs';

// Permuted fields ensure parsing uses snapshot metadata, not fixed V8 offsets.
function graph(){
 const strings=['root','WeakRef','Victim','Holder','weakTarget','owner','value'];
 return new HeapGraph({snapshot:{meta:{node_fields:['name','self_size','type','edge_count','id'],node_types:['string','number',['synthetic','object'],'number','number'],edge_fields:['to_node','name_or_index','type'],edge_types:['node','string',['property','weak']]}},strings,
  nodes:[0,0,0,2,1, 1,16,1,1,3, 2,32,1,0,5, 3,24,1,1,7],
  edges:[5,5,0, 15,5,0, 10,4,1, 10,6,0]});
}
test('heap graph distinguishes shallow totals and object identities through metadata',()=>{
 const heap=graph();assert.equal(heap.histogram().get('object:Victim').selfBytes,32);
 assert.equal(heap.instances(['Victim']).get('Victim')[0].id,5);
 assert.equal(heap.count,4);
});
test('root paths ignore weak references and follow a strong owner',()=>{
 const paths=graph().rootPaths(new Set([5]));assert.equal(paths.length,1);
 assert.equal(paths[0].stronglyReachable,true);assert.equal(paths[0].complete,true);
 assert.deepEqual(paths[0].path.map(edge=>edge.from),['root','Holder']);
 assert.deepEqual(paths[0].path.map(edge=>edge.edge),['owner','value']);
});
