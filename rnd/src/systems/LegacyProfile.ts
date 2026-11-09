import { BOSS_IDS } from '../config/bossData';
import { HERO_CLASS_IDS, isHeroClassId, emptyPermanentRanks, isPermanentRanks } from '../config/heroClassData';
import type { HeroClassId, PermanentRanks, PermanentId, PermanentQuote } from '../types/game';
export const LEGACY_KEY='smash.legacy-profile.v1';
export const SOULS_PER_FIRST_BOSS=3;
type ProfileStorage=Pick<Storage,'getItem'|'setItem'>;
interface Profile {version:1;revision:number;shards:number;selectedClass:HeroClassId;ranks:PermanentRanks;receipts:string[]}
const receiptIds=new Set(HERO_CLASS_IDS.flatMap(id=>BOSS_IDS.map(boss=>`${id}:${boss}`)));
const fresh=():Profile=>({version:1,revision:0,shards:0,selectedClass:'APPRENTICE_SUMMONER',ranks:emptyPermanentRanks(),receipts:[]});
const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
export function isLegacyProfile(value:unknown):value is Profile {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const p=value as Profile;
  if(p.version!==1||!integer(p.revision)||p.revision>=Number.MAX_SAFE_INTEGER||!integer(p.shards)||!isHeroClassId(p.selectedClass)||
    !isPermanentRanks(p.ranks)||!Array.isArray(p.receipts)||p.receipts.length>receiptIds.size||
    !p.receipts.every(id=>typeof id==='string'&&receiptIds.has(id))||new Set(p.receipts).size!==p.receipts.length)return false;
  const spent=(p.ranks.vitality*(p.ranks.vitality+1)+p.ranks.power*(p.ranks.power+1))/2;
  return p.shards===p.receipts.length*SOULS_PER_FIRST_BOSS-spent;
}
function browserStorage():ProfileStorage|null {try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}
/** One atomic profile write commits both receipt IDs and spendable currency. */
export class LegacyProfile {
  private readonly pending=new Set<string>();
  constructor(private readonly storage:ProfileStorage|null=browserStorage()){}
  public snapshot(){
    if(!this.storage)return {status:'unavailable' as const,profile:fresh(),pending:this.pending.size};
    try{const raw=this.storage.getItem(LEGACY_KEY);if(raw===null)return {status:'ready' as const,profile:fresh(),pending:this.pending.size};
      let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return {status:'invalid' as const,profile:fresh(),pending:this.pending.size};}
      if(!isLegacyProfile(parsed))return {status:'invalid' as const,profile:fresh(),pending:this.pending.size};
      return {status:'ready' as const,profile:parsed,pending:[...this.pending].filter(id=>!parsed.receipts.includes(id)).length};
    }catch{return {status:'unavailable' as const,profile:fresh(),pending:this.pending.size};}
  }
  private write(p:Profile):boolean {try{if(!this.storage||!isLegacyProfile(p))return false;
    this.storage.setItem(LEGACY_KEY,JSON.stringify(p));return true;}catch{return false;}}
  public flush():boolean {
    const state=this.snapshot();if(state.status!=='ready')return false;
    const p=state.profile,added=[...this.pending].filter(id=>!p.receipts.includes(id));
    if(added.length&& !this.write({...p,revision:p.revision+1,receipts:[...p.receipts,...added],shards:p.shards+added.length*SOULS_PER_FIRST_BOSS}))return false;
    this.pending.clear();return true;
  }
  public recordBosses(classId:HeroClassId,bosses:number):boolean {
    if(!isHeroClassId(classId)||!integer(bosses)||bosses>1000)return false;
    for(const boss of BOSS_IDS.slice(0,Math.min(bosses,5)))this.pending.add(`${classId}:${boss}`);
    return this.flush();
  }
  public quote(id:PermanentId):PermanentQuote|null {
    const s=this.snapshot();if(s.status!=='ready'||!['vitality','power'].includes(id))return null;
    const level=s.profile.ranks[id];return level>=5?null:{id,level,cost:level+1,revision:s.profile.revision};
  }
  public buy(quote:PermanentQuote):boolean {
    if(!quote)return false;const current=this.quote(quote.id),s=this.snapshot();
    if(!current||s.status!=='ready'||quote.revision!==current.revision||quote.revision!==s.profile.revision||quote.level!==current.level||quote.cost!==current.cost||s.profile.shards<current.cost)return false;
    return this.write({...s.profile,revision:s.profile.revision+1,shards:s.profile.shards-current.cost,
      ranks:{...s.profile.ranks,[current.id]:current.level+1}});
  }
  public selectClass(id:HeroClassId,expectedRevision:number):boolean {
    const s=this.snapshot();if(!isHeroClassId(id)||s.status!=='ready'||s.profile.revision!==expectedRevision)return false;
    if(s.profile.selectedClass===id)return true;
    return this.write({...s.profile,revision:s.profile.revision+1,selectedClass:id});
  }
}
export const legacyProfile=new LegacyProfile();
