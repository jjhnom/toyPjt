from pathlib import Path
import numpy as np, soundfile as sf, subprocess, json, shutil, zipfile
from scipy.signal import butter, sosfilt, lfilter
SR=44100
rng=np.random.default_rng(20261112)
root=Path('/mnt/data/rnd_phase2_sfx_v2')
out=root/'assets/audio/sfx';out.mkdir(parents=True,exist_ok=True)
def t(d): return np.arange(int(d*SR),dtype=np.float64)/SR
def env(d,a=.001,decay=.12,power=1.3):
 tt=t(d); return np.minimum(1,tt/max(a,1/SR))*np.exp(-((tt/max(decay,1e-5))**power))
def filt(y,lo=None,hi=None):
 if lo is not None and hi is not None: sos=butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos')
 elif lo: sos=butter(2,lo,btype='highpass',fs=SR,output='sos')
 elif hi: sos=butter(2,hi,btype='lowpass',fs=SR,output='sos')
 else:return y
 return sosfilt(sos,y)
def nz(d,lo=None,hi=None,decay=.12,a=.001,power=1.3):
 return filt(rng.standard_normal(len(t(d))),lo,hi)*env(d,a,decay,power)
def sine(d,f0,f1=None,decay=.12,attack=.001,curve=1.0,wave='sin'):
 tt=t(d);f1=f0 if f1 is None else f1
 f=f0*(max(f1,1)/max(f0,1))**(np.minimum(tt/max(d,1e-5),1)**curve)
 ph=2*np.pi*np.cumsum(f)/SR
 if wave=='tri': y=2/np.pi*np.arcsin(np.sin(ph))
 elif wave=='saw': y=2*((ph/(2*np.pi))%1)-1
 else:y=np.sin(ph)
 return y*env(d,attack,decay)
def partials(d, fundamentals, decay=.15,attack=.001):
 tt=t(d); y=np.zeros_like(tt)
 for freq,amp,tau in fundamentals:
  ph=2*np.pi*freq*tt
  y+=amp*np.sin(ph)*np.exp(-tt/tau)
 return y*np.minimum(1,tt/max(attack,1/SR))*env(d,.0001,decay*5,.9)
def blend(d,*parts):
 y=np.zeros(len(t(d)))
 for off,x,amp in parts:
  i=round(off*SR);n=min(len(x),len(y)-i)
  if n>0:y[i:i+n]+=x[:n]*amp
 return y
def echo(y,delay_ms=.06,amp=.2):
 z=y.copy(); sh=int(delay_ms*SR)
 for k in (1,2):
  if k*sh<len(y):z[k*sh:]+=amp**k*y[:-k*sh]
 return z
def repeat_burst(d,times,width,lo,hi,amp=.5):
 parts=[]
 for i,tm in enumerate(times):parts.append((tm,nz(width,lo,hi,decay=width*.17),amp*(.9**i)))
 return blend(d,*parts)
def save(name,y,target_rms=None,peak=.74):
 y=y-np.mean(y)
 # light softclip, preserve dynamics, avoid uniform perceived intensity
 y=np.tanh(1.1*y)/1.1
 fade=min(int(.007*SR),len(y)//8)
 y[:fade]*=np.linspace(0,1,fade);y[-fade:]*=np.linspace(1,0,fade)
 p=np.max(np.abs(y));y=y/max(p,1e-8)*peak
 # mono, 16bit; headroom is maintained at event mixer level
 sf.write(out/f'{name}.wav',y,SR,subtype='PCM_16')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(out/f'{name}.wav'),'-c:a','libvorbis','-q:a','5',str(out/f'{name}.ogg')],check=True)
 return {'id':name,'duration_s':round(len(y)/SR,3),'peak':round(float(np.max(abs(y))),3),'rms':round(float(np.sqrt(np.mean(y*y))),3),'wav':f'assets/audio/sfx/{name}.wav','ogg':f'assets/audio/sfx/{name}.ogg'}
