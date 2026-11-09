import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { soundManager } from '../systems/SoundManager';
import { FANTASY, pixelPanel, fantasyButton, fantasyCrest } from '../ui/fantasyTheme';
import { unitPortrait } from '../ui/pixelCharacters';
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
    this.add.image(cx, GAME_HEIGHT / 2, 'art_title').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setName('title-art');
    const shade = this.add.graphics();
    shade.fillStyle(0x07091d, 0.17).fillRect(0, 0, GAME_WIDTH, 360);
    for (let row = 0; row < 16; row++) shade.fillStyle(0x080b1d, row / 25).fillRect(0, 820 + row * 29, GAME_WIDTH, 29);
    shade.lineStyle(2, 0xa58abb, 0.7).strokeRoundedRect(10, 10, GAME_WIDTH - 20, GAME_HEIGHT - 20, 14);
    fantasyCrest(this, cx, 310).setName('title-crest');
    this.label(cx, 445, '동료를 모으고, 운명을 조합하세요.', 26, '#e6d4f3').setStroke('#151427', 3);
    const sigil=this.add.graphics();
    sigil.fillStyle(0x9c65d1,0.12).fillEllipse(cx,802,500,90);
    sigil.lineStyle(2,0xc6a3ed,0.55).strokeEllipse(cx,802,500,90).strokeEllipse(cx,802,430,66);
    this.add.image(78,703,unitPortrait('HERBAL_PRIEST')).setDisplaySize(132,132).setTint(0xc5b7d7);
    this.add.image(645,703,unitPortrait('ROCKET_BOT')).setDisplaySize(132,132).setTint(0xc5b7d7);
    this.add.image(180,748,unitPortrait('STONE_GUARD')).setDisplaySize(178,178);
    this.add.image(546,748,unitPortrait('BASIC_LASER')).setDisplaySize(178,178);
    this.add.image(cx,685,'portrait_leader').setDisplaySize(300,300);
    legacyProfile.flush();
    const legacyLabel=this.label(cx,70,'',21,'#dec8f2').setWordWrapWidth(620).setName('legacy-summary');
    const refreshLegacy=()=>{const s=legacyProfile.snapshot();legacyLabel.setText(s.status==='ready'
      ?`${HERO_CLASSES[s.profile.selectedClass].name} · 영혼 조각 ${s.profile.shards}${s.pending?' · 지급 대기 있음':''}`:'영구 기록 읽기 실패 · 기본 상태로 시작');};
    refreshLegacy();this.events.on('legacy-changed',refreshLegacy);
    fantasyButton(this,198,1160,300,96,'영혼의 야영지',()=>{
      if(!this.starting&&!this.children.getByName('new-run-confirmation')&&!this.scene.isActive('LegacyScene'))this.scene.launch('LegacyScene');
    },{fontSize:26}).setName('legacy-open');
    const hasSave=saved.status==='ready';
    fantasyButton(this,cx,910,600,100,hasSave?`이어하기 · STAGE ${saved.checkpoint.stats.stageIndex+1}`:'모험 시작',()=>{
      this.startRun(hasSave);
    },{primary:true,fontSize:32}).setName(hasSave?'continue-run':'new-run');
    fantasyButton(this, cx, 1024, 600, 88, hasSave ? '새 모험' : '이어하기 · 저장 없음', () => {
      if (this.starting) return;
      if (saved.status === 'ready') this.confirmNewRun();
      else this.startRun(false);
    }, {enabled:hasSave,fontSize:28}).setName(hasSave?'new-run':'continue-run');
    const caption = saved.status === 'ready'
      ? saved.recovered ? '최근 저장이 손상되어 이전 정상 저장 지점에서 이어합니다.'
        : `${getStageDefinition(saved.checkpoint.stats.stageIndex)!.name} · ${saved.checkpoint.endlessChoice === 'pending' ? '진행 선택' : saved.checkpoint.version === 2 && saved.checkpoint.phase !== 'stage-start' ? '마지막 정비' : '스테이지 시작'} 상태로 재개`
      : saved.status === 'invalid' ? '저장 데이터가 손상되었거나 지원하지 않는 버전입니다.'
      : saved.status === 'unavailable' ? '저장소를 사용할 수 없습니다. 자동 저장이 제한됩니다.' : '스테이지 시작·방 클리어·정비 시 자동 저장됩니다.';
    this.label(cx, 1090, saved.status === 'ready' && saved.recovered ? caption : data.message ?? caption,
      18, '#d5c3e6').setWordWrapWidth(620);
    const sound = fantasyButton(this, 624, 150, 120, 72, this.getSoundLabel(), () => {
      soundManager.enabled = !soundManager.enabled;
      this.soundBtnText.setText(this.getSoundLabel());
    }, { fontSize: 22,hitWidth:120,hitHeight:100 }).setName('sound-toggle');
    this.soundBtnText = sound.getByName('label') as Phaser.GameObjects.Text;
    fantasyButton(this,522,1160,300,96,'원정 도감',()=>{
      if(!this.starting&&!this.children.getByName('new-run-confirmation')&&!this.scene.isActive('CodexScene'))this.scene.launch('CodexScene');
    },{fontSize:26}).setName('codex-open');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.events.off('legacy-changed',refreshLegacy);this.scene.stop('LegacyScene');this.scene.stop('CodexScene');});
    const highest = endlessRecordManager.highestStage();
    this.label(cx, 1240, highest ? `무한 원정 최고 도달 · STAGE ${highest}` : '작은 동료들이 모여, 위대한 모험이 됩니다.', 18, '#c1afcd').setName('endless-record');
  }

  private startRun(resume: boolean): void {
    if (this.starting) return;
    this.starting = true;
    this.input.enabled = false;
    soundManager.playPowerup();
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
  private getSoundLabel(): string { return `소리 ${soundManager.enabled ? '켜짐' : '꺼짐'}`; }
}
