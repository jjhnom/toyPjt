import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { soundManager } from '../systems/SoundManager';
import { FANTASY, pixelPanel, fantasyButton } from '../ui/fantasyTheme';
import { lobbyCharacterPortrait } from '../ui/lobbyCharacters';
import { lobbyCrest, lobbyIcon, lobbyNavButton, lobbyPlatform } from '../ui/lobbyArt';
import { runSaveManager } from '../systems/RunSaveManager';
import { getStageDefinition } from '../config/stageData';
import { endlessRecordManager } from '../systems/EndlessRecordManager';
import { legacyProfile } from '../systems/LegacyProfile';
import { HERO_CLASSES } from '../config/heroClassData';

export class MenuScene extends Phaser.Scene {
  private soundBtnText!: Phaser.GameObjects.Text;
  private starting = false;
  constructor() { super('MenuScene'); }

  public create(data: { message?: string } = {}): void {
    this.starting = false;
    this.input.enabled = true;
    const saved = runSaveManager.load();
    const cx = GAME_WIDTH / 2;
    this.add.image(cx, GAME_HEIGHT / 2, 'art_lobby').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setName('title-art');
    const shade = this.add.graphics();
    shade.fillStyle(0x0a081d,.22).fillRect(0,0,GAME_WIDTH,120);
    shade.fillStyle(0x0a081d,.14).fillRect(0,860,GAME_WIDTH,420);
    shade.lineStyle(2,0x9e77c4,.6).strokeRoundedRect(10,10,GAME_WIDTH-20,GAME_HEIGHT-20,14);
    lobbyCrest(this,cx,258).setName('title-crest');
    const platform=lobbyPlatform(this,cx,720).setName('lobby-platform');
    const party=this.add.container(0,0).setName('lobby-party');
    const leader=this.add.image(cx,590,lobbyCharacterPortrait('summoner')).setDisplaySize(296,296).setName('lobby-leader');
    party.add([
      this.add.image(116,650,lobbyCharacterPortrait('knight')).setDisplaySize(176,176).setName('lobby-knight'),
      this.add.image(215,650,lobbyCharacterPortrait('archer')).setDisplaySize(176,176).setName('lobby-archer'),
      this.add.image(516,650,lobbyCharacterPortrait('healer')).setDisplaySize(176,176).setName('lobby-healer'),
      this.add.image(616,654,lobbyCharacterPortrait('fireMage')).setDisplaySize(168,168).setName('lobby-fire-mage'),
      leader,this.add.image(280,702,'portrait_lobby_familiar').setDisplaySize(88,88)
    ]);
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      this.tweens.add({targets:leader,y:586,duration:1800,yoyo:true,repeat:-1,ease:'Sine.InOut'});
      this.tweens.add({targets:platform,alpha:.4,duration:2200,yoyo:true,repeat:-1,ease:'Sine.InOut'});
    }

    pixelPanel(this,24,20,672,92,0x1e1735,FANTASY.edge).setName('lobby-profile');
    pixelPanel(this,36,28,78,78,0x1a142d,FANTASY.gold);
    this.add.image(75,66,lobbyCharacterPortrait('summoner')).setDisplaySize(72,72).setName('lobby-profile-portrait');
    const classLabel=this.label(130,38,'',25,'#f4e9ff').setOrigin(0).setWordWrapWidth(310).setName('lobby-class');
    this.label(130,78,'다음 새 원정 클래스',17,'#b9b0d2').setOrigin(0);
    pixelPanel(this,456,32,224,68,0x161128,FANTASY.edge);
    legacyProfile.flush();
    const legacyLabel=this.label(568,56,'',22,'#e6d1ff').setWordWrapWidth(200).setName('legacy-summary');
    const legacyHint=this.label(568,83,'',14,'#b9b0d2').setWordWrapWidth(200);
    const refreshLegacy=()=>{
      const state=legacyProfile.snapshot(),hero=HERO_CLASSES[state.profile.selectedClass];
      classLabel.setText(hero.name);leader.setTint(hero.color);
      legacyLabel.setText(state.status==='ready'?`영혼 조각 ${state.profile.shards}`:'영구 기록 읽기 실패');
      legacyHint.setText(state.status==='ready'?state.pending?'지급 대기 있음':'영구 성장에 사용':'기본 상태로 시작');
    };
    refreshLegacy();this.events.on('legacy-changed',refreshLegacy);

