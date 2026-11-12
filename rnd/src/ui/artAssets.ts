import title from '../assets/fantasy-v2/title.png';
import dungeon from '../assets/fantasy-v2/dungeon.png';
import frame from '../assets/fantasy-v2/frame.png';
import mage from '../assets/fantasy-v2/mage.png';
import units from '../assets/units-v4/units-atlas.png';
import lobby from '../assets/lobby-v1/moonlit-castle.png';
import familiar from '../assets/lobby-v1/familiar.png';
import lobbyParty from '../assets/lobby-characters-v1/party-atlas.png';
import providedImage from '../assets/provided-v1/atlas.png';
import providedData from '../assets/provided-v1/atlas.json?url';

export const PROVIDED_ATLAS = { image:providedImage, data:providedData };

/** Project-local production art; URLs are fingerprinted by Vite in a build. */
export const ART_ASSETS = {
  art_title: title, art_lobby: lobby, art_lobby_familiar_source: familiar, art_lobby_party_source: lobbyParty,
  art_dungeon: dungeon, art_frame_source: frame, art_mage: mage, art_units_source: units
};
