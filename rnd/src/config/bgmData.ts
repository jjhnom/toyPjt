export const BGM_TRACKS = {
    bgm_lobby: { file: 'bgm_lobby_summoners_refuge.ogg', volume: .22 },
    bgm_battle: { file: 'bgm_battle_endless_expedition.ogg', volume: .17 },
    bgm_twilight: { file: 'bgm_boss_twilight_finale.ogg', volume: .15 }
} as const;
export type BgmKey = keyof typeof BGM_TRACKS;
export const BGM_FADE_MS = 600;
