/** Lobby-only art; combat textures and the 22-unit atlas keep their existing contracts. */
export const LOBBY_CHARACTER_CELL = 256;
export const LOBBY_CHARACTER_COLUMNS = 3;
export const LOBBY_CHARACTER_FRAMES = {
  summoner: 0, knight: 1, archer: 2, healer: 3, fireMage: 4
} as const;
export type LobbyCharacter = keyof typeof LOBBY_CHARACTER_FRAMES;
export const lobbyCharacterPortrait = (role: LobbyCharacter): string => `portrait_lobby_${role}`;
