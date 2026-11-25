export const TILE_SIZE = 32;
export const GRID_COLS = 25;
export const GRID_ROWS = 15;
export const HUD_HEIGHT = 44;
export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE; // 800
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE + HUD_HEIGHT; // 524

export const TILE = {
  EMPTY: 0,
  BRICK: 1,       // Lode Runner diggable & regenerable brick
  STONE: 2,       // Indestructible Conan dungeon stone
  LADDER: 3,      // Climbable ladder
  ROPE: 4,        // Lode Runner monkey bar / rope
  LAVA: 5,        // Conan deadly lava/acid pit
  VOLTA: 6,       // Periodic Volta lightning coil
  PORTAL: 7,      // Escape portal (activates when all gold collected)
};

export const PALETTE = {
  bg: '#090a14',
  bgGrad: '#121024',
  // Apple II Hi-Res inspired accents + NES Mega Man vibrancy
  appleGreen: '#38e858',
  appleViolet: '#c848ff',
  appleOrange: '#ff7828',
  appleCyan: '#28d8ff',
  megaBlue: '#2888ff',
  megaCyan: '#60f0ff',
  gold: '#ffd830',
  goldBright: '#fff4a0',
  brick: '#a84428',
  brickHi: '#d86838',
  brickDark: '#5c2014',
  stone: '#4c5268',
  stoneHi: '#747c98',
  stoneDark: '#262a38',
  lava: '#ff3818',
  lavaGlow: '#ffaa20',
  crimson: '#ff2848',
  white: '#f4f6ff',
  steel: '#8894a8',
  tankGreen: '#48a848',
  tankDark: '#245828',
};

export const PHYSICS = {
  GRAVITY: 1180,
  MAX_FALL: 540,
  MOVE_SPEED: 195,
  CLIMB_SPEED: 145,
  ROPE_SPEED: 165,
  JUMP_VEL: -445,
  SLIDE_SPEED: 350,
  SLIDE_DURATION: 0.28,
  SLIDE_COOLDOWN: 0.45,
  BRICK_REGEN_TIME: 5.5,
  BRICK_WARN_TIME: 1.4,
  CHARGE_TIME: 0.65,
  MAX_BUSTER_SHOTS: 4,
  BOLO_MAX_ENERGY: 100,
  BOLO_COST: 25,
  BOLO_REGEN_RATE: 9, // per second
};