S={}
def add(name,y,peak=.74):S[name]=save(name,y,peak=peak)
# Swings: short air movement with metallic contacts distinct from all other effects.
add('attack_sword_light', blend(.25,
 (0,nz(.16,1200,9000,decay=.038),.48),
 (.015,sine(.125,2350,560,decay=.055,wave='tri'),.34),
 (.073,partials(.16,[(1810,.48,.055),(2640,.22,.035),(3900,.12,.023)],.15),.34)),.62)
add('attack_sword_heavy',blend(.47,
 (0,nz(.32,250,3500,decay=.12),.42),
 (.029,sine(.32,170,55,decay=.20,wave='tri'),.76),
 (.074,partials(.32,[(430,.4,.16),(780,.34,.19),(1330,.22,.13),(2010,.13,.08)],.30),.63),
 (.095,nz(.19,700,5300,decay=.11),.14)),.79)
# Arrow: tight release, short flute-like flyby, narrow wooden impact.
add('attack_arrow',blend(.29,
 (0,partials(.12,[(160,.5,.028),(480,.24,.033),(860,.13,.023)],.11),.4),
 (.018,nz(.20,2900,9500,decay=.066),.27),
 (.018,sine(.18,1850,470,decay=.065),.19),
 (.12,nz(.09,370,2600,decay=.025),.13)),.61)
# mechanical rapid triple clacks with very short thump
add('attack_gun_burst',blend(.28,
 (0,repeat_burst(.27,[.0,.058,.116],.085,450,8400,.52),1),
 (0,sine(.145,120,64,decay=.066,wave='tri'),.38),
 (.057,sine(.14,135,70,decay=.065,wave='tri'),.30),
 (.116,sine(.14,110,55,decay=.075,wave='tri'),.36)),.67)
# Fire: fwoosh, unstable crackle, low energy tail
fire=blend(.52,(0,nz(.39,190,3300,decay=.19),.46),
 (.025,sine(.42,390,105,decay=.23,wave='saw'),.29),
 (.055,repeat_burst(.43,[.018,.065,.13,.23,.28],.045,1400,7500,.20),1),
 (.14,nz(.30,650,5200,decay=.15),.13))
add('attack_fire_magic',fire,.72)
# Ice: crystalline glass resonators and tinkling shards; minimal low-end
ice=blend(.57,(0,nz(.13,1800,10500,decay=.046),.25),
 (.014,partials(.44,[(990,.34,.29),(1481,.28,.22),(2242,.21,.20),(3200,.11,.12)],.42),.62),
 (.12,partials(.37,[(1270,.36,.21),(1890,.22,.22),(2800,.13,.12)],.38),.45),
 (.20,nz(.28,4200,14000,decay=.12),.12))
add('attack_ice_magic',echo(ice,95,.12),.68)
# Lightning: sharp staccato with irregular crackling, not a single long noise sweep
light=blend(.48,(0,repeat_burst(.45,[0,.031,.094,.126,.2],.06,1400,11500,.57),1),
 (.01,sine(.15,2100,125,decay=.07,wave='saw'),.32),
 (.07,sine(.13,1350,200,decay=.055,wave='tri'),.19),
 (.16,nz(.18,2600,12000,decay=.072),.14))
add('attack_lightning',light,.76)
# Hits: give flesh a short dull knock; metal uses ringing and critical uses distinct transient/pitch drop
add('hit_flesh_light',blend(.18,(0,nz(.085,120,1300,decay=.023),.38),
 (.004,sine(.12,180,72,decay=.054),.54),
 (.012,nz(.09,750,2300,decay=.027),.14)),.57)
add('hit_armor',blend(.38,(0,nz(.11,950,7700,decay=.038),.42),
 (.007,partials(.34,[(480,.22,.12),(910,.38,.23),(1435,.29,.19),(2460,.17,.15)],.34),.75),
 (.014,sine(.21,200,85,decay=.1),.18)),.72)
