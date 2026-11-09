import Phaser from 'phaser';
import { FANTASY, fantasyButton, pixelPanel, fantasyRibbon } from '../ui/fantasyTheme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { soundManager } from '../systems/SoundManager';
import { RunStats, HeroSnapshot } from '../types/game';
import { HERO_CLASSES } from '../config/heroClassData';
import { legacyProfile } from '../systems/LegacyProfile';

export interface GameOverSceneData {
  victory: boolean;
  stats: RunStats;
  droneSummary: string[];
  saveWarning?: string;
  hero?: HeroSnapshot;
  safeLimit?: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  public create(data: GameOverSceneData): void {
    const cx = GAME_WIDTH / 2;

    this.add.image(cx, GAME_HEIGHT / 2, 'art_title').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x111a20, 0.75);

    const accentColor = data.victory ? FANTASY.gold : 0xa8788c;
    const headerTitle = data.victory ? data.stats.stageIndex >= 5 ? '무한 원정 완료' : '원정 승리!' : '다시 일어설 시간';
    const subTitle = data.victory
      ? data.safeLimit ? '안전 상한에 도달해 승리로 원정을 마무리했습니다.' : data.stats.stageIndex >= 5
        ? `STAGE ${data.stats.stageIndex + 1} 정화 · 승리 기록으로 원정을 마무리했습니다.` : '최종 보스를 물리치고 모든 스테이지를 정화했습니다!'
      : '소환사의 생명력이 모두 소진되어 원정이 종료되었습니다.';

    const crown=this.add.graphics();
    crown.fillStyle(data.victory?0xe3b855:0x916c87).fillPoints([{x:cx-34,y:92},{x:cx-18,y:108},{x:cx,y:72},{x:cx+18,y:108},{x:cx+34,y:92},{x:cx+25,y:132},{x:cx-25,y:132}],true);
    fantasyRibbon(this,cx,192,570,headerTitle,46,!data.victory);

    this.add
      .text(cx, 250, subTitle, {
        fontFamily: FANTASY.font,
        fontSize: '21px',
        color: '#d8c7e8',
        align:'center',wordWrap:{width:620}
      })
      .setOrigin(0.5);

    // 통계 패널
    pixelPanel(this,36,290,648,116,FANTASY.panel,accentColor);
    pixelPanel(this,36,428,648,406,FANTASY.slate,FANTASY.edge);

    const s = data.stats;
    const rows: [string, string][] = [
      ['정화한 회랑', `${s.roomsCleared} 개`],
      ['물리친 몬스터', `${s.enemiesDefeated} 기`],
      ['남은 마력석', `${s.mineralsCollected} ◆`],
      ['도달 스테이지', `${s.stageIndex + 1}`],
      ['토벌한 보스', `${s.bossesDefeated} 기`],
      ['마왕 토벌 여부', s.bossDefeated ? '성공 (CLEAR)' : '미달성']
    ];

    rows.forEach(([label, val], idx) => {
      const y = 465 + idx * 44;
      this.add
        .text(66, y, label, {
          fontFamily: FANTASY.font,
          fontSize: '26px',
          color: FANTASY.muted
        })
        .setOrigin(0, 0.5);

      this.add
        .text(GAME_WIDTH - 66, y, val, {
          fontFamily: 'monospace',
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#efe4c4'
        })
        .setOrigin(1, 0.5);
    });

    this.add
      .text(66, 735, '최종 출전 동료', {
        fontFamily: FANTASY.font,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#d9b969'
      })
      .setOrigin(0, 0.5);

    this.add
      .text(
        66,
        758,
        data.droneSummary.length > 0 ? data.droneSummary.join('  |  ') : '동료 없음',
        {
          fontFamily: FANTASY.font,
          fontSize: '21px',
          color: '#e2e8f0',
          wordWrap: { width: 588 }
        }
      )
      .setOrigin(0, 0);

    if (data.hero) {
      const hero = data.hero;
      this.add.text(cx, 862, `${HERO_CLASSES[hero.classId].name} · Lv.${hero.level}`, {
        fontFamily: FANTASY.font, fontSize: '22px', color: '#cfb7ff'
      }).setOrigin(0.5).setName('hero-summary');
      this.add.text(cx, 887, `영웅 처치 ${hero.kills.hero} · 분대 ${hero.kills.unit} · 기타 ${Math.max(0, s.enemiesDefeated - hero.kills.hero - hero.kills.unit)}`, {
        fontFamily: FANTASY.font, fontSize: '20px', color: '#cfb7ff'
      }).setOrigin(0.5).setName('hero-kills');
    }

    // 재도전 버튼
    fantasyButton(this, cx, 970, 600, 96, '다시 모험하기', () => {
      soundManager.playPowerup();
      this.scene.start('GameScene', { resume: false });
    }, { primary: true, fontSize: 30 }).setName('result-retry');

    // 메인 메뉴 버튼
    fantasyButton(this, cx, 1078, 600, 88, '타이틀 화면으로', () => {
      this.scene.start('MenuScene');
    }, { fontSize: 28 }).setName('result-menu');
    legacyProfile.recordBosses(data.hero?.classId??'APPRENTICE_SUMMONER',data.stats.bossesDefeated);
    const refreshLegacy=()=>{const state=legacyProfile.snapshot();return state.status==='ready'
      ?`영혼 조각 ${state.profile.shards} · 지급 대기 ${state.pending*3}${state.pending?'\n저장 전 앱 종료 시 미지급 기록 유실 가능':''}`:'영구 기록 저장 불가 · 원본 유지';};
    const legacyText=this.add.text(cx,346,refreshLegacy(),{fontFamily:FANTASY.font,fontSize:'24px',color:'#d9baff',align:'center',wordWrap:{width:592}}).setOrigin(0.5).setName('legacy-result');
    fantasyButton(this,cx,1180,600,88,'영혼 조각 지급 재시도',()=>{legacyProfile.flush();legacyText.setText(refreshLegacy());},
      {fontSize:25}).setName('legacy-retry');
    if (data.saveWarning) this.add.text(cx, 1240, data.saveWarning, {
      fontFamily: FANTASY.font, fontSize: '17px', color: '#f87171'
    }).setOrigin(0.5);
  }
}
