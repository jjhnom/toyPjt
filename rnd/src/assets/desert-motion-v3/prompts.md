# Image generation prompts

Built-in `image_gen`, transparent_background=true. Reference: `artifacts/desert-emperor-20261113/character-contact.png`. No CLI fallback.

## Initial generation

Use case: stylized-concept. Create a production-ready pixel-art RPG sprite sheet, 16 sequential full-body attack animation frames of the EXACT same Desert Emperor character as the reference. The reference is identity/style only: golden Egyptian jackal/falcon headdress, blue gemstone details, dark navy robe, torn sand-gold cape streaming LEFT, tall gold staff with circular turquoise sun gem in RIGHT hand. Same right-facing three-quarter view throughout, same proportions, same scale and silhouette as reference. TRUE TRANSPARENT background; no text, labels, grid lines, floor, shadows, or other characters. Arrange exactly 4 columns by 4 rows in equal square cells. Keep all body and staff within each cell, generous padding, feet anchored at the SAME height, staff and torso consistently aligned. Read left-to-right, top-to-bottom. First 8 frames are slow anticipation/windup: idle balanced stance, slight weight shift and robe follow-through, left arm lifts gradually, staff gradually raises/tilts slightly, shoulders ease into a held charged pose in frames 7 and 8. Next 8 frames are release AND recovery: staff pushes forward (frame9 is immediate cast onset,10 strongest extension), small golden light around staff gem only, cape follows motion with 1-2 frame delay, staff and left hand retract progressively, torso settles and cape eases back, frame16 exactly matches frame1 idle. No giant effects or sand tornado covering the body. Every adjacent frame must be a distinct natural small step in the animation, no duplicates, no abrupt jumps, no character redesign, no perspective changes, no global rotation, no zoom. Crisp readable pixel clusters and detailed warm gold highlights, matching existing pixel art rather than smooth vector/cartoon. Only the sprite animation sheet.

## Cleanup pass

Reference/edit target: `sources/attack-generated.png`.

Precise sprite-sheet cleanup. Keep the SAME 16 character poses and animation sequence, same pixel-art gold/blue desert emperor, same 4x4 layout. Remove ALL bright red speckled noise completely; there must be ZERO red background pixels, no matte of any color, no checkered background. The background must be clean fully transparent alpha, including between arms/staff/cape. Preserve character pixels and subtle golden staff light only. Make a clean square sprite sheet with precisely 4 equal columns by 4 equal rows. Each full character completely inside its cell with padding and same anchored feet height. No text, no grid lines. Make first and last pose match for smooth return to idle.

The generated result still contained red matte remnants. The deterministic build step removes these pixels and disconnected background components; original outputs remain preserved.