add('hit_critical',echo(blend(.54,(0,nz(.18,450,11000,decay=.065),.68),
 (.009,sine(.28,250,48,decay=.155,wave='tri'),.88),
 (.023,partials(.35,[(520,.23,.2),(1040,.2,.16),(1850,.18,.11)],.34),.34),
 (.087,nz(.13,2700,10000,decay=.043),.22)),82,.12),.83)
add('hit_shield_block',blend(.34,(0,nz(.10,1700,11000,decay=.032),.37),
 (.009,partials(.30,[(740,.33,.16),(1160,.31,.21),(2020,.19,.11)],.30),.65),
 (.012,sine(.18,390,135,decay=.065),.29)),.67)
# Deaths: avoid same rising/dropping synth in every variant, convey size and creature type
add('death_enemy_small',blend(.32,(0,nz(.17,120,2200,decay=.064),.34),
 (.007,sine(.27,330,100,decay=.12,wave='tri'),.43),
 (.04,nz(.19,450,3500,decay=.08),.15)),.56)
add('death_enemy_medium',blend(.57,(0,nz(.26,110,2600,decay=.105),.42),
 (.016,sine(.43,240,49,decay=.225,wave='tri'),.68),
 (.075,repeat_burst(.4,[0,.09,.16],.13,360,4500,.2),1)),.72)
add('death_enemy_elite',echo(blend(.88,
 (0,nz(.45,100,4600,decay=.17),.53),
 (.022,sine(.56,165,32,decay=.36,wave='tri'),.9),
 (.067,partials(.55,[(410,.28,.24),(670,.26,.3),(1010,.15,.21)],.54),.32),
 (.20,repeat_burst(.46,[0,.10,.19],.18,300,5000,.24),1)),140,.18),.86)
magic=blend(.78,(0,nz(.21,2500,12000,decay=.095),.34),
 (.005,partials(.66,[(980,.37,.25),(1480,.23,.28),(2220,.27,.21),(3130,.12,.14)],.65),.56),
 (.11,sine(.47,1050,240,decay=.29),.24),
 (.16,nz(.46,1000,6500,decay=.18),.16))
add('death_enemy_magic',echo(magic,117,.24),.69)
# preview with 1s silence between. Progressive order by category.
order=list(S)
preview=np.array([],dtype=np.float64)
for name in order:
 y,s=sf.read(out/f'{name}.wav');preview=np.concatenate([preview,y,np.zeros(round(.57*SR))])
