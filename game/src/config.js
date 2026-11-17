// VOIDBLOOM — tuning constants.
// Every number that shapes how the game feels lives here, so the world's
// simulation code stays readable and the balance can be adjusted in one place.

export const VIEW = {
  width: 960,
  height: 540,
};

export const COLORS = {
  voidTop: '#070312',
  voidBottom: '#120826',
  nebulaA: 'rgba(88, 28, 160, 0.20)',
  nebulaB: 'rgba(14, 116, 144, 0.16)',
  nebulaC: 'rgba(190, 24, 93, 0.10)',
  player: '#ffd166',
  playerCore: '#fff3d6',
  playerRing: '#f59e0b',
  bolt: '#a5f3fc',
  boltCore: '#ecfeff',
  xp: '#4ade80',
  heart: '#fb7185',
  textMain: '#f8fafc',
  textDim: '#94a3b8',
  panelFill: 'rgba(10, 6, 24, 0.82)',
  panelEdge: 'rgba(167, 139, 250, 0.55)',
};

export const PLAYER = {
  radius: 14,
  baseSpeed: 235,
  baseHp: 100,
  baseDamage: 12,
  baseFireRate: 4.2, // bolts per second
  baseProjectiles: 1,
  boltSpeed: 560,
  boltRadius: 4,
  boltLife: 0.9,
  dashTime: 0.16,
  dashSpeed: 1150,
  dashCooldown: 2.4,
  magnetRadius: 74,
  pickupRadius: 22,
  invulnerableTime: 0.6,
};

export const ENEMY_KINDS = {
  shard: {
    radius: 13,
    hp: 22,
    speed: 92,
    damage: 10,
    xp: 1,
    score: 25,
    color: '#c084fc',
  },
  weaver: {
    radius: 12,
    hp: 16,
    speed: 118,
    damage: 8,
    xp: 1,
    score: 35,
    color: '#f472b6',
  },
  bulwark: {
    radius: 26,
    hp: 95,
    speed: 44,
    damage: 18,
    xp: 4,
    score: 90,
    color: '#818cf8',
  },
  spitter: {
    radius: 14,
    hp: 30,
    speed: 66,
    damage: 8,
    xp: 2,
    score: 60,
    color: '#34d399',
  },
  boss: {
    radius: 46,
    hp: 620,
    speed: 34,
    damage: 24,
    xp: 25,
    score: 1500,
    color: '#f43f5e',
  },
};

export const WAVES = {
  firstDelay: 1.2,
  betweenWaves: 3.2,
  bossEvery: 5,
  victoryWave: 10,
  // Spawn budget grows each wave; the director spends it on enemy kinds.
  budgetBase: 6,
  budgetPerWave: 3.4,
  spawnIntervalBase: 1.05,
  spawnIntervalMin: 0.34,
  hpScalePerWave: 0.16,
  speedScalePerWave: 0.012,
};

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Hotter Bloom',
    blurb: '+22% bolt damage',
    apply: (p) => { p.damage *= 1.22; },
  },
  {
    id: 'firerate',
    name: 'Rapid Petals',
    blurb: '+18% fire rate',
    apply: (p) => { p.fireRate *= 1.18; },
  },
  {
    id: 'multishot',
    name: 'Twin Bloom',
    blurb: '+1 projectile (max 5)',
    apply: (p) => { p.projectiles = Math.min(5, p.projectiles + 1); },
  },
  {
    id: 'speed',
    name: 'Solar Wind',
    blurb: '+10% move speed',
    apply: (p) => { p.speed *= 1.10; },
  },
  {
    id: 'vitality',
    name: 'Deep Roots',
    blurb: '+25 max HP and heal 25',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet',
    name: 'Wide Pollen',
    blurb: '+45% XP magnet radius',
    apply: (p) => { p.magnetRadius *= 1.45; },
  },
  {
    id: 'dash',
    name: 'Quick Phase',
    blurb: '-25% dash cooldown',
    apply: (p) => { p.dashCooldown *= 0.75; },
  },
  {
    id: 'regen',
    name: 'Photosynthesis',
    blurb: 'Regenerate +0.7 HP/s',
    apply: (p) => { p.regen += 0.7; },
  },
];

export const XP_CURVE = {
  base: 5,
  growth: 1.42,
};

export const STORAGE_KEY = 'voidbloom-best-score';
