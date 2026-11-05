# 판타지 리디자인 아트 v2

2026-11-05, 내장 `image_gen` 도구로 새로 생성한 프로젝트 전용 이미지. 외부 게임 자산을 사용하지 않았다. 원본 PNG와 투명 배경을 보존한다. 생성 경로에서 이 디렉터리로 복사했으며 Vite import로 빌드에 포함한다.

| 파일 | 실제 사용 |
| --- | --- |
| title.png | 타이틀·결과 화면 배경 |
| dungeon.png | 전투·정비 화면의 석재/이끼/횃불 던전 |
| frame.png | 버튼 프레임, BootScene에서 별도 9-slice 패널 생성 |
| mage.png | 소환사 런타임 스프라이트 원본 |
| archer.png | 기본/바람/관통 궁수 런타임 스프라이트 원본 |

프레임·캐릭터는 부팅 때만 런타임 텍스처로 준비하고 원본 GPU 텍스처를 해제한다. 캐릭터는 작은 논리 격자로 축소한 후 nearest로 확대하며 기존 프레임 크기·충돌·타이밍을 유지한다. 나머지 유닛/적은 기존 코드 기반 픽셀 아트다. 모든 유닛의 새 개별 아트/방향별 공격 애니메이션이 완료된 상태는 아니다.

## 생성 프롬프트 (최종 사용본)

### title.png

- 도구: 내장 image_gen
- 투명 배경: false

Create a production-ready background art asset for a portrait mobile pixel fantasy dungeon RPG, 9:16 composition, preferably 720x1280 or 1024x1792. Rich polished 32-bit pixel art with crisp pixel clusters, NOT crude flat rectangles, no blur, no photograph, no vector shapes, no text, no lettering, no UI, no buttons, no watermark. A mysterious ancient forest dungeon entrance, sculpted grey stone arch around a luminous violet magical portal, warm amber wall torches, dangling ivy, ferns, carved stone steps and misty blue-green masonry. Small adventurous purple-hatted mage and forest archer viewed from behind approaching the portal, charming detailed game sprites. Premium handcrafted pixel RPG aesthetic, a restrained palette of indigo, charcoal stone, moss green, antique gold and orange torchlight. Composition: upper 25 percent dark atmospheric space for the game's title overlay; glowing portal and characters form an arresting centerpiece between 28 and 60 percent height; lower 38 percent is dark unobstructed stone floor in deep navy with subtle vignette so real game menu buttons can be overlaid clearly. Decorative foliage and torchlight concentrated at the sides, center visually quiet. Full-bleed environment illustration, sophisticated pixel lighting, strong art direction. This is an actual game background texture, not a mockup poster.

### dungeon.png

- 도구: 내장 image_gen
- 투명 배경: false

Generate a production-ready top-down 2D dungeon arena background texture for a portrait mobile pixel art RPG, portrait aspect 592:920 (about 5:8), ideally 1024x1600. No text, no lettering, no UI, no characters, no enemies, no props or pillars inside the walkable center, no perspective or isometric camera. Match a polished detailed 32-bit pixel fantasy RPG: individually weathered grey-blue flagstones with subtle cracks, small irregular moss clusters between stones, a very faint engraved circular arcane seal in the center. The arena is rectangular. Thick sculpted stone perimeter masonry on all four sides with ornate columns only directly on the perimeter, warm orange wall torches at the four near-corners, rich green ivy and ferns hugging the perimeter. The central 80 percent must remain unobstructed, even-lit subdued floor for live gameplay sprites. Continuous wall perimeter, NO prepainted door openings or stairs or holes; actual game doors will be drawn on top at edge midpoints. Crisp visible pixel clusters, rich hand-painted pixel material detail, subtle depth and warm torch lighting. Game-ready texture with clearly darker edges, cooler readable center and no fake widgets. Not flat checkerboard squares, not a UI mockup.

### frame.png

- 도구: 내장 image_gen
- 투명 배경: true

Create ONE standalone reusable horizontal ornate fantasy RPG UI panel frame, transparent PNG outside the frame, a single object centered, wide aspect ratio 5:1, preferably 1280x256. No text, no lettering, no symbols resembling letters, no mockup, no other separate objects. Premium crisp pixel art: chunky double-beveled antique gold and bronze rails with sculpted curled corner ornaments, a small faceted violet gemstone centered on the upper rail, symmetrical subtle engraved flourishes, warm gold edge highlights. Deep opaque midnight navy-black matte interior fully empty for dynamically rendered game labels. Frame fills about 94 percent of canvas width and 80 percent of height, centered with transparent padding. Border corners have actual sculpted ornamental shape, not just a thin rectangular line. Material must look handcrafted as a polished mobile RPG inventory/button plaque with crisp pixel clusters, no blur or gradients. The empty center is uninterrupted dark navy. This asset will be scaled as a game panel or button; only one frame.

### mage.png

- 도구: 내장 image_gen
- 투명 배경: true

One standalone game character sprite on a genuinely transparent background. A charming chibi purple wizard for a top-down pixel fantasy RPG, shown front three-quarter facing right. Full body, large readable pointed purple hat with antique gold band and a bent tip, gold-trimmed violet robe and small cape, tan boots, wooden staff on the right topped by a bright cyan crystal, expressive visible face. Polished professional handcrafted 32-bit pixel sprite, 32x40 logical pixel grid scaled sharply, individual pixel clusters and thick dark silhouette outlines, no antialiasing, no blur, no painterly rendering. Soft tiny pixel oval shadow directly under the feet allowed. Center the single sprite with equal transparent margins, whole staff/hat/feet in frame. Square canvas, sprite uses about 78 percent of height and 65 percent of width. No text, no grid, no UI, no extra characters, no sprite sheet, no scenery. Distinct detailed costume and tiny highlights, matching a rich mossy dungeon pixel RPG.

### archer.png

- 도구: 내장 image_gen
- 투명 배경: true

One standalone full-body game character sprite on a genuinely transparent background. A charming chibi forest archer for a top-down pixel fantasy RPG, front three-quarter facing right. Green hood with one small gold feather, olive and emerald tunic, leather belt and boots, slim wooden curved bow held on the right and a quiver on the back, expressive visible face. Polished professional handcrafted 32-bit pixel sprite, 32x40 logical pixel grid scaled sharply, distinct pixel clusters, strong dark silhouette outlines, no antialiasing, no blur, no painterly rendering. A tiny pixel oval shadow under the feet is allowed. Center single sprite with equal transparent margins, full hood/bow/feet visible. Square canvas, sprite about 78 percent of height and 65 percent of width. No text, no UI, no grid, no multiple characters, no spritesheet, no scenery. Rich tiny material highlights, readable adventurer design to match a purple wizard in a detailed mossy dungeon RPG.

