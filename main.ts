// VOIDBLOOM — the program that hands the game in (best-game-01, Node 22,
// standard library only).
//
// The game itself is the static site in game/: plain files a desktop
// browser loads offline, no build step. This program's whole job is the
// delivery: copy game/ and screenshots/ into the output directory and
// write dossier.json there with the kit's vendored library
// (vendor/makefun-game.ts, unchanged), which is the summary the scorer
// verifies and the judge reads.
//
// Run it the way the grader does, from the repository root:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.)
// Play the game locally instead with: node serve.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

const screenshotsDir = join(repoRoot, 'screenshots');
if (existsSync(screenshotsDir)) {
  cpSync(screenshotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own (the kit's reference gate): the
// dossier is only written for a game that fits them, and the scorer
// rebuilds the dossier with the same library and compares byte for byte,
// so these numbers are part of the delivery format, not a choice.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
