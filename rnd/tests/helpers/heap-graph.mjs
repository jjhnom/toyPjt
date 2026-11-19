// Read the schema embedded in V8 snapshots rather than depending on field offsets.
export class HeapGraph {
 constructor(snapshot){
  this.data=snapshot;const meta=snapshot.snapshot.meta;
  this.nf=meta.node_fields;this.ef=meta.edge_fields;
  this.ns=this.nf.length;this.es=this.ef.length;
  this.n=Object.fromEntries(this.nf.map((name,i)=>[name,i]));this.e=Object.fromEntries(this.ef.map((name,i)=>[name,i]));
  this.nt=meta.node_types[this.n.type];this.et=meta.edge_types[this.e.type];
  this.count=snapshot.nodes.length/this.ns;
  this.edgeStart=new Uint32Array(this.count+1);
  for(let i=0;i<this.count;i++)this.edgeStart[i+1]=this.edgeStart[i]+snapshot.nodes[i*this.ns+this.n.edge_count]*this.es;
 }
 node(index){const {nodes,strings}=this.data,offset=index*this.ns;return{index,id:nodes[offset+this.n.id],type:this.nt[nodes[offset+this.n.type]],name:strings[nodes[offset+this.n.name]],selfBytes:nodes[offset+this.n.self_size]};}
 histogram(){const map=new Map();for(let i=0;i<this.count;i++){const node=this.node(i),key=node.type+':'+node.name;const value=map.get(key)??{type:node.type,name:node.name,count:0,selfBytes:0};value.count++;value.selfBytes+=node.selfBytes;map.set(key,value);}return map;}
 instances(names){const result=new Map(names.map(name=>[name,[]]));for(let i=0;i<this.count;i++){const node=this.node(i);if(node.type==='object'&&result.has(node.name))result.get(node.name).push(node);}return result;}
 // Shortest strong root path; weak edges must never establish ownership.
 rootPaths(targetIds){
  const {edges,strings}=this.data,parent=new Int32Array(this.count).fill(-1),parentEdge=new Int32Array(this.count).fill(-1),queue=new Uint32Array(this.count);
  let read=0,write=1;queue[0]=0;parent[0]=0;
  while(read<write){const source=queue[read++];for(let offset=this.edgeStart[source];offset<this.edgeStart[source+1];offset+=this.es){if(this.et[edges[offset+this.e.type]]==='weak')continue;const target=edges[offset+this.e.to_node]/this.ns;if(parent[target]!==-1)continue;parent[target]=source;parentEdge[target]=offset;queue[write++]=target;}}
  const paths=[];
  for(let i=0;i<this.count;i++){const node=this.node(i);if(!targetIds.has(node.id))continue;const path=[];let cursor=i;
   for(let depth=0;cursor!==0&&parent[cursor]!==-1&&depth<100;depth++){const offset=parentEdge[cursor],type=this.et[edges[offset+this.e.type]],raw=edges[offset+this.e.name_or_index];path.push({from:this.node(parent[cursor]).name,edge:type==='element'||type==='hidden'?raw:strings[raw],edgeType:type,to:this.node(cursor).name});cursor=parent[cursor];}
   paths.push({id:node.id,name:node.name,stronglyReachable:parent[i]!==-1,complete:cursor===0,path:path.reverse()});
  }
  return paths;
 }
}
