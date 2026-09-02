// Deterministic seeded RNG (mulberry32) so the prototype produces
// the same synthetic ERP/CRM/Support data on every boot.
export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function jitter(rand, base, pct) {
  const delta = (rand() * 2 - 1) * pct;
  return base * (1 + delta);
}