sf.write(root/'phase2_v2_all_sfx_preview.wav',preview,SR,subtype='PCM_16')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(root/'phase2_v2_all_sfx_preview.wav'),'-c:a','libvorbis','-q:a','5',str(root/'phase2_v2_all_sfx_preview.ogg')],check=True)
(root/'manifest.json').write_text(json.dumps(list(S.values()),ensure_ascii=False,indent=2),encoding='utf8')
(root/'README.md').write_text('''# rnd / 2단계 전투 사운드 v2 (개선판)\n\n총 15종의 **새로 합성한** WAV/OGG 게임 효과음. Phaser 3 + Capacitor 기준. 이전 버전의 무음과 오실레이터 합성음을 대체할 수 있도록 기존 15개 ID 유지.\n\n## 주요 개선점\n- 기존: 여러 샘플이 동일한 노이즈 + 단순한 하강 주파수 + 일률적인 피크 노멀라이즈로 비슷한 음색이 나기 쉬웠음.\n- 개선: 검(금속 공명과 공기 가르기), 활(짧은 시위/비행음), 총(3연발 기계음), 화염(난류/불꽃), 얼음(유리 공명), 번개(불규칙 파열) 등 별도 음색 설계.\n- 피격: 둔탁한 살점 타격 / 금속 충격 / 저음 강화 크리티컬 / 방패 차단음 분리.\n- 사망: 소형은 짧고, 중형은 묵직하게, 엘리트는 긴 충격과 잔향, 마법형은 맑은 소멸음.\n- 크리티컬·엘리트 등 중요한 이벤트를 강하게, 일반 공격은 낮은 강도로 상대적 다이내믹을 줌.\n\n## 구성 및 설치\n- `assets/audio/sfx/*.ogg`: 게임 런타임 권장(이전 15개와 같은 이름)\n- `assets/audio/sfx/*.wav`: 편집용 원본\n- `phase2_v2_all_sfx_preview.ogg`: 모든 효과음 순서대로 듣기(사이 공백 0.57초)\n- `manifest.json`: 재생 길이와 레벨 정보\n- `tools/generate_sfx_v2.py`: 재생성 가능한 원본 합성 코드\n\n복사할 위치: `rnd/public/audio/sfx/` 에 OGG 15개 배치. 파일 경로는 `/audio/sfx/<id>.ogg`.\n\n## 개별 파일 및 권장 연결\n\n| ID | 상황 | 권장 재생 게인 |\n|---|---|---:|\n| attack_sword_light | 빠른 근접 공격 | 0.20 |\n| attack_sword_heavy | 중량 근접 공격 | 0.28 |\n| attack_arrow | 활/투사체 발사 | 0.20 |\n| attack_gun_burst | 기계/개틀링 | 0.18 |\n| attack_fire_magic | 화염 공격 | 0.25 |\n| attack_ice_magic | 빙결 공격 | 0.22 |\n| attack_lightning | 번개 공격 | 0.22 |\n| hit_flesh_light | 일반 피격 | 0.19 |\n| hit_armor | 중장갑 피격 | 0.22 |\n| hit_critical | 크리티컬 타격 | 0.38 |\n| hit_shield_block | 방패 막기 | 0.22 |\n| death_enemy_small | 소형 몬스터 처치 | 0.17 |\n| death_enemy_medium | 중형 몬스터 처치 | 0.21 |\n| death_enemy_elite | 엘리트 처치 | 0.48 |\n| death_enemy_magic | 마법형 몬스터 처치 | 0.25 |\n\n게인은 **권장 시작값**이며 SoundManager 마스터 음량·동시 재생 제한·실제 게임 기기 테스트에 따라 조정해야 함. 공격마다 모두 재생할 경우 일반 발사는 throttle 40ms, 일반 피격 60ms, 사망은 별도 우선순위 적용 권장.\n\n## 적용 주의\n- 현재 파일은 사운드 자산만 포함. 실제 `SoundManager.ts` 소스 코드를 변경하지 않았음.\n- `WeaponComponent.ts`: unit type/attack type에 따라 공격 ID 매핑.\n- `GameScene.ts`: 피격 이벤트에서 일반/방어/크리티컬 분기; 사망 이벤트에서 몬스터 종류에 따라 분기.\n- `BootScene.ts`: 오디오 preload 등록. 모바일에서는 사용자 탭 이후 재생 허용 처리.\n- 기기에서 헤드폰과 내장 스피커 모두 테스트하고, 다수의 적이 동시에 피격할 때 레벨을 확인할 것.\n\n## 검증\n- 각 파일의 시작/끝 클릭 노이즈 없는지\n- 전투 30초 연속 플레이에서 소리 뭉침 없는지\n- 크리티컬과 엘리트 처치가 일반 타격보다 충분히 강조되는지\n- Android WebView 앱 배경/복귀 후 무음 문제 없는지\n''',encoding='utf8')
shutil.copy(__file__,root/'tools/generate_sfx_v2.py')
zip_path=Path('/mnt/data/rnd_phase2_combat_sfx_v2.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(root))
print('CREATED',zip_path,zip_path.stat().st_size,'sounds',len(S));print([(n,round(v['rms'],3)) for n,v in S.items()])
