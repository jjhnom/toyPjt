import { UNIT_TYPES } from '../config/unitData';
import { BOSS_IDS, isBossId } from '../config/bossData';
import type { BossId, DroneArchetype } from '../types/game';
export const CODEX_KEY='smash.discovery-codex.v1';
type CodexStorage=Pick<Storage,'getItem'|'setItem'>;
type Status='ready'|'empty'|'invalid'|'unavailable';
const isUnit=(id:unknown):id is DroneArchetype=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(UNIT_TYPES,id);
function browserStorage():CodexStorage|null {try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}
export class CodexManager {
  private loaded=false;
  private status:Status='empty';
  private readonly units=new Set<DroneArchetype>();
  private readonly bosses=new Set<BossId>();
  private pending=false;
  private writable=false;
  constructor(private readonly storage:CodexStorage|null=browserStorage()){}
  private ensureLoaded():void {
    if(this.loaded)return;this.loaded=true;this.mergePersisted();
  }
  /** Re-read before a pending write so a stale page cannot replace newer known discoveries. */
  private mergePersisted():boolean {
    if(!this.storage){this.status='unavailable';return false;}
    let raw:string|null;
    try{raw=this.storage.getItem(CODEX_KEY);}catch{this.status='unavailable';return false;}
    this.writable=true;if(raw===null)return true;
    try {
      const data=JSON.parse(raw);
      if(!data||data.version!==1||!Array.isArray(data.units)||!Array.isArray(data.bosses)||
        data.units.length>Object.keys(UNIT_TYPES).length||data.bosses.length>BOSS_IDS.length||
        !data.units.every(isUnit)||!data.bosses.every(isBossId)||new Set(data.units).size!==data.units.length||
        new Set(data.bosses).size!==data.bosses.length){this.status='invalid';this.writable=false;return false;}
      data.units.forEach((id:DroneArchetype)=>this.units.add(id));data.bosses.forEach((id:BossId)=>this.bosses.add(id));this.status='ready';
      return true;
    }catch{this.status='invalid';this.writable=false;return false;}
  }
  public snapshot(){this.ensureLoaded();return {status:this.status,pending:this.pending,
    units:Object.keys(UNIT_TYPES).filter(id=>this.units.has(id as DroneArchetype)) as DroneArchetype[],bosses:BOSS_IDS.filter(id=>this.bosses.has(id))};}
  public recordUnits(ids:readonly DroneArchetype[]):boolean {
    this.ensureLoaded();if(!ids.every(isUnit))return false;
    for(const id of ids)if(!this.units.has(id)){this.units.add(id);this.pending=true;}
    return this.flush();
  }
  public recordBoss(id:BossId):boolean {
    this.ensureLoaded();if(!isBossId(id))return false;
    if(!this.bosses.has(id)){this.bosses.add(id);this.pending=true;}return this.flush();
  }
  public flush():boolean {
    this.ensureLoaded();if(!this.storage||this.status==='invalid')return false;
    if(!this.pending)return this.status!=='unavailable';
    if(!this.mergePersisted()||!this.writable)return false;
    try{const data=this.snapshot();this.storage.setItem(CODEX_KEY,JSON.stringify({version:1,units:data.units,bosses:data.bosses}));
      this.status='ready';this.pending=false;return true;}catch{this.status='unavailable';return false;}
  }
}
export const codexManager=new CodexManager();
