// VOIDBLOOM — screenshot scenes.
// The entry's screenshots must be real renders of the game's own code, so
// the game can pose itself: ?shot=play&seed=7 builds a world, plays it
// forward with a scripted pilot for a few seconds of game time, freezes it
// mid-action and lets the normal renderer draw the frame. Every scene is
// deterministic — the same seed always poses the same frame.

import { World } from './world.js';
import { Random } from './random.js';
import { scriptedInput } from './input.js';

const silentSound = { play: () => {}, setIntensity: () => {} };

function nearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestDist = Infinity;
  for (const enemy of world.enemies) {
    const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

// Plays the world forward with a simple pilot: aim at the nearest enemy,
// keep a slow orbit around the arena centre, fire whenever an enemy lives.
function pilotRun(world, seconds, seed) {
  const input = scriptedInput({ firing: true });
  const pilot = new Random(seed * 31 + 5);
  const dt = 1 / 30;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    const target = nearestEnemy(world);
    if (target) {
      input.mouseX = target.x + pilot.range(-14, 14);
      input.mouseY = target.y + pilot.range(-14, 14);
    }
    const orbit = i / 30 + seed;
    input.moveAxis = () => ({ x: Math.cos(orbit * 0.7), y: Math.sin(orbit * 0.7) });
    world.update(dt, input);
    if (world.pendingLevelUps > 0) {
      world.applyUpgrade(world.upgradeChoices[0]);
    }
    if (!world.player.alive) break;
  }
  return input;
}

export function shotScene(name, seed) {
  if (name === 'start') {
    return { screen: 'title', world: new World(new Random(seed), silentSound), input: null };
  }
  const world = new World(new Random(seed), silentSound);
  world.startRun();
  if (name === 'play') {
    const input = pilotRun(world, 17, seed);
    // Pose a rich, readable action frame on top of the simulated one:
    // a ring of mixed shards closing in, bolts already in flight.
    if (!world.player.alive) {
      world.player.alive = true;
      world.playerDead = false;
    }
    const p = world.player;
    p.hp = Math.max(p.hp, 58);
    const ring = [
      ['shard', -190, -110], ['weaver', 210, -80], ['shard', 160, 130],
      ['bulwark', -230, 90], ['spitter', 40, -190], ['weaver', -90, 180],
      ['shard', 260, 40],
    ];
    for (const [kind, dx, dy] of ring) {
      const enemy = world.spawnEnemy(kind);
      enemy.x = Math.min(930, Math.max(30, p.x + dx));
      enemy.y = Math.min(510, Math.max(30, p.y + dy));
    }
    for (let i = 0; i < 5; i += 1) {
      const target = world.enemies[i % world.enemies.length];
      if (!target) break;
      const angle = Math.atan2(target.y - p.y, target.x - p.x);
      const travelled = 40 + i * 34;
      world.bolts.push({
        x: p.x + Math.cos(angle) * travelled,
        y: p.y + Math.sin(angle) * travelled,
        vx: Math.cos(angle) * 560,
        vy: Math.sin(angle) * 560,
        radius: 4,
        damage: p.damage,
        life: 0.8,
        dead: false,
      });
    }
    world.burst(p.x + 120, p.y - 70, '#c084fc', 16, 200);
    world.burst(p.x - 150, p.y + 60, '#f472b6', 12, 170);
    world.combo = 9;
    world.comboTimer = 2.2;
    world.shake = 0;
    return { screen: 'play', world, input };
  }
  if (name === 'upgrade') {
    const input = pilotRun(world, 9, seed);
    world.gainXp(world.player.xpNext + 1);
    world.shake = 0;
    input.mouseX = 480;
    input.mouseY = 290;
    return { screen: 'upgrade', world, input };
  }
  if (name === 'end') {
    const input = pilotRun(world, 22, seed);
    world.player.hp = 0;
    world.player.alive = false;
    world.playerDead = true;
    world.combo = 0;
    world.comboTimer = 0;
    world.burst(world.player.x, world.player.y, '#ffd166', 50, 300, 4);
    world.shake = 0;
    return { screen: 'gameover', world, input };
  }
  return null;
}
