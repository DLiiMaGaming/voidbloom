// VOIDBLOOM — entry point and screen flow.
// Owns the canvas, the clock and the state machine (title, play, upgrade,
// victory, game over, pause). The World simulates, the Renderer draws, this
// file only decides which of them runs and what a click or a key means on
// the current screen. With ?shot=<scene> it instead poses one deterministic
// frame for the entry's screenshots (see shots.js).

import { VIEW, STORAGE_KEY } from './config.js';
import { Input } from './input.js';
import { Random } from './random.js';
import { Renderer, upgradeCardRect } from './render.js';
import { SoundBank } from './audio.js';
import { World } from './world.js';
import { shotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const sound = new SoundBank();
const renderer = new Renderer(ctx);

function loadBest() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // Storage can be unavailable (private mode, file rules); the game goes on.
  }
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

if (shotName) {
  const seed = Number(params.get('seed')) || 1;
  const scene = shotScene(shotName, seed) ?? shotScene('start', seed);
  const draw = () => {
    renderer.drawBackdrop(2.4, scene.world);
    if (scene.screen !== 'title') {
      renderer.drawWorld(scene.world, 2.4);
      renderer.drawHud(scene.world, loadBest());
    }
    if (scene.screen === 'title') renderer.drawTitle(2.4, loadBest());
    if (scene.screen === 'upgrade') renderer.drawUpgrade(scene.world, scene.input);
    if (scene.screen === 'gameover') renderer.drawEndScreen(scene.world, loadBest(), false);
    document.body.dataset.shotReady = scene.screen;
    requestAnimationFrame(draw);
  };
  draw();
} else {
  const input = new Input(canvas);
  let world = new World(new Random((Date.now() % 2147483647) || 1), sound);
  let screen = 'title';
  let best = loadBest();
  let deathTimer = 0;
  let last = performance.now();

  function startRun() {
    sound.unlock();
    sound.startPad();
    world = new World(new Random((Date.now() % 2147483647) || 1), sound);
    world.startRun();
    screen = 'play';
    deathTimer = 0;
  }

  function finishRun() {
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
  }

  function handleScreenInput() {
    const enter = input.pressedKeys.has('Enter');
    if (screen === 'title' && (input.clicked || enter)) startRun();
    else if (screen === 'gameover' && (input.clicked || input.pressedKeys.has('KeyR'))) startRun();
    else if (screen === 'victory') {
      if (enter) {
        world.continueEndless();
        screen = 'play';
      } else if (input.pressedKeys.has('KeyR')) startRun();
    } else if (screen === 'upgrade') {
      let chosen = -1;
      if (input.pressedKeys.has('Digit1')) chosen = 0;
      if (input.pressedKeys.has('Digit2')) chosen = 1;
      if (input.pressedKeys.has('Digit3')) chosen = 2;
      if (input.clicked) {
        world.upgradeChoices.forEach((_, i) => {
          const rect = upgradeCardRect(i);
          if (input.mouseX >= rect.x && input.mouseX <= rect.x + rect.w
            && input.mouseY >= rect.y && input.mouseY <= rect.y + rect.h) chosen = i;
        });
      }
      if (chosen >= 0 && world.upgradeChoices[chosen]) {
        world.applyUpgrade(world.upgradeChoices[chosen]);
        if (world.pendingLevelUps <= 0) screen = 'play';
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    const time = now / 1000;

    if (input.pressedKeys.has('KeyM')) sound.setMuted(!sound.muted);
    if (screen === 'play' && input.pressedKeys.has('KeyP')) screen = 'paused';
    else if (screen === 'paused' && input.pressedKeys.has('KeyP')) screen = 'play';

    handleScreenInput();

    if (screen === 'play') {
      world.update(dt, input);
      sound.setIntensity(world.intensity);
      if (world.pendingLevelUps > 0 && world.upgradeChoices.length > 0) {
        screen = 'upgrade';
      } else if (world.victory) {
        finishRun();
        screen = 'victory';
      } else if (world.playerDead) {
        deathTimer += dt;
        if (deathTimer > 1.15) {
          finishRun();
          screen = 'gameover';
        }
      }
    }

    renderer.drawBackdrop(time, screen === 'title' ? null : world);
    if (screen === 'title') {
      renderer.drawTitle(time, best);
    } else {
      renderer.drawWorld(world, time);
      renderer.drawHud(world, best);
      renderer.drawAnnounce(world);
      if (screen === 'upgrade') renderer.drawUpgrade(world, input);
      if (screen === 'victory') renderer.drawEndScreen(world, best, true);
      if (screen === 'gameover') renderer.drawEndScreen(world, best, false);
      if (screen === 'paused') renderer.drawPaused();
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
