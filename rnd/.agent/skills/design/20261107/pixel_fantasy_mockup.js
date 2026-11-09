/* Design prototype. All changes stay in memory; no game imports, network, or storage writes. */
(() => {
  'use strict';
  const D = window.MOCKUP_DATA;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icons = {
    gem:'M11 2 20 9 11 21 2 9Z M2 9h18 M7 3l-1 6 5 12 5-12-1-6',
    sword:'m5 19 2-2 M4 14l5 5 M7 15 18 3l2 2L9 17 M14 3h4v4',
    shield:'M11 2 20 6v6l-9 9-9-9V6Z M11 6v10',
    heart:'M11 20 2 11V6l4-3 5 4 5-4 4 3v5Z',
    leaf:'M3 20 18 4 M5 15V7l7-4 8-1-1 8-5 7H6',
    book:'M2 4h7l2 2 2-2h7v15h-7l-2 1-2-1H2Z M11 6v14 M5 8h3 M14 8h3',
    bolt:'m13 1-9 12h7l-2 9L20 9h-8Z',
    flag:'M4 22V2h15l-3 5 3 5H5',
    spark:'m11 1 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
    check:'m3 11 5 5L19 5',
    crown:'M3 7l5 4 3-8 3 8 5-4-2 11H5Z M5 21h12'
  };
  const icon = name => `<svg class="pixel-icon" viewBox="0 0 22 24" aria-hidden="true"><path d="${icons[name] || icons.spark}"/></svg>`;
  const sprite = (id, cls = '', label = '') => {
    if (id === 'hero') return `<span class="sprite hero ${cls}" role="img" aria-label="소환사"></span>`;
    const index = D.art[id] ?? 0;
    return `<span class="sprite ${cls}" style="--col:${index % 6};--row:${Math.floor(index / 6)}" role="img" aria-label="${esc(label || D.units[id]?.name)}"></span>`;
  };
  const portrait = id => {
    const u=D.units[id],color=`#${D.elementColors[u.elements[0]].toString(16).padStart(6,'0')}`;
    return `<span class="portrait-frame" style="--element:${color}">${sprite(id,'portrait')}<span class="portrait-tier">T${u.tier}</span></span>`;
  };
  const logoCrest = '<svg class="logo-crest" viewBox="0 0 330 114" aria-hidden="true"><path fill="#1d152e" stroke="#916c39" stroke-width="3" d="M18 39 34 22 100 25 126 17 165 25 204 17 230 25 296 22 312 39 306 81 294 94 221 89 165 103 109 89 36 94 24 81Z"/><path fill="none" stroke="#d9ad67" stroke-width="1.5" d="m26 41 12-12 62 3 26-8 39 9 39-9 26 8 62-3 12 12-5 36-9 10-69-5-56 14-56-14-69 5-9-10Z"/><path fill="#4b3066" stroke="#9873bd" d="m144 13 21-11 21 11-4 22-17 10-17-10Z"/><path fill="#78d9ff" stroke="#d8f6ff" stroke-width="1.5" d="m165 3 11 13-3 14-8 10-8-10-3-14Z"/><path fill="#3985d4" d="m165 4 1 17-1 18 9-9 3-14Z"/><path stroke="#d6b16e" fill="none" d="m33 48 8 7-4 9m260-16-8 7 4 9M66 92l10 8h29m159-8-10 8h-29"/><path fill="#d6b16e" d="m18 51 5 5-5 5-5-5Zm294 0 5 5-5 5-5-5Z"/></svg>';
  const btn = (text, action, cls = '', attrs = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
  const progress = (percent, cls = '') => `<div class="progress ${cls}"><i style="width:${percent}%"></i></div>`;
  const defs = {
    menu:{num:'01',name:'타이틀 · 이어하기',desc:'현재 저장과 다음 새 모험을 구분합니다. 야영지와 도감은 보조 행동으로 둡니다.',states:[['normal','저장 있음'],['empty','저장 없음'],['save','저장 읽기 실패'],['pending','복구된 저장']]},
    squad:{num:'02',name:'원정 정비',desc:'유닛 지정 소환 → 실제 재료 조합 → 출전 편성. 카드의 비용과 조건을 비교합니다.',states:[['normal','기본 정비'],['poor','마력석 부족'],['full','보유 16/16'],['empty','보유 없음'],['save','저장 실패'],['stage','스테이지 완료']]},
    battle:{num:'03',name:'전투 · 분대 상태',desc:'상단 보스 HP는 추가 UI 제안입니다. 전투 연출은 정지 장면이며 조작은 모의 동작입니다.',states:[['normal','보스 전투'],['dead','동료 전투 불능'],['low','본체 HP 위험'],['cleared','방 클리어'],['cooldown','액티브 대기']]},
    choice:{num:'04',name:'재능 · 유물 선택',desc:'기존 효과와 선택권을 유지합니다. 보류가 가능하며 무작위 새로고침은 없습니다.',states:[['normal','재능 선택 대기'],['empty','선택권 없음'],['relic','유물 선택 대기'],['owned','유물 보유'],['save','선택 후 저장 실패']]},
    result:{num:'05',name:'원정 결과',desc:'원정 종료의 결과 화면입니다. 중간 스테이지 완료는 정비 화면에서 확인합니다.',states:[['normal','원정 승리'],['defeat','원정 패배'],['pending','영혼 조각 지급 대기'],['stage','중간 완료 요약']]}
  };
  let state;
  function reset(){
    state = {view:'all',size:360,status:Object.fromEntries(Object.keys(defs).map(key=>[key,'normal'])),tab:'summon',page:0,
      minerals:165,vouchers:1,nextId:7,notice:'일반 방 보상 반영 · 정비 상태 자동 저장',noticeWarning:false,
      units:['BASIC_LASER','BASIC_LASER','STONE_GUARD','HERBAL_PRIEST','ROCKET_BOT','SPARK_SPIRIT'].map((type,i)=>({id:i+1,type,deployed:true})),
      selectedTalents:[],selectedRelic:null,talentTokens:1,relicToken:true,choiceTab:'talent',detail:false,activeUsed:false,sound:true};
  }
  const currentMoney = () => state.status.squad === 'poor' ? 3 : state.minerals;
  const currentUnits = () => state.status.squad === 'empty' ? [] : state.status.squad === 'full' ? Array.from({length:16},(_,i)=>({...state.units[i%state.units.length] || {type:'BASIC_LASER'},id:i+1,deployed:i<6})) : state.units;
  const freeVouchers = () => state.status.squad === 'poor' ? 0 : state.vouchers;
  const title = (name, aside = '') => `<div class="section-title"><span class="heading-seal" aria-hidden="true">${icon('book')}</span><h3>${name}</h3><small>${aside}</small></div>`;
  function renderMenu(){
    const mode=state.status.menu, hasSave=mode==='normal'||mode==='pending';
    return `<div class="screen hero-title">${mark()}<div class="title-meta"><span class="tag">견습 소환사</span><span class="tag">영혼 조각 6</span></div>
      <div class="title-logo"><div class="diamond" aria-hidden="true">${logoCrest}</div><h2>소환사의 원정</h2><div class="english">SUMMONER’S EXPEDITION</div><p>동료를 모으고, 운명을 조합하세요.</p></div>
      <div class="hero-ensemble"><span class="summon-sigil" aria-hidden="true"></span>${sprite('HERBAL_PRIEST','companion far-left')}${sprite('STONE_GUARD','companion near-left')}${sprite('hero')}${sprite('BASIC_LASER','companion near-right')}${sprite('ROCKET_BOT','companion far-right')}</div>
      <div class="title-actions">${btn(hasSave?'이어하기 <span class="button-sub">STAGE 3 · 마지막 정비</span>':'모험 시작',hasSave?'resume':'new-run','primary')}
      ${btn(hasSave?'새 모험':'이어하기 · 저장 없음','new-run','subtle',hasSave?'':'disabled')}
      <div class="grid-two">${btn('영혼의 야영지','camp')}${btn('원정 도감','codex','subtle')}</div></div>
      <p class="save-caption ${mode==='save'?'danger':''}">${mode==='save'?'저장 기록을 읽지 못했습니다 · 원본 유지':mode==='pending'?'이전 정상 저장 지점으로 복구했습니다':hasSave?'정비 거래가 반영된 지점에서 이어갑니다':'저장된 모험이 없습니다'}</p></div>`;
  }
  function summonCards(){
    const offers=D.offers.slice(state.page*2,state.page*2+2),units=currentUnits(),money=currentMoney();
    return `<div class="list-heading"><span>함께할 동료를 지정 소환하세요</span><span>소환권 ${freeVouchers()}장</span></div>${offers.map(offer=>{
      const u=D.units[offer.unitTypeId],free=u.tier===1&&freeVouchers()>0,full=units.length>=16,poor=!free&&money<offer.cost;
      const reason=full?'보유 한도':poor?'마력석 부족':'';
      return `<article class="panel unit-card">${portrait(u.id)}<div class="unit-info"><h4>${esc(u.name)}</h4><div class="meta"><span class="role-label">${D.roles[u.role]}</span> · ${u.elements.map(e=>D.elements[e]).join('/')}</div><div class="effect">${esc(D.skills[u.id])}</div></div>${btn(reason||`${free?'소환권 사용':`${offer.cost} ◆ 소환`}`,'summon',!reason?'primary':'',`data-id="${u.id}" ${reason?'disabled':''}`)}</article>`;
    }).join('')}${pagination(Math.ceil(D.offers.length/2))}`;
  }
  function recipeCards(){
    const recipe=D.recipes[state.page%D.recipes.length],u=D.units[recipe.resultUnitTypeId],units=currentUnits();
    const enough=recipe.ingredients.every(ing=>units.filter(v=>v.type===ing.unitTypeId).length>=ing.count);
    const needs=recipe.ingredients.map(ing=>`${D.units[ing.unitTypeId].name} ${units.filter(v=>v.type===ing.unitTypeId).length}/${ing.count}`).join(' · ');
    const reason=!enough?'재료가 부족합니다':currentMoney()<recipe.cost?'마력석이 부족합니다':'';
    return `<div class="list-heading"><span>결과와 소모 재료를 먼저 확인하세요</span></div><article class="panel recipe-card"><div class="recipe-top">${sprite(u.id)}<div><h4>${esc(u.name)}</h4><span class="tag gold">T${u.tier} · ★1</span> <small>${D.roles[u.role]}</small></div></div>
      <div class="recipe-line">${recipe.ingredients.flatMap(ing=>Array.from({length:ing.count},()=>sprite(ing.unitTypeId))).join('<b>+</b>')}<b>→</b>${sprite(u.id)}</div>
      <div class="requirements ${!enough?'danger':'green'}">${esc(needs)}</div><div class="consume">${enough?'소모 예시: 출전 중인 재료 포함 · 결과에 반영':'필요한 동료를 소환하거나 다른 조합을 확인하세요.'}<br>추가 비용 <strong class="accent">${recipe.cost} ◆</strong> · 재료는 사라집니다.</div>
      ${btn(reason||'이 재료로 조합하기','combine','primary',`data-id="${recipe.id}" ${reason?'disabled':''}`)}${btn('재료 직접 확인','ingredients','subtle',`data-id="${recipe.id}"`)}</article>${pagination(D.recipes.length)}`;
  }
  function rosterCards(){
    const units=currentUnits(),deployed=units.filter(u=>u.deployed);
    return `<div class="list-heading"><span>출전 ${deployed.length}/6 · 전투 불능과 별도</span></div><div class="roster-strip">${Array.from({length:6},(_,i)=>`<div class="roster-slot">${deployed[i]?sprite(deployed[i].type):'<span class="muted">+</span>'}<div>${deployed[i]?'출전':'빈 자리'}</div></div>`).join('')}</div>${units.length?units.slice(state.page*2,state.page*2+2).map(u=>`<article class="panel unit-card">${sprite(u.type,'portrait')}<div class="unit-info"><h4>${esc(D.units[u.type].name)}</h4><div class="meta">T${D.units[u.type].tier} · ★1 · ${D.roles[D.units[u.type].role]}</div><span class="tag ${u.deployed?'gold':''}">${u.deployed?'출전 중':'대기'}</span></div>${btn(u.deployed?'대기로':'출전','deploy','subtle',`data-id="${u.id}" ${u.deployed&&deployed.length===1||!u.deployed&&deployed.length>=6?'disabled':''}`)}</article>`).join(''):'<div class="panel recipe-card"><h4>아직 함께할 동료가 없습니다</h4><p class="muted">소환 탭에서 동료를 모아 주세요.</p>'+btn('동료 소환으로','tab','primary','data-id="summon"')+'</div>'}${pagination(Math.max(1,Math.ceil(units.length/2)))}`;
  }
  function pagination(pages){return `<div class="page-nav">${btn('← 이전','page','','data-id="-1" '+(state.page<=0?'disabled':''))}<span>${state.page+1} / ${pages}</span>${btn('다음 →','page','','data-id="1" '+(state.page+1>=pages?'disabled':''))}</div>`;}
  function renderSquad(){
    const units=currentUnits(),mode=state.status.squad;
    const note=mode==='save'?'거래는 반영 · 저장 실패, 이전 저장 지점 유지':mode==='stage'?'STAGE 2 완료 · 보상 반영 / 다음 원정 준비':mode==='poor'?'마력석 부족 · 소환 비용을 확인하세요':mode==='full'?'보유 16/16 · 조합 또는 판매로 자리 확보':state.notice;
    return `<div class="screen">${mark()}<div class="section-header squad-head">${title(mode==='stage'?'스테이지 정화 완료':'원정 정비','STAGE 3')}
      <div class="status-row"><span class="currency">◆ ${currentMoney().toLocaleString()}</span><span>보유 ${units.length}/16</span><span>출전 ${units.filter(u=>u.deployed).length}/6</span></div>
      <div class="toast ${mode==='save'||mode==='poor'||state.noticeWarning?'warning':''}" role="status">${esc(note)}</div>
      <div class="tabs">${[['summon','동료 소환'],['combine','조합의 제단'],['roster','원정대']].map(([id,label])=>btn(label,'tab','',`data-id="${id}" aria-pressed="${state.tab===id}"`)).join('')}</div></div>
      <div class="squad-body">${state.tab==='summon'?summonCards():state.tab==='combine'?recipeCards():rosterCards()}</div>
      <div class="bottom-actions squad-footer"><div class="utility-row">${btn('간편 제작','quick')}${btn('성장·보상','growth')}${btn('시설·시너지','facilities')}${btn('도감','codex')}</div>
      ${btn(mode==='stage'?'다음 스테이지 준비 완료':'정비를 마치고 전장으로','to-battle','primary')}<div class="footer-note">${mode==='stage'?'다음 진입 시 본체 HP 40% 회복 · 보상 중복 없음':'동료 편성과 성공한 거래는 정비 중 저장됩니다'}</div></div></div>`;
  }
  function actor(type,x,y,cls='',hp=80){return `<div class="battle-actor ${cls}" style="left:${x}px;top:${y}px">${sprite(type)}<div class="hp-mini" style="width:${Math.round(28*hp/100)}px"></div></div>`;}
  function renderBattle(){
    const mode=state.status.battle,dead=mode==='dead',low=mode==='low',cleared=mode==='cleared',waiting=mode==='cooldown'||state.activeUsed;
    const team=['BASIC_LASER','STONE_GUARD','HERBAL_PRIEST','ROCKET_BOT','SPARK_SPIRIT','GATLING_BOT'];
    const members=team.map((id,i)=>({id,maxHp:D.units[id].maxHp,
      hp:dead&&i===3?0:Math.round(D.units[id].maxHp*[.78,.64,.92,.55,.84,.70][i]),
      revive:dead&&i===3?8:0}));
    const living=members.filter(member=>member.hp>0).length;
    return `<div class="screen battle">${mark()}<div class="battle-hud"><div class="battle-topline">${sprite('hero')}<div><div class="battle-title">견습 소환사 · Lv.7</div><div class="battle-sub">S3 · [2,3] ${cleared?'구역 확보':'보스의 방'}</div></div><span class="currency">◆ 165</span><div class="minimap" aria-label="격자 미니맵">${Array.from({length:9},(_,i)=>`<i class="${i===5?'here':i===2?'boss-room':''}"></i>`).join('')}</div></div>
      <div class="vitals-line"><b class="${low?'danger':''}">HP ${low?'18':'88'}/130</b>${progress(low?14:68)}<span class="cyan">방패 20</span><span>XP</span>${progress(61,'xp')}</div></div>
      ${!cleared?'<div class="boss-strip"><div class="boss-meta"><span>용암 거신 · PHASE 2/2</span><span>HP 62%</span></div>'+progress(62)+'</div>':''}
      <div class="arena"><div class="arena-grid"></div>${!cleared?'<div class="boss-aura" aria-hidden="true"></div><div class="warning-zone"></div><div class="warning-caption">운석 예고 · 위아래로 회피</div><canvas class="enemy-canvas boss battle-actor" data-enemy="BOSS_CORE" width="64" height="64" style="left:181px;top:100px" role="img" aria-label="용암 거신 실루엣 개선 시안"></canvas>':''}
      ${!cleared?Array.from({length:6},(_,i)=>`<canvas class="enemy-canvas battle-actor" data-enemy="${i%2?'SPORE_SHOOTER':'SWARMER'}" width="32" height="32" style="left:${42+(i%3)*123}px;top:${178+Math.floor(i/3)*92}px"></canvas>`).join(''):''}
      ${actor('hero',182,310,'leader ally',low?14:68)}${actor('STONE_GUARD',174,225,'ally')}${actor('BASIC_LASER',112,287,'ally')}${actor('HERBAL_PRIEST',229,318,'ally')}${actor('ROCKET_BOT',262,274,dead?'dead':'ally',dead?0:55)}${actor('SPARK_SPIRIT',102,331,'ally')}${actor('GATLING_BOT',187,343,'ally')}
      ${!cleared?'<div class="projectile" style="left:130px;top:226px"></div><div class="projectile" style="left:221px;top:196px;transform:rotate(-115deg)"></div><div class="magic-ring" style="left:229px;top:224px"></div><span class="damage-number" style="left:204px;top:146px">128</span>':''}
      ${cleared?'<div class="arena-message">구역 확보 · 정비 후 열린 문으로 이동하세요</div>':''}</div>
      <section class="battle-team" aria-label="출전 동료 상태"><div class="team-summary"><strong>출전 동료</strong><span class="${living<6?'has-casualty':''}">생존 ${living}/6${living<6?' · 부활 대기 1':''}</span></div>
      <div class="team-status-row"><div class="team-slots">${members.map(member=>`<div class="member ${member.revive?'dead':''}" role="img" aria-label="${esc(D.units[member.id].name)} · HP ${member.hp}/${member.maxHp}${member.revive?' · 부활 8초':''}" title="${esc(D.units[member.id].name)} · HP ${member.hp}/${member.maxHp}"><span class="member-avatar" aria-hidden="true">${sprite(member.id)}</span>${member.revive?'<span class="revive-time" aria-hidden="true">8초</span>':''}${progress(Math.round(member.hp/member.maxHp*100))}</div>`).join('')}</div>
      ${btn('상세 <span aria-hidden="true">›</span>','team-detail','subtle team-detail-trigger',`aria-label="분대 상태 상세 보기" aria-expanded="${state.detail}" aria-controls="battle-team-detail"`)}</div></section>
      <div class="battle-controls"><div class="joystick" tabindex="0" role="img" aria-label="드래그 반응을 확인하는 모의 조이스틱"><i></i></div>${btn('정비','open-squad','',!cleared?'disabled':'')}${btn(waiting?'치유 파동<br>18초':'치유 파동<br>생존 +10','active','primary',waiting||cleared?'disabled':'')}${btn('중단<br>타이틀','to-menu','subtle')}</div>
      ${state.detail?`<div class="team-detail" id="battle-team-detail"><h4>분대 상태 <small>전투는 계속됩니다</small></h4><div class="team-detail-list">${members.map(member=>`<div class="detail-row">${sprite(member.id,'tiny')}<div>${esc(D.units[member.id].name)}<br><span class="${member.revive?'danger':'muted'}">${member.revive?'전투 불능 · 부활 8초':`HP ${member.hp}/${member.maxHp}`}</span></div></div>`).join('')}</div>${btn('상태 닫기','team-detail','subtle')}</div>`:''}</div>`;
  }
  function renderChoice(){
    const mode=state.status.choice,relic=state.choiceTab==='relic',options=relic?D.relics:D.talents;
    const token=relic?state.relicToken:state.talentTokens>0;
    return `<div class="screen">${mark()}<div class="choice-head"><p class="eyebrow">이번 원정의 새로운 힘</p><h3>${relic?'정예 방의 유물':'소환사의 재능'}</h3><div class="tabs">${btn('재능','choice-tab','',`data-id="talent" aria-pressed="${!relic}"`)}${btn('유물','choice-tab','',`data-id="relic" aria-pressed="${relic}"`)}</div><small>${mode==='save'?'<span class="danger">선택 반영 · 저장 실패, 이전 지점 유지</span>':relic?'미보유 유물 하나 · 나중에 선택 가능':`3레벨마다 선택권 · 현재 대기 ${state.talentTokens}`}</small></div>
      <div class="choice-body">${Object.entries(options).map(([id,o],i)=>{
        const chosen=relic?state.selectedRelic===id:state.selectedTalents.includes(id),disabled=!token||(relic&&chosen);
        const label=relic&&chosen?'보유 중':!token?'선택 대기 없음':relic?'이 유물 선택':'이 재능 선택';
        return `<button class="panel choice-card ${chosen?'selected':''}" style="--card-accent:${['#ffd966','#78d8f5','#be96ff'][i]}" data-action="choose" data-id="${id}" ${disabled?'disabled':''}><span class="icon-box ${i===0?'gold':i===1?'cyan-box':''}">${icon(relic?['flag','heart','book'][i]:['flag','heart','bolt'][i])}</span><span><span class="choice-title">${esc(o.name)}</span><span class="choice-description">${esc(o.description)}</span></span><span class="choice-action">${chosen?icon('check'):''}${label} ${!disabled?'→':''}</span></button>`;
      }).join('')}</div><div class="bottom-actions choice-footer">${btn('나중에 선택 · 정비로','open-squad','subtle')}</div></div>`;
  }
  function renderResult(){
    const mode=state.status.result,defeat=mode==='defeat',stage=mode==='stage',pending=mode==='pending';
    return `<div class="screen result-screen ${defeat?'defeat-screen':''}">${mark()}<div class="result-heading ${defeat?'defeat':''}"><div class="laurel" aria-hidden="true"><span>✦</span>${icon(defeat?'shield':'crown')}<span>✦</span></div><h3>${stage?'회랑 정화 완료':defeat?'다시 일어설 시간':'원정 승리!'}</h3><p>${stage?'STAGE 2 완료 · 다음 원정을 준비하세요':defeat?'STAGE 3 · 소환사의 생명력이 소진되었습니다':'STAGE 5 · 최종 보스 토벌, 승리 종료'}</p></div>
      <div class="result-body"><section class="panel reward-panel"><h4>${stage?'지급 완료한 보상':pending?'영혼 조각 · 지급 대기':'영구 기록'}</h4><div class="reward-items"><div class="reward-item">${icon(stage?'gem':'spark')}<b>${stage?'+1장':pending?'3개 대기':'6개'}</b><small>${stage?'T1 소환권':'영혼 조각'}</small></div><div class="reward-item">${icon('crown')}<b>${stage?'다음 S3':defeat?'S3':'S5'}</b><small>도달 스테이지</small></div></div></section>
      <section class="panel plain stats">${[['정화한 회랑',stage?'18개':'28개'],['물리친 몬스터',stage?'246기':'386기'],['남은 마력석','165 ◆'],['토벌한 보스',stage?'2기':defeat?'2기':'5기']].map(([k,v])=>`<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('')}</section>
      <div class="result-units" aria-label="최종 출전 동료">${['BASIC_LASER','STONE_GUARD','HERBAL_PRIEST','ROCKET_BOT','SPARK_SPIRIT','GATLING_BOT'].map(id=>sprite(id)).join('')}</div>
      ${pending?'<div class="toast warning">지급 대기 · 저장 전 앱 종료 시 유실 가능</div>':''}</div><div class="result-actions">${stage?btn('정비하고 다음 원정 준비','stage-squad','primary'):btn('다시 모험하기','retry','primary')}${pending?btn('영혼 조각 지급 재시도','retry-payment'):btn(stage?'타이틀로 중단':'타이틀 화면으로','to-menu','subtle')}</div></div>`;
  }
  function mark(){return '<div class="mockup-mark">DESIGN PREVIEW · 예시 데이터 / 게임 미연결</div>';}
  const renderers={menu:renderMenu,squad:renderSquad,battle:renderBattle,choice:renderChoice,result:renderResult};
  const resizeObserver=new ResizeObserver(entries=>entries.forEach(({target,contentRect})=>{target.firstElementChild?.style.setProperty('--scale',contentRect.width/360);}));
  function renderAll(){
    resizeObserver.disconnect();
    $('#gallery').innerHTML=Object.entries(defs).map(([key,d])=>`<section class="mockup-card" data-screen="${key}"><div class="card-meta"><div><span class="screen-id">M${d.num} / 9:16</span><h2>${d.name}</h2></div><select class="state-picker" data-state="${key}" aria-label="${d.name} 상태">${d.states.map(([id,label])=>`<option value="${id}" ${state.status[key]===id?'selected':''}>${label}</option>`).join('')}</select></div><div class="phone-window">${renderers[key]()}</div><p class="caption">${d.desc}</p></section>`).join('');
    document.querySelectorAll('.phone-window').forEach(el=>resizeObserver.observe(el));
    drawEnemies();setView(state.view);document.documentElement.dataset.ready='true';
  }
  function renderOne(key){const el=$(`[data-screen="${key}"] .phone-window`);if(!el)return;el.innerHTML=renderers[key]();el.firstElementChild.style.setProperty('--scale',el.clientWidth/360);const select=$(`[data-state="${key}"]`);select.value=state.status[key];if(key==='battle')drawEnemies();}
  function drawEnemies(){document.querySelectorAll('[data-enemy]').forEach(canvas=>{
    const ctx=canvas.getContext('2d');
    if(canvas.dataset.enemy==='BOSS_CORE')paintPreviewBoss(ctx);
    else window.MOCKUP_DRAW_CHARACTER(ctx,canvas.dataset.enemy,0,canvas.width,canvas.height);
  });}
  // Original canvas concept for this preview only; preserves all gameplay sprites and hitboxes.
  function paintPreviewBoss(ctx){
    ctx.clearRect(0,0,64,64);
    const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x*2,y*2,w*2,h*2);};
    const ink='#15121f',dark='#302536',body='#574251',edge='#8e6975',lava='#ff9b53',light='#ffdf9e';
    rect(6,29,21,2,'#0b0c15aa');
    rect(5,13,22,13,ink);rect(3,15,26,8,ink);rect(8,24,7,6,ink);rect(18,24,7,6,ink);
    rect(10,7,13,8,ink);rect(8,4,5,7,ink);rect(21,4,5,7,ink);rect(6,1,4,5,ink);rect(25,1,4,5,ink);
    rect(7,1,2,4,'#d7bdab');rect(9,5,3,4,'#ac9192');rect(26,1,2,4,'#d7bdab');rect(23,5,3,4,'#ac9192');
    rect(10,9,13,8,body);rect(12,8,9,2,edge);rect(9,12,15,3,body);rect(11,11,4,2,ink);rect(18,11,4,2,ink);
    rect(12,12,3,1,light);rect(18,12,3,1,light);rect(14,15,5,2,ink);rect(15,15,1,1,light);rect(18,15,1,1,light);
    rect(8,17,17,8,body);rect(11,17,11,2,edge);rect(15,19,4,5,ink);rect(16,19,2,4,lava);rect(16,20,1,2,light);
    rect(5,14,6,7,dark);rect(23,14,5,7,dark);rect(4,20,6,4,body);rect(24,20,5,4,body);
    rect(5,15,4,2,edge);rect(24,15,3,2,edge);rect(5,21,2,1,lava);rect(25,21,2,1,lava);
    rect(9,25,5,4,dark);rect(19,25,5,4,dark);rect(8,28,7,2,edge);rect(18,28,7,2,edge);
    rect(10,18,2,1,lava);rect(11,19,1,3,lava);rect(21,18,2,1,lava);rect(21,20,1,2,lava);
    rect(9,29,2,1,light);rect(12,29,2,1,light);rect(19,29,2,1,light);rect(22,29,2,1,light);
  }
  function setView(view){state.view=view;$('#gallery').classList.toggle('single',view!=='all');document.querySelectorAll('[data-screen]').forEach(el=>{el.hidden=view!=='all'&&el.dataset.screen!==view;el.style.display=el.hidden?'none':'';});document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.view===view)));}
  function move(view){setView(view);if(window.innerWidth<760)$('#gallery').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  function showDialog(name,body,action=''){ $('#dialog-content').innerHTML=`<h2 id="dialog-title">${name}</h2>${body}<p class="dialog-note">검토용 예시 · 실제 게임 데이터는 변경하지 않습니다.</p>${action}`;$('#review-dialog').showModal(); }
  function notice(text,warning=false){state.notice=text;state.noticeWarning=warning;renderOne('squad');}
  function applyStatus(key,value){
    state.status[key]=value;
    if(key==='squad'){state.tab=value==='empty'?'roster':'summon';state.page=0;state.noticeWarning=false;}
    if(key==='battle'){state.detail=false;state.activeUsed=value==='cooldown';}
    if(key==='choice'){state.choiceTab=value==='relic'||value==='owned'?'relic':'talent';state.talentTokens=value==='empty'||value==='save'?0:1;state.relicToken=value!=='owned';state.selectedTalents=value==='save'?['COMMAND']:[];state.selectedRelic=value==='owned'?'COMMAND_BANNER':null;}
    renderOne(key);
  }
  const actions={
    resume:()=>move('battle'),
    'new-run':()=>state.status.menu==='normal'||state.status.menu==='pending'?showDialog('새 모험을 시작할까요?','<p>현재 저장된 모험을 교체합니다. 실제 게임에서는 확인 후 새 원정을 시작합니다.</p>',btn('새 모험 시작 · 미리보기','confirm-new','primary')):move('battle'),
    'confirm-new':()=>{$('#review-dialog').close();move('battle');},retry:()=>move('battle'),'to-menu':()=>move('menu'),'to-battle':()=>{state.status.battle='cleared';renderOne('battle');move('battle');},
    'open-squad':()=>move('squad'),'stage-squad':()=>{applyStatus('squad','stage');move('squad');},
    tab:id=>{state.tab=id;state.page=0;renderOne('squad');},page:amount=>{state.page=Math.max(0,state.page+Number(amount));renderOne('squad');},
    summon:id=>{const offer=D.offers.find(o=>o.unitTypeId===id);if(!offer||currentUnits().length>=16)return;const free=D.units[id].tier===1&&freeVouchers()>0;if(!free&&currentMoney()<offer.cost)return;if(free)state.vouchers--;else state.minerals-=offer.cost;state.units.push({type:id,id:state.nextId++,deployed:state.units.filter(u=>u.deployed).length<6});notice(`${D.units[id].name} 소환 · ${free?'소환권 1장 사용':`${offer.cost} ◆ 사용`}`);},
    combine:id=>{const recipe=D.recipes.find(r=>r.id===id);if(!recipe||currentMoney()<recipe.cost)return;const pool=[...currentUnits()],chosen=[];for(const ing of recipe.ingredients){for(let i=0;i<ing.count;i++){const at=pool.findIndex(u=>u.type===ing.unitTypeId);if(at<0)return;chosen.push(pool.splice(at,1)[0]);}}state.units=pool;state.status.squad='normal';state.minerals-=recipe.cost;state.nextId=Math.max(state.nextId,...pool.map(u=>u.id+1));state.units.push({id:state.nextId++,type:recipe.resultUnitTypeId,deployed:state.units.filter(u=>u.deployed).length<6});notice(`${D.units[recipe.resultUnitTypeId].name} 조합 완료 · 재료 ${chosen.length}기 소모`);},
    ingredients:id=>{const recipe=D.recipes.find(r=>r.id===id);showDialog('조합 재료 확인',recipe.ingredients.map(ing=>`<div class="detail-row">${sprite(ing.unitTypeId,'tiny')} ${esc(D.units[ing.unitTypeId].name)} · 필요 ${ing.count}기</div>`).join('')+'<p>실제 개체 선택·각성 소멸 확인은 게임의 기존 거래 흐름을 따릅니다.</p>');},
    deploy:id=>{if(state.status.squad==='full'||state.status.squad==='empty'){notice('상태 비교 예시입니다 · 기본 정비에서 편성을 변경하세요',true);return;}const unit=state.units.find(u=>u.id===Number(id));if(!unit)return;const n=state.units.filter(u=>u.deployed).length;if(unit.deployed&&n<=1||!unit.deployed&&n>=6)return;unit.deployed=!unit.deployed;notice(`${D.units[unit.type].name} · ${unit.deployed?'출전':'대기'}로 변경`);},
    'choice-tab':id=>{state.choiceTab=id;renderOne('choice');},
    choose:id=>{if(state.choiceTab==='talent'){if(state.talentTokens<=0)return;state.selectedTalents.push(id);state.talentTokens--;}else{if(!state.relicToken||state.selectedRelic)return;state.selectedRelic=id;state.relicToken=false;}renderOne('choice');},
    'team-detail':()=>{state.detail=!state.detail;renderOne('battle');},
    active:()=>{if(state.activeUsed)return;state.activeUsed=true;renderOne('battle');},
    camp:()=>showDialog('영혼의 야영지',Object.values(D.classes).map(c=>`<div class="detail-row"><strong>${esc(c.name)}</strong><p>${esc(c.description)}</p></div>`).join('')+'<p>클래스 선택·영구 성장은 다음 새 모험에 적용됩니다. 이어하기는 저장된 사본을 유지합니다.</p>'),
    codex:()=>showDialog('원정 도감',`<p>발견 유닛과 보스를 확인하는 화면의 진입 예시입니다.</p><div>${Object.keys(D.art).map(id=>sprite(id,'portrait')).join('')}</div><p>발견 여부와 현재 보유는 구분합니다.</p>`),
    quick:()=>showDialog('간편 제작','<p>유닛을 지정하고 신규 재료 소환·중간 조합 비용을 포함한 총견적을 확인하는 기존 기능입니다.</p><p>보유 유닛·별·소환권은 보존합니다. 이 목업에서는 실제 견적 거래를 실행하지 않습니다.</p>'),
    growth:()=>showDialog('성장 · 보상','<p>원정 강화, 재능 선택, 유물 보상을 모아 확인하는 진입점입니다.</p>'+Object.values(D.upgrades).map(u=>`<div class="detail-row">${esc(u.name)}</div>`).join(''),btn('재능·유물 선택 미리보기','open-choice','primary')),
    'open-choice':()=>{$('#review-dialog').close();move('choice');},
    facilities:()=>showDialog('시설 · 편성 시너지','<p>★3 각성 · 완치/부활 서비스 · 보급 보상 · 편성 시너지의 기존 기능 진입 예시입니다.</p><p>재화·대상·보류 상태와 소멸 확인을 각각 표시합니다. 신규 상점 방이나 배치 규칙을 추가하지 않습니다.</p>'),
    'retry-payment':()=>{state.status.result='normal';renderOne('result');}
  };
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
    const button=event.target.closest('[data-action]');if(button&&!button.disabled)actions[button.dataset.action]?.(button.dataset.id);
  });
  document.addEventListener('change',event=>{if(event.target.matches('[data-state]'))applyStatus(event.target.dataset.state,event.target.value);});
  $('#preview-size').addEventListener('change',event=>{state.size=Number(event.target.value);document.documentElement.style.setProperty('--phone-width',`${state.size}px`);});
  $('#reset-preview').addEventListener('click',()=>{reset();$('#preview-size').value='360';document.documentElement.style.setProperty('--phone-width','360px');renderAll();});
  $('#dialog-close').addEventListener('click',()=>$('#review-dialog').close());
  $('#review-dialog').addEventListener('click',event=>{if(event.target===$('#review-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  let joystick=null;
  document.addEventListener('pointerdown',event=>{const pad=event.target.closest('.joystick');if(!pad)return;joystick={pad,id:event.pointerId};pad.setPointerCapture(event.pointerId);event.preventDefault();});
  document.addEventListener('pointermove',event=>{if(!joystick||event.pointerId!==joystick.id)return;const r=joystick.pad.getBoundingClientRect(),dx=(event.clientX-r.x-r.width/2)*60/r.width,dy=(event.clientY-r.y-r.height/2)*60/r.height,ratio=Math.min(1,17/Math.max(1,Math.hypot(dx,dy)));joystick.pad.style.setProperty('--joy-x',`${dx*ratio}px`);joystick.pad.style.setProperty('--joy-y',`${dy*ratio}px`);});
  function releaseJoy(){if(!joystick)return;joystick.pad.style.removeProperty('--joy-x');joystick.pad.style.removeProperty('--joy-y');joystick=null;}
  document.addEventListener('pointerup',releaseJoy);document.addEventListener('pointercancel',releaseJoy);window.addEventListener('blur',releaseJoy);document.addEventListener('visibilitychange',releaseJoy);
  reset();renderAll();
})();
