import Phaser from 'phaser';
import {legacyProfile} from '../systems/LegacyProfile';
import {HERO_CLASSES,HERO_CLASS_IDS,PERMANENT_UPGRADES} from '../config/heroClassData';
import {FANTASY,fantasyButton,pixelPanel} from '../ui/fantasyTheme';

export class LegacyScene extends Phaser.Scene {
  private tab:'classes'|'growth'='classes';
  private message='효과와 클래스는 다음 새 모험에 적용 · 이어하기는 유지';
  private closed=false;
  constructor(){super('LegacyScene');}
  public create():void {this.input.enabled=true;this.tab='classes';this.closed=false;legacyProfile.flush();this.message='효과와 클래스는 다음 새 모험에 적용 · 이어하기는 유지';
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.scene.stop('CodexScene'));this.render();}
  private text(x:number,y:number,value:string,size=20,color=FANTASY.cream){return this.add.text(x,y,value,
    {fontFamily:FANTASY.font,fontSize:`${size}px`,resolution:2,color,wordWrap:{width:584}});}
  private transact(action:()=>boolean,success:string):void {
    if(this.closed)return;this.input.enabled=false;
    this.message=action()?success:'저장/잔액/견적이 바뀌었습니다 · 원본을 유지했습니다.';this.render();this.input.enabled=true;
  }
  private render():void {
    this.children.removeAll(true);const state=legacyProfile.snapshot(),p=state.profile,ready=state.status==='ready';
    this.add.rectangle(360,640,720,1280,0x080c16,0.98).setInteractive();pixelPanel(this,24,28,672,166,FANTASY.panel,FANTASY.gold);
    this.text(48,48,'영혼의 야영지',31);
    this.text(48,100,`영혼 조각 ${p.shards} · 지급 대기 ${state.pending*3}`,23,'#cfb7ff').setName('legacy-balance');
    this.text(48,145,!ready?'영구 기록 읽기 실패 · 기존 데이터 보존/변경 불가'
      :state.pending?'보상 저장 대기 · 재시도하세요. 저장 전 앱 종료 시 유실 가능':this.message,15,'#d9c287').setName('legacy-status');
    (['classes','growth'] as const).forEach((tab,i)=>fantasyButton(this,195+i*330,235,300,54,
      `${this.tab===tab?'● ':''}${tab==='classes'?'클래스 선택':'영구 성장'}`,()=>{this.tab=tab;this.render();},{fontSize:24,selected:this.tab===tab}).setName(`legacy-${tab}`));
    if(this.tab==='classes')HERO_CLASS_IDS.forEach((id,i)=>{
      const hero=HERO_CLASSES[id],y=300+i*222,selected=p.selectedClass===id,mastery=p.receipts.filter(r=>r.startsWith(`${id}:`)).length;
      pixelPanel(this,36,y,648,204);this.add.image(88,y+47,'spr_player_leader',0).setDisplaySize(66,66).setTint(hero.color);
      this.text(140,y+18,`${hero.name} · 숙련 ${mastery}/5`,26).setName(`class-name-${id}`);
      this.text(140,y+57,`기본 HP ${hero.baseHp} / 공격 ${hero.baseDamage} / 사거리 ${hero.range}`,17,'#b6c0c8');
      this.text(60,y+98,hero.description,18,'#cfb7ff').setWordWrapWidth(580);
      fantasyButton(this,360,y+159,568,50,selected?'선택됨 · 다음 새 모험':`${hero.name} 선택`,()=>{
        this.transact(()=>legacyProfile.selectClass(id,p.revision),`${hero.name} 선택 · 이어하기 클래스는 바뀌지 않습니다.`);
      },{enabled:ready&&!selected,fontSize:22,primary:selected}).setName(`class-select-${id}`);
    });
    else (['vitality','power'] as const).forEach((id,i)=>{
      const y=320+i*263,def=PERMANENT_UPGRADES[id],quote=legacyProfile.quote(id);pixelPanel(this,36,y,648,235);
      this.text(60,y+24,`${def.name} ${p.ranks[id]}/5`,27).setName(`permanent-level-${id}`);
      this.text(60,y+81,def.description,21,'#cfb7ff');
      fantasyButton(this,360,y+175,568,54,quote?`${quote.cost} 조각 · 영구 성장`:'최대 성장',()=>{
        if(quote)this.transact(()=>legacyProfile.buy(quote),'성장 저장 완료 · 다음 새 모험부터 적용합니다.');
      },{enabled:ready&&!!quote&&p.shards>=quote.cost,fontSize:24,primary:true}).setName(`permanent-buy-${id}`);
    });
    this.text(48,1000,'클래스별 첫 스토리 보스 토벌마다 +3조각 · 총45\n동일 클래스 재처치/무한 반복 보상 없음 · 숙련은 기록',17,'#d9c287').setLineSpacing(9);
    fantasyButton(this,195,1100,300,54,'저장·지급 재시도',()=>{this.transact(()=>legacyProfile.flush(),'미지급 보상 저장을 재시도했습니다.');},
      {enabled:ready,fontSize:21}).setName('legacy-retry');
    fantasyButton(this,525,1100,300,54,'도감 보기',()=>{if(!this.closed&&!this.scene.isActive('CodexScene'))this.scene.launch('CodexScene');},
      {fontSize:23}).setName('legacy-codex');
    fantasyButton(this,360,1180,600,60,'야영지 닫기',()=>{if(this.closed)return;this.closed=true;this.input.enabled=false;this.scene.stop();
      this.scene.get('MenuScene').events.emit('legacy-changed');},{fontSize:24,primary:true}).setName('legacy-close');
  }
}
