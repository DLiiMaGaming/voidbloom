// VOIDBLOOM — the simulation.
// The World owns every entity and rule: the player bloom, enemy shards,
// bolts, gems, particles and the wave director. It knows nothing about
// pixels (render.js draws it) and nothing about screens (main.js switches
// between title, play, upgrade and game over by reading its flags).

import { ENEMY_KINDS, PLAYER, UPGRADES, VIEW, WAVES, XP_CURVE } from './config.js';

const TAU = Math.PI * 2;

function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export class World {
  constructor(random, sound) {
    this.random = random;
    this.sound = sound;
    this.reset();
  }

  reset() {
    this.player = null;
    this.enemies = [];
    this.bolts = [];
    this.orbs = [];
    this.gems = [];
    this.particles = [];
    this.texts = [];
    this.wave = 0;
    this.phase = 'idle'; // idle | announce | active | intermission
    this.phaseTimer = 0;
    this.spawnBudget = 0;
    this.spawnTimer = 0;
    this.boss = null;
    this.bossSummoned = false;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.shake = 0;
    this.playerDead = false;
    this.victory = false;
    this.endless = false;
    this.pendingLevelUps = 0;
    this.upgradeChoices = [];
    this.intensity = 0; // 0..1, drives the music pad
  }

  startRun() {
    this.reset();
    const p = {
      x: VIEW.width / 2,
      y: VIEW.height / 2,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      hp: PLAYER.baseHp,
      maxHp: PLAYER.baseHp,
      speed: PLAYER.baseSpeed,
      damage: PLAYER.baseDamage,
      fireRate: PLAYER.baseFireRate,
      projectiles: PLAYER.baseProjectiles,
      fireCooldown: 0,
      dashCooldown: PLAYER.dashCooldown,
      dashCooldownLeft: 0,
      dashTimeLeft: 0,
      dashDirX: 1,
      dashDirY: 0,
      invulnLeft: 0,
      magnetRadius: PLAYER.magnetRadius,
      regen: 0,
      level: 1,
      xp: 0,
      xpNext: XP_CURVE.base,
      alive: true,
    };
    this.player = p;
    this.beginWave(1);
  }

  // --- waves -------------------------------------------------------------

  beginWave(wave) {
    this.wave = wave;
    this.phase = 'announce';
    this.phaseTimer = 1.6;
    this.spawnBudget = Math.round(WAVES.budgetBase + WAVES.budgetPerWave * (wave - 1));
    this.spawnTimer = WAVES.firstDelay;
    this.bossSummoned = false;
    if (wave % WAVES.bossEvery === 0) this.sound.play('boss');
  }

  get isBossWave() {
    return this.wave % WAVES.bossEvery === 0 && this.wave > 0;
  }

  spawnPoint() {
    // A point on a random edge, never close to the player.
    const p = this.player;
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = this.random.int(0, 3);
      const x = edge === 0 ? -30 : edge === 1 ? VIEW.width + 30 : this.random.range(0, VIEW.width);
      const y = edge === 2 ? -30 : edge === 3 ? VIEW.height + 30 : this.random.range(0, VIEW.height);
      if (!p || distanceSq(x, y, p.x, p.y) > 200 * 200) return { x, y };
    }
    return { x: -30, y: -30 };
  }

  spawnEnemy(kind) {
    const spec = ENEMY_KINDS[kind];
    const { x, y } = this.spawnPoint();
    const hpScale = 1 + WAVES.hpScalePerWave * (this.wave - 1);
    const speedScale = Math.min(1.5, 1 + WAVES.speedScalePerWave * (this.wave - 1));
    const enemy = {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      hp: spec.hp * hpScale,
      maxHp: spec.hp * hpScale,
      speed: spec.speed * speedScale * this.random.range(0.9, 1.1),
      damage: spec.damage,
      xp: spec.xp,
      score: spec.score,
      color: spec.color,
      angle: this.random.angle(),
      spin: this.random.range(-1.4, 1.4),
      wobble: this.random.range(0, TAU),
      fireTimer: this.random.range(1.2, 2.4),
      burstTimer: 2.8,
      flash: 0,
      dead: false,
    };
    this.enemies.push(enemy);
    if (kind === 'boss') {
      this.boss = enemy;
      this.bossSummoned = true;
    }
    return enemy;
  }

  directorTick(dt) {
    if (this.phase === 'announce') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phase = 'active';
      return;
    }
    if (this.phase === 'intermission') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.beginWave(this.wave + 1);
      return;
    }
    if (this.phase !== 'active') return;

    if (this.isBossWave && !this.bossSummoned) {
      this.spawnEnemy('boss');
      this.spawnBudget = Math.floor(this.spawnBudget * 0.4);
    }
    if (this.spawnBudget > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const interval = Math.max(
          WAVES.spawnIntervalMin,
          WAVES.spawnIntervalBase - this.wave * 0.05,
        );
        this.spawnTimer = interval * this.random.range(0.7, 1.2);
        const roll = this.random.next();
        let kind = 'shard';
        if (this.wave >= 2 && roll > 0.86) kind = 'bulwark';
        else if (this.wave >= 3 && roll > 0.68) kind = 'spitter';
        else if (roll > 0.42) kind = 'weaver';
        const cost = kind === 'bulwark' ? 3 : kind === 'spitter' ? 2 : 1;
        if (cost <= this.spawnBudget) {
          this.spawnEnemy(kind);
          this.spawnBudget -= cost;
        } else {
          this.spawnEnemy('shard');
          this.spawnBudget -= 1;
        }
      }
    } else if (this.enemies.length === 0) {
      if (this.wave === WAVES.victoryWave && !this.endless) {
        this.victory = true;
        this.sound.play('victory');
      }
      this.phase = 'intermission';
      this.phaseTimer = WAVES.betweenWaves;
    }
  }

  continueEndless() {
    this.endless = true;
    this.victory = false;
    this.phase = 'intermission';
    this.phaseTimer = 1.2;
  }

  // --- combat ------------------------------------------------------------

  fireBolts() {
    const p = this.player;
    const aimAngle = Math.atan2(this.aimY - p.y, this.aimX - p.x);
    const count = p.projectiles;
    const spreadStep = 0.085;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spreadStep;
      const angle = aimAngle + offset + this.random.range(-0.012, 0.012);
      this.bolts.push({
        x: p.x + Math.cos(aimAngle) * (p.radius + 6),
        y: p.y + Math.sin(aimAngle) * (p.radius + 6),
        vx: Math.cos(angle) * PLAYER.boltSpeed,
        vy: Math.sin(angle) * PLAYER.boltSpeed,
        radius: PLAYER.boltRadius,
        damage: p.damage,
        life: PLAYER.boltLife,
        dead: false,
      });
    }
    this.sound.play('shoot');
  }

  burst(x, y, color, count, speed, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.random.angle();
      const v = this.random.range(speed * 0.25, speed);
      const life = this.random.range(0.3, 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life,
        maxLife: life,
        size: this.random.range(size * 0.5, size * 1.4),
        color,
        drag: 3.2,
      });
    }
  }

  addText(x, y, text, color, size = 13) {
    this.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    enemy.flash = 0.09;
    this.sound.play('hit');
    if (enemy.hp <= 0 && !enemy.dead) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    enemy.dead = true;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 2.5;
    const multiplier = 1 + Math.min(this.combo, 40) * 0.05;
    const gained = Math.round(enemy.score * multiplier);
    this.score += gained;
    this.burst(enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 60 : 14, enemy.kind === 'boss' ? 320 : 210);
    this.addText(enemy.x, enemy.y - enemy.radius, `+${gained}`, '#fef08a', enemy.kind === 'boss' ? 22 : 13);
    this.shake = Math.min(14, this.shake + (enemy.kind === 'boss' ? 12 : enemy.kind === 'bulwark' ? 5 : 2));
    this.sound.play(enemy.kind === 'boss' || enemy.kind === 'bulwark' ? 'explodeBig' : 'explode');
    if (enemy.kind === 'bulwark') {
      for (let i = 0; i < 2; i += 1) {
        const child = this.spawnEnemy('shard');
        child.x = enemy.x + this.random.range(-14, 14);
        child.y = enemy.y + this.random.range(-14, 14);
      }
    }
    if (enemy.kind === 'boss') this.boss = null;
    const gemCount = enemy.kind === 'boss' ? 14 : enemy.xp;
    for (let i = 0; i < gemCount; i += 1) {
      const angle = this.random.angle();
      const v = this.random.range(30, 130);
      this.gems.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        value: 1,
        radius: 5,
        magnetized: false,
      });
    }
    if (enemy.kind !== 'boss' && this.random.chance(0.05)) {
      this.gems.push({
        x: enemy.x,
        y: enemy.y,
        vx: 0,
        vy: 0,
        value: 0,
        radius: 7,
        heart: true,
        magnetized: false,
      });
    }
  }

  hurtPlayer(amount) {
    const p = this.player;
    if (!p.alive || p.invulnLeft > 0 || p.dashTimeLeft > 0) return;
    p.hp -= amount;
    p.invulnLeft = PLAYER.invulnerableTime;
    this.shake = Math.min(16, this.shake + 7);
    this.burst(p.x, p.y, '#fb7185', 12, 190);
    this.sound.play('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      this.playerDead = true;
      this.burst(p.x, p.y, '#ffd166', 70, 340, 4);
      this.burst(p.x, p.y, '#f59e0b', 40, 220, 3);
      this.shake = 18;
      this.sound.play('explodeBig');
      this.sound.play('gameover');
    }
  }

  gainXp(amount) {
    const p = this.player;
    p.xp += amount;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = Math.round(XP_CURVE.base * Math.pow(XP_CURVE.growth, p.level - 1));
      this.pendingLevelUps += 1;
    }
    if (this.pendingLevelUps > 0 && this.upgradeChoices.length === 0) {
      this.rollUpgrades();
      this.sound.play('levelup');
    }
  }

  rollUpgrades() {
    const pool = [...UPGRADES];
    this.upgradeChoices = [];
    for (let i = 0; i < 3 && pool.length > 0; i += 1) {
      const index = this.random.int(0, pool.length - 1);
      this.upgradeChoices.push(pool.splice(index, 1)[0]);
    }
  }

  applyUpgrade(upgrade) {
    upgrade.apply(this.player);
    this.pendingLevelUps -= 1;
    this.upgradeChoices = [];
    this.sound.play('choose');
    if (this.pendingLevelUps > 0) this.rollUpgrades();
  }

  // --- per-frame update ----------------------------------------------------

  update(dt, input) {
    if (!this.player) return;
    this.elapsed += dt;
    this.aimX = input.mouseX;
    this.aimY = input.mouseY;
    this.directorTick(dt);
    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateBolts(dt);
    this.updateOrbs(dt);
    this.updateGems(dt);
    this.updateParticles(dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - dt * 26);
    const target = Math.min(1, this.enemies.length / 14 + (this.boss ? 0.4 : 0));
    this.intensity += (target - this.intensity) * Math.min(1, dt * 2);
  }

  updatePlayer(dt, input) {
    const p = this.player;
    if (!p.alive) return;
    const axis = input.moveAxis();
    const length = Math.hypot(axis.x, axis.y) || 1;
    const moveX = (axis.x / length) * (axis.x !== 0 || axis.y !== 0 ? 1 : 0);
    const moveY = (axis.y / length) * (axis.x !== 0 || axis.y !== 0 ? 1 : 0);

    p.dashCooldownLeft = Math.max(0, p.dashCooldownLeft - dt);
    p.invulnLeft = Math.max(0, p.invulnLeft - dt);
    if (input.dashPressed() && p.dashCooldownLeft <= 0 && p.dashTimeLeft <= 0) {
      const dirX = moveX !== 0 || moveY !== 0 ? moveX : Math.cos(Math.atan2(this.aimY - p.y, this.aimX - p.x));
      const dirY = moveX !== 0 || moveY !== 0 ? moveY : Math.sin(Math.atan2(this.aimY - p.y, this.aimX - p.x));
      p.dashDirX = dirX;
      p.dashDirY = dirY;
      p.dashTimeLeft = PLAYER.dashTime;
      p.dashCooldownLeft = p.dashCooldown;
      this.sound.play('dash');
    }
    if (p.dashTimeLeft > 0) {
      p.dashTimeLeft -= dt;
      p.vx = p.dashDirX * PLAYER.dashSpeed;
      p.vy = p.dashDirY * PLAYER.dashSpeed;
      this.particles.push({
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        life: 0.3,
        maxLife: 0.3,
        size: p.radius * 0.9,
        color: 'rgba(255, 209, 102, 0.5)',
        drag: 0,
      });
    } else {
      p.vx = moveX * p.speed;
      p.vy = moveY * p.speed;
    }
    p.x = Math.min(VIEW.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
    p.y = Math.min(VIEW.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    p.fireCooldown -= dt;
    if (input.firing() && p.fireCooldown <= 0) {
      this.fireBolts();
      p.fireCooldown = Math.max(p.fireCooldown + 1 / p.fireRate, -0.05);
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const enemy of this.enemies) {
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.angle += enemy.spin * dt;
      enemy.wobble += dt * 3;
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const towardX = dx / dist;
      const towardY = dy / dist;
      let wantX = towardX;
      let wantY = towardY;
      if (enemy.kind === 'weaver') {
        const strafe = Math.sin(enemy.wobble) * 0.9;
        wantX = towardX + -towardY * strafe;
        wantY = towardY + towardX * strafe;
      } else if (enemy.kind === 'spitter') {
        if (dist < 230) { wantX = -towardX; wantY = -towardY; }
        else if (dist < 300) { wantX = -towardY; wantY = towardX; }
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && dist < 430 && p.alive) {
          enemy.fireTimer = 2.3;
          this.orbs.push({
            x: enemy.x,
            y: enemy.y,
            vx: towardX * 215,
            vy: towardY * 215,
            radius: 5,
            damage: 12,
            life: 3.2,
            dead: false,
          });
        }
      } else if (enemy.kind === 'boss') {
        enemy.burstTimer -= dt;
        if (enemy.burstTimer <= 0 && p.alive) {
          enemy.burstTimer = 3.1;
          const base = this.random.angle();
          for (let i = 0; i < 14; i += 1) {
            const angle = base + (i / 14) * TAU;
            this.orbs.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle) * 165,
              vy: Math.sin(angle) * 165,
              radius: 5,
              damage: 14,
              life: 3.6,
              dead: false,
            });
          }
          this.sound.play('explode');
        }
        if (!enemy.summonedAdds && enemy.hp < enemy.maxHp * 0.5) {
          enemy.summonedAdds = true;
          for (let i = 0; i < 3; i += 1) {
            const add = this.spawnEnemy('shard');
            add.x = enemy.x + this.random.range(-60, 60);
            add.y = enemy.y + this.random.range(-60, 60);
          }
        }
      }
      const wantLength = Math.hypot(wantX, wantY) || 1;
      enemy.vx = (wantX / wantLength) * enemy.speed;
      enemy.vy = (wantY / wantLength) * enemy.speed;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (p.alive && distanceSq(enemy.x, enemy.y, p.x, p.y) < Math.pow(enemy.radius + p.radius - 2, 2)) {
        this.hurtPlayer(enemy.damage);
      }
    }
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
  }

  updateBolts(dt) {
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0 || bolt.x < -20 || bolt.x > VIEW.width + 20 || bolt.y < -20 || bolt.y > VIEW.height + 20) {
        bolt.dead = true;
        continue;
      }
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (distanceSq(bolt.x, bolt.y, enemy.x, enemy.y) < Math.pow(enemy.radius + bolt.radius, 2)) {
          bolt.dead = true;
          this.damageEnemy(enemy, bolt.damage);
          this.burst(bolt.x, bolt.y, '#a5f3fc', 3, 120, 2);
          break;
        }
      }
    }
    this.bolts = this.bolts.filter((bolt) => !bolt.dead);
  }

  updateOrbs(dt) {
    const p = this.player;
    for (const orb of this.orbs) {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
      if (orb.life <= 0) { orb.dead = true; continue; }
      if (p.alive && distanceSq(orb.x, orb.y, p.x, p.y) < Math.pow(orb.radius + p.radius - 2, 2)) {
        orb.dead = true;
        this.hurtPlayer(orb.damage);
      }
    }
    this.orbs = this.orbs.filter((orb) => !orb.dead);
  }

  updateGems(dt) {
    const p = this.player;
    for (const gem of this.gems) {
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      gem.vx *= Math.max(0, 1 - 4 * dt);
      gem.vy *= Math.max(0, 1 - 4 * dt);
      if (!p.alive) continue;
      const dSq = distanceSq(gem.x, gem.y, p.x, p.y);
      if (dSq < Math.pow(p.magnetRadius, 2)) gem.magnetized = true;
      if (gem.magnetized) {
        const dist = Math.sqrt(dSq) || 1;
        const pull = 340;
        gem.x += ((p.x - gem.x) / dist) * pull * dt;
        gem.y += ((p.y - gem.y) / dist) * pull * dt;
      }
      if (dSq < Math.pow(PLAYER.pickupRadius, 2)) {
        gem.dead = true;
        if (gem.heart) {
          p.hp = Math.min(p.maxHp, p.hp + 20);
          this.addText(p.x, p.y - 24, '+20 HP', '#fb7185', 14);
        } else {
          this.gainXp(gem.value);
        }
        this.sound.play('pickup');
      }
    }
    this.gems = this.gems.filter((gem) => !gem.dead);
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      const dragFactor = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= dragFactor;
      particle.vy *= dragFactor;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const text of this.texts) {
      text.y -= 34 * dt;
      text.life -= dt;
    }
    this.texts = this.texts.filter((text) => text.life > 0);
  }
}