    const hasSave=saved.status==='ready';
    const start=fantasyButton(this,cx,940,584,112,hasSave?`이어하기 · STAGE ${saved.checkpoint.stats.stageIndex+1}`:'원정 시작',()=>{
      this.startRun(hasSave);
    },{primary:true,fontSize:hasSave?32:40,hitWidth:640,hitHeight:112}).setName(hasSave?'continue-run':'new-run');
    (start.getByName('label') as Phaser.GameObjects.Text).x=20;
    start.add(lobbyIcon(this,'swords',-210,0,48));
    const tips=this.add.graphics();
    for(const side of[-1,1]){
      const points=[{x:side*288,y:-30},{x:side*316,y:0},{x:side*288,y:30},{x:side*277,y:0}];
      tips.fillStyle(0xc88a36).fillPoints(points,true).lineStyle(2,0xffe8a0).strokePoints(points,true,true);
    }
    start.add(tips);
    fantasyButton(this, cx, 1052, 520, 64, hasSave ? '새 모험' : '이어하기 · 저장 없음', () => {
      if (this.starting) return;
      if (saved.status === 'ready') this.confirmNewRun();
      else this.startRun(false);
    }, {enabled:hasSave,fontSize:24,hitHeight:108}).setName(hasSave?'new-run':'continue-run');
    const caption = saved.status === 'ready'
      ? saved.recovered ? '최근 저장이 손상되어 이전 정상 저장 지점에서 이어합니다.'
        : `${getStageDefinition(saved.checkpoint.stats.stageIndex)!.name} · ${saved.checkpoint.endlessChoice === 'pending' ? '진행 선택' : saved.checkpoint.version === 2 && saved.checkpoint.phase !== 'stage-start' ? '마지막 정비' : '스테이지 시작'} 상태로 재개`
      : saved.status === 'invalid' ? '저장 데이터가 손상되었거나 지원하지 않는 버전입니다.'
      : saved.status === 'unavailable' ? '저장소를 사용할 수 없습니다. 자동 저장이 제한됩니다.' : '스테이지 시작·방 클리어·정비 시 자동 저장됩니다.';
    const showSaveStatus=saved.status==='invalid'||saved.status==='unavailable'||(saved.status==='ready'&&saved.recovered);
    this.label(cx, 1106, showSaveStatus ? caption : data.message ?? caption,
      16, '#e0cfee').setWordWrapWidth(640).setStroke('#130e22',3).setName('save-caption');
    const sound = fantasyButton(this,638,450,116,100,this.getSoundLabel(),()=>{
      if(!this.canOpenPanel())return;
      soundManager.setEnabled(!soundManager.isEnabled());
      if(soundManager.isEnabled())void soundManager.unlockFromUserGesture();
      this.soundBtnText.setText(this.getSoundLabel());
    },{fontSize:20,hitWidth:116,hitHeight:108}).setName('sound-toggle');
    sound.add(lobbyIcon(this,'sound',0,-22,36));
    this.soundBtnText = sound.getByName('label') as Phaser.GameObjects.Text;
    lobbyNavButton(this,136,1180,'클래스','classes',()=>this.openLegacy('classes')).setName('legacy-open');
    lobbyNavButton(this,360,1180,'영구 성장','growth',()=>this.openLegacy('growth')).setName('legacy-growth-open');
    lobbyNavButton(this,584,1180,'원정 도감','codex',()=>{
      if(this.canOpenPanel())this.scene.launch('CodexScene');
    }).setName('codex-open');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.events.off('legacy-changed',refreshLegacy);this.tweens.killAll();
      this.scene.stop('LegacyScene');this.scene.stop('CodexScene');
    });
    const highest = endlessRecordManager.highestStage();
    this.label(cx,1252,highest?`무한 원정 최고 도달 · STAGE ${highest}`:'작은 동료들이 모여, 위대한 모험이 됩니다.',17,'#d2bfe2')
      .setStroke('#130e22',3).setName('endless-record');
  }

  private canOpenPanel(): boolean {
    return !this.starting&&!this.children.getByName('new-run-confirmation')
      &&!this.scene.isActive('LegacyScene')&&!this.scene.isActive('CodexScene');
  }

  private openLegacy(tab:'classes'|'growth'):void {
    if(this.canOpenPanel())this.scene.launch('LegacyScene',{tab});
  }

  private startRun(resume: boolean): void {
    if (this.starting) return;
    this.starting = true;
    this.input.enabled = false;
    void soundManager.unlockFromUserGesture().then(ready=>{if(ready)soundManager.playPowerup();});
    this.scene.start('GameScene', { resume });
  }

  private confirmNewRun(): void {
    // A confirmation inside the game prevents an accidental overwrite of a saved run.
    if (this.children.getByName('new-run-confirmation')) return;
    const modal = this.add.container(0, 0).setName('new-run-confirmation').setDepth(100);
    const block = this.add.rectangle(360, 640, 720, 1280, 0x0c1218, 0.9).setInteractive();
    const panel = pixelPanel(this, 50, 480, 620, 300);
    const title = this.label(360, 540, '저장된 모험을 지우고\n새로 시작할까요?', 26, '#efe4c4');
    const cancel=fantasyButton(this,210,700,240,100,'취소',()=>modal.destroy(),{fontSize:28}).setName('new-run-cancel');
    const confirm=fantasyButton(this,510,700,240,100,'새 모험 시작',()=>this.startRun(false),{fontSize:28,primary:true}).setName('new-run-confirm');
    modal.add([block,panel,title,cancel,confirm]);
  }

  private label(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: FANTASY.font, fontSize: `${size}px`, resolution: 2, fontStyle: 'bold', color, align: 'center' }).setOrigin(0.5);
  }
  private getSoundLabel(): string { return `\n소리 ${soundManager.isEnabled() ? '켜짐' : '꺼짐'}`; }
}
