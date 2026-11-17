// VOIDBLOOM — deterministic randomness.
// A tiny mulberry32 generator: given the same seed it produces the same
// stream, which is what makes the screenshot scenes reproducible and lets a
// run be replayed exactly. Live play seeds it from the clock instead.

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Random {
  constructor(seed) {
    this.next = mulberry32(seed);
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max], both ends included.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // One element of a non-empty array.
  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }

  // Angle in radians, full circle.
  angle() {
    return this.next() * Math.PI * 2;
  }
}
