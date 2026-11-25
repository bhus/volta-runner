// Progression, Upgrades (Volta Forge), Chamber Ranks, Feats & localStorage Persistence

export const UPGRADES = [
  {
    id: 'twin_buster',
    name: 'TWIN BUSTER',
    tag: 'MEGA MAN',
    color: '#60f0ff',
    desc: 'Fires dual-shot bursts & raises max Buster shots to 6',
  },
  {
    id: 'quick_charge',
    name: 'HYPER CHARGE',
    tag: 'MEGA MAN',
    color: '#2888ff',
    desc: 'Charge Shot charges 45% faster & deals +2 piercing damage',
  },
  {
    id: 'twin_axes',
    name: 'TWIN CONAN AXES',
    tag: 'CONAN',
    color: '#c848ff',
    desc: 'Throw 2 Boomerang Axes at once & +1 Axe damage',
  },
  {
    id: 'bolo_overdrive',
    name: 'BOLO OVERDRIVE',
    tag: 'BOLO',
    color: '#38e858',
    desc: 'Mortar costs 15 energy, +50% regen & larger blast radius',
  },
  {
    id: 'volta_boots',
    name: 'VOLTA BOOTS',
    tag: 'CONAN × MEGA',
    color: '#ffd830',
    desc: '+18% speed, higher jump & faster Mega Slide cooldown',
  },
  {
    id: 'titan_plating',
    name: 'TITAN PLATING',
    tag: 'BOLO',
    color: '#ff7828',
    desc: '+4 Max HP, heal +5 HP now & longer hit invulnerability',
  },
  {
    id: 'lode_master',
    name: 'LODE MASTER',
    tag: 'LODE RUNNER',
    color: '#d86838',
    desc: 'Dug pits last +2.5s longer; crushing foes heals +1 HP & +200 pts',
  },
  {
    id: 'vampiric_core',
    name: 'ENERGY SIPHON',
    tag: 'VOLTA',
    color: '#ff48a8',
    desc: 'Every 4th enemy defeated restores +1 HP & +30 Bolo Energy',
  },
];

export const FEATS = [
  { id: 'brick_crusher', name: 'BRICK CRUSHER', desc: 'Crush an enemy in a regenerating brick' },
  { id: 'wall_sniper', name: 'BOOMERANG MASTER', desc: 'Hit an enemy with a returning Conan Axe' },
  { id: 'demolitionist', name: 'BOLO DEMOLITION', desc: 'Blast 3+ bricks in one Bolo Mortar shot' },
  { id: 'untouchable', name: 'FLAWLESS RUNNER', desc: 'Clear a chamber without taking damage' },
  { id: 'combo_king', name: 'COMBO KING', desc: 'Reach a x5 style combo' },
  { id: 'volta_slayer', name: 'VOLTA SLAYER', desc: "Defeat Lord Volta's Bolo Mech" },
];

export function computeChamberRank(timeSec, damageTaken, maxCombo) {
  let pts = 0;
  if (damageTaken === 0) pts += 40;
  else if (damageTaken <= 2) pts += 25;
  else if (damageTaken <= 5) pts += 12;

  if (timeSec <= 35) pts += 35;
  else if (timeSec <= 55) pts += 25;
  else if (timeSec <= 80) pts += 15;
  else pts += 5;

  if (maxCombo >= 5) pts += 25;
  else if (maxCombo >= 3) pts += 15;
  else if (maxCombo >= 2) pts += 8;

  if (pts >= 85) return 'S';
  if (pts >= 65) return 'A';
  if (pts >= 45) return 'B';
  return 'C';
}

const RANK_ORDER = { C: 1, B: 2, A: 3, S: 4 };
const STORAGE_KEY = 'volta_runner_save_v1';

export class SaveStore {
  constructor() {
    this.data = this._load();
  }

  _default() {
    return {
      highScore: 0,
      bestLoop: 1,
      bestRanks: {}, // levelIndex -> 'S'|'A'|'B'|'C'
      feats: [],     // unlocked feat IDs
      runsPlayed: 0,
    };
  }

  _load() {
    try {
      if (typeof localStorage === 'undefined') return this._default();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this._default();
      return { ...this._default(), ...JSON.parse(raw) };
    } catch {
      return this._default();
    }
  }

  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // ignore storage quota / privacy mode errors
    }
  }

  recordScore(score, loop) {
    let changed = false;
    if (score > this.data.highScore) {
      this.data.highScore = score;
      changed = true;
    }
    if (loop > this.data.bestLoop) {
      this.data.bestLoop = loop;
      changed = true;
    }
    if (changed) this.save();
  }

  recordRank(levelIndex, rank) {
    const prev = this.data.bestRanks[levelIndex];
    if (!prev || RANK_ORDER[rank] > RANK_ORDER[prev]) {
      this.data.bestRanks[levelIndex] = rank;
      this.save();
    }
  }

  unlockFeat(id) {
    if (this.data.feats.includes(id)) return false;
    this.data.feats.push(id);
    this.save();
    return true;
  }

  hasFeat(id) {
    return this.data.feats.includes(id);
  }
}

export function rollUpgradeChoices(ownedSet, count = 3) {
  const pool = UPGRADES.filter((u) => !ownedSet.has(u.id));
  const source = pool.length >= count ? pool : [...UPGRADES];
  // Fisher-Yates shuffle copy
  const copy = [...source];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
