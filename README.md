# VOIDBLOOM

An original neon arena-survival game for the browser. You are the last
bloom: a radiant flower adrift in a dark void, and the void sends its
geometry — shard triangles, weaving diamonds, bulwark hexagons, spitting
pentagons and, every fifth wave, a Void Warden — to unmake you. Survive
the waves, gather the green pollen that falls from every shard you break,
and spend it on blessings that make the bloom hotter, faster and stranger.
Quiet the void at wave 10, or fall and bloom again.

## Play

Open the game with any static server, for example:

```
node serve.ts        # then visit http://localhost:8080
```

or serve the `game/` folder with any static file server and open
`game/index.html`. The game is plain static files and plays fully offline:
no build step, no network requests, no libraries — every line of the game,
its synthesized sound included, is in `game/src/`.

## Controls

- **Move** — WASD or arrow keys
- **Aim** — mouse
- **Fire** — hold the left mouse button or Space
- **Dash** — Shift (briefly untouchable, with a cooldown)
- **Choose a blessing** — click a card, or press 1, 2 or 3
- **Pause** — P · **Mute** — M

## How it is put together

- `game/src/config.js` — every tuning number: the player, the five enemy
  kinds, the wave director's budget, the eight blessings, the XP curve.
- `game/src/world.js` — the simulation: entities, combat, the wave
  director, XP and level-ups, combo scoring, particles and screen shake.
- `game/src/render.js` — all drawing: the starfield void, the polygon
  enemies, the HUD, and the title / blessing / victory / game-over screens.
- `game/src/audio.js` — synthesized WebAudio effects and the ambient pad;
  there are no audio files.
- `game/src/input.js` — keyboard and mouse state, plus the scripted
  stand-in the screenshot scenes use.
- `game/src/random.js` — a seeded generator (mulberry32) so screenshot
  scenes and runs are reproducible.
- `game/src/shots.js` — the deterministic `?shot=` scenes behind the
  screenshots in `screenshots/`, each one a real render of this code.
- `game/src/main.js` — the screen flow that ties it together.
- `main.ts` — the program that hands the entry in: it copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json` with
  the vendored kit library in `vendor/`.

## License

MIT — see `LICENSE`.
