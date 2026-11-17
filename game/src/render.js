// VOIDBLOOM — drawing.
// The Renderer turns a World into pixels: a deep-void backdrop with drifting
// star layers, neon polygon enemies, the radiant player bloom, and every
// screen around the play (title, upgrade cards, victory, game over). It
// never changes the world; main.js tells it which screen to compose.

import { COLORS, VIEW } from './config.js';
import { Random } from './random.js';

const TAU = Math.PI * 2;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function polygonPath(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * TAU;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function bar(ctx, x, y, w, h, fraction, fill, back = 'rgba(148, 163, 184, 0.25)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
}

export function upgradeCardRect(index) {
  const w = 232;
  const h = 168;
  const gap = 24;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW.width - total) / 2;
  return { x: x0 + index * (w + gap), y: 208, w, h };
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    const rng = new Random(20261117);
    this.starLayers = [0.12, 0.3, 0.6].map((speed) => {
      const stars = [];
      for (let i = 0; i < 70; i += 1) {
        stars.push({
          x: rng.range(0, VIEW.width),
          y: rng.range(0, VIEW.height),
          r: rng.range(0.6, 1.9),
          speed,
          twinkle: rng.range(0, TAU),
        });
      }
      return stars;
    });
    this.motes = [];
    const moteRng = new Random(777);
    for (let i = 0; i < 26; i += 1) {
      this.motes.push({
        x: moteRng.range(0, VIEW.width),
        y: moteRng.range(0, VIEW.height),
        r: moteRng.range(6, 20),
        vx: moteRng.range(-6, 6),
        vy: moteRng.range(-3, 3),
        hue: moteRng.pick(['88, 28, 160', '14, 116, 144', '190, 24, 93']),
      });
    }
  }

  drawBackdrop(time, world) {
    const { ctx } = this;
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, COLORS.voidTop);
    gradient.addColorStop(1, COLORS.voidBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const mote of this.motes) {
      const x = (mote.x + mote.vx * time) % (VIEW.width + 60);
      const y = (mote.y + mote.vy * time) % (VIEW.height + 60);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, mote.r * 3);
      glow.addColorStop(0, `rgba(${mote.hue}, 0.20)`);
      glow.addColorStop(1, `rgba(${mote.hue}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - mote.r * 3, y - mote.r * 3, mote.r * 6, mote.r * 6);
    }
    const focusX = world && world.player ? world.player.x : VIEW.width / 2;
    const focusY = world && world.player ? world.player.y : VIEW.height / 2;
    for (const layer of this.starLayers) {
      for (const star of layer) {
        const offsetX = (focusX - VIEW.width / 2) * star.speed * 0.05;
        const offsetY = (focusY - VIEW.height / 2) * star.speed * 0.05;
        const alpha = 0.35 + 0.3 * Math.sin(time * 1.7 + star.twinkle);
        ctx.fillStyle = `rgba(226, 232, 240, ${Math.max(0.08, alpha)})`;
        ctx.beginPath();
        ctx.arc(star.x - offsetX, star.y - offsetY, star.r, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawWorld(world, time) {
    const { ctx } = this;
    ctx.save();
    if (world.shake > 0.2) {
      const dx = (Math.random() - 0.5) * world.shake;
      const dy = (Math.random() - 0.5) * world.shake;
      ctx.translate(dx, dy);
    }
    for (const gem of world.gems) this.drawGem(gem, time);
    for (const orb of world.orbs) {
      ctx.save();
      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const bolt of world.bolts) {
      ctx.save();
      ctx.shadowColor = COLORS.bolt;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.boltCore;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const enemy of world.enemies) this.drawEnemy(enemy, time);
    if (world.player) this.drawPlayer(world.player, time);
    for (const particle of world.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha + 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const text of world.texts) {
      const alpha = Math.max(0, text.life / text.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${text.size}px ${FONT}`;
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawGem(gem, time) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(gem.x, gem.y + Math.sin(time * 3 + gem.x) * 1.5);
    if (gem.heart) {
      ctx.shadowColor = COLORS.heart;
      ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.heart;
      ctx.beginPath();
      ctx.arc(0, 0, gem.radius, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff1f2';
      ctx.fillRect(-1.5, -5, 3, 10);
      ctx.fillRect(-5, -1.5, 10, 3);
    } else {
      ctx.rotate(Math.PI / 4 + time * 1.5);
      ctx.shadowColor = COLORS.xp;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.xp;
      ctx.fillRect(-gem.radius / 1.6, -gem.radius / 1.6, gem.radius * 1.25, gem.radius * 1.25);
    }
    ctx.restore();
  }

  drawEnemy(enemy, time) {
    const { ctx } = this;
    const sides = { shard: 3, weaver: 4, bulwark: 6, spitter: 5, boss: 10 }[enemy.kind] ?? 4;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = enemy.kind === 'boss' ? 26 : 14;
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
    polygonPath(ctx, 0, 0, enemy.radius, sides, enemy.angle);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(7, 3, 18, 0.55)';
    polygonPath(ctx, 0, 0, enemy.radius * 0.58, sides, enemy.angle * 1.4);
    ctx.fill();
    ctx.fillStyle = '#fecdd3';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.16 + Math.sin(time * 4 + enemy.wobble) * 0.8, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (enemy.hp < enemy.maxHp && enemy.kind !== 'boss') {
      bar(ctx, enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2, 3.5, enemy.hp / enemy.maxHp, '#fda4af');
    }
  }

  drawPlayer(player, time) {
    const { ctx } = this;
    if (!player.alive) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.invulnLeft > 0 && player.dashTimeLeft <= 0 && Math.sin(time * 34) > 0) {
      ctx.globalAlpha = 0.35;
    }
    // Petals: six ellipses turning slowly around the core.
    ctx.fillStyle = COLORS.playerRing;
    for (let i = 0; i < 6; i += 1) {
      const angle = time * 1.6 + (i / 6) * TAU;
      const px = Math.cos(angle) * (player.radius + 3);
      const py = Math.sin(angle) * (player.radius + 3);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 22;
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, player.radius);
    coreGradient.addColorStop(0, COLORS.playerCore);
    coreGradient.addColorStop(1, COLORS.player);
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Magnet ring, faint, so the pickup range can be read at a glance.
    ctx.save();
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.07)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.magnetRadius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawHud(world, bestScore) {
    const { ctx } = this;
    const p = world.player;
    ctx.textAlign = 'left';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('BLOOM INTEGRITY', 18, 24);
    bar(ctx, 18, 30, 210, 13, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? '#4ade80' : '#ef4444');
    ctx.fillStyle = COLORS.textMain;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 24, 40);

    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`LEVEL ${p.level}`, 18, 66);
    bar(ctx, 78, 58, 150, 9, p.xp / p.xpNext, '#4ade80');

    const dashReady = p.dashCooldownLeft <= 0;
    ctx.fillStyle = dashReady ? '#fbbf24' : COLORS.textDim;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(dashReady ? 'DASH READY (SHIFT)' : `DASH ${p.dashCooldownLeft.toFixed(1)}s`, 18, 88);

    ctx.textAlign = 'center';
    ctx.font = `800 21px ${FONT}`;
    ctx.fillStyle = COLORS.textMain;
    ctx.fillText(`WAVE ${world.wave}`, VIEW.width / 2, 30);
    if (world.boss) {
      bar(ctx, VIEW.width / 2 - 150, 40, 300, 8, world.boss.hp / world.boss.maxHp, '#f43f5e');
      ctx.font = `600 11px ${FONT}`;
      ctx.fillStyle = '#fda4af';
      ctx.fillText('VOID WARDEN', VIEW.width / 2, 62);
    }

    ctx.textAlign = 'right';
    ctx.font = `800 21px ${FONT}`;
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`${world.score}`, VIEW.width - 18, 30);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`BEST ${Math.max(bestScore, world.score)}`, VIEW.width - 18, 48);
    ctx.fillText(`KILLS ${world.kills} · ${formatTime(world.elapsed)}`, VIEW.width - 18, 66);
    if (world.combo >= 5) {
      const multiplier = (1 + Math.min(world.combo, 40) * 0.05).toFixed(2);
      ctx.fillStyle = '#fbbf24';
      ctx.font = `800 15px ${FONT}`;
      ctx.fillText(`COMBO x${multiplier}`, VIEW.width - 18, 90);
    }
    ctx.textAlign = 'left';
  }

  drawAnnounce(world) {
    if (world.phase !== 'announce') return;
    const { ctx } = this;
    const alpha = Math.min(1, world.phaseTimer / 0.7);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `800 44px ${FONT}`;
    ctx.fillStyle = COLORS.textMain;
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 26;
    ctx.fillText(`WAVE ${world.wave}`, VIEW.width / 2, VIEW.height / 2 - 60);
    ctx.shadowBlur = 0;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    const line = world.isBossWave
      ? 'A Void Warden approaches…'
      : world.wave === 1
        ? 'The void stirs. Defend the bloom.'
        : 'The void sends more shards.';
    ctx.fillText(line, VIEW.width / 2, VIEW.height / 2 - 30);
    ctx.restore();
  }

  panel(x, y, w, h) {
    const { ctx } = this;
    ctx.fillStyle = COLORS.panelFill;
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  drawTitle(time, bestScore) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.font = `800 76px ${FONT}`;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 34 + Math.sin(time * 2) * 8;
    ctx.fillStyle = '#ffd166';
    ctx.fillText('VOIDBLOOM', VIEW.width / 2, 168);
    ctx.shadowBlur = 0;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillStyle = '#c4b5fd';
    ctx.fillText('Guard the last bloom against the geometry of the void.', VIEW.width / 2, 202);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = COLORS.textMain;
    const lines = [
      'Move — WASD or arrow keys        Aim — mouse',
      'Fire — hold mouse or Space        Dash — Shift (briefly untouchable)',
      'Gather green pollen to level up and choose a blessing.',
      `Survive to wave 10 to quiet the void. Boss wardens bloom every 5 waves.`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 258 + i * 24));
    ctx.font = `800 20px ${FONT}`;
    ctx.fillStyle = '#4ade80';
    ctx.fillText('CLICK OR PRESS ENTER TO BLOOM', VIEW.width / 2, 396);
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    if (bestScore > 0) ctx.fillText(`Best score so far: ${bestScore}`, VIEW.width / 2, 428);
    ctx.fillText('M — mute · P — pause', VIEW.width / 2, 452);
    ctx.textAlign = 'left';
  }

  drawUpgrade(world, input) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(4, 2, 12, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = '#4ade80';
    ctx.fillText('THE BLOOM GROWS', VIEW.width / 2, 150);
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = COLORS.textMain;
    ctx.fillText(`Level ${world.player.level} — choose one blessing (click or press 1, 2, 3)`, VIEW.width / 2, 178);
    world.upgradeChoices.forEach((upgrade, i) => {
      const rect = upgradeCardRect(i);
      const hovered = input
        && input.mouseX >= rect.x && input.mouseX <= rect.x + rect.w
        && input.mouseY >= rect.y && input.mouseY <= rect.y + rect.h;
      this.panel(rect.x, rect.y, rect.w, rect.h);
      if (hovered) {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffd166';
      ctx.font = `800 19px ${FONT}`;
      ctx.fillText(upgrade.name, rect.x + rect.w / 2, rect.y + 52);
      ctx.fillStyle = COLORS.textMain;
      ctx.font = `600 15px ${FONT}`;
      ctx.fillText(upgrade.blurb, rect.x + rect.w / 2, rect.y + 84);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText(`[ ${i + 1} ]`, rect.x + rect.w / 2, rect.y + rect.h - 18);
    });
    ctx.textAlign = 'left';
  }

  drawEndScreen(world, bestScore, victory) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(4, 2, 12, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const w = 430;
    const h = 300;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    this.panel(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = victory ? '#4ade80' : '#fb7185';
    ctx.fillText(victory ? 'THE VOID IS QUIET' : 'THE BLOOM FALLS', VIEW.width / 2, y + 58);
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = COLORS.textMain;
    const stats = [
      `Score  ${world.score}`,
      `Wave reached  ${world.wave}    ·    Kills  ${world.kills}`,
      `Level  ${world.player.level}    ·    Time  ${formatTime(world.elapsed)}`,
      `Best  ${Math.max(bestScore, world.score)}`,
    ];
    stats.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, y + 104 + i * 28));
    ctx.font = `800 17px ${FONT}`;
    ctx.fillStyle = '#ffd166';
    if (victory) {
      ctx.fillText('ENTER — keep blooming (endless) · R — new run', VIEW.width / 2, y + h - 30);
    } else {
      ctx.fillText('CLICK OR PRESS R TO BLOOM AGAIN', VIEW.width / 2, y + h - 30);
    }
    ctx.textAlign = 'left';
  }

  drawPaused() {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(4, 2, 12, 0.5)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = COLORS.textMain;
    ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2);
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Press P to resume', VIEW.width / 2, VIEW.height / 2 + 30);
    ctx.textAlign = 'left';
  }
}

export function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
