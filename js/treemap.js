// Squarified treemap layout (Bruls, Huizing & van Wijk, 2000). Pure: no
// DOM, so the layout is tested in Node (tests/nikkei.test.mjs).
//
// squarify(values, x, y, w, h) → one rect {x, y, w, h} per value, in the
// order given; a value that is zero, negative or not a number gets null.
// Areas are exactly proportional to the values and tile the rectangle.

export function squarify(values, x, y, w, h) {
  const out = values.map(() => null);
  const idx = values.map((v, i) => [Number(v), i]).filter(([v]) => Number.isFinite(v) && v > 0).sort((a, b) => b[0] - a[0]);
  const total = idx.reduce((s, [v]) => s + v, 0);
  if (!idx.length || !(w > 0) || !(h > 0) || !(total > 0)) return out;

  const scale = (w * h) / total;
  const areas = idx.map(([v, i]) => [v * scale, i]);
  let rx = x, ry = y, rw = w, rh = h;
  let k = 0;

  // Aspect ratio of the worst tile if `sum` (with extremes min/max) is laid
  // along a side of length `side`
  const worst = (sum, min, max, side) => Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));

  while (k < areas.length) {
    const side = Math.min(rw, rh);
    let end = k + 1;
    let sum = areas[k][0], min = sum, max = sum;
    while (end < areas.length) {
      const a = areas[end][0];
      const nSum = sum + a, nMin = Math.min(min, a), nMax = Math.max(max, a);
      if (worst(nSum, nMin, nMax, side) > worst(sum, min, max, side)) break;
      sum = nSum; min = nMin; max = nMax; end++;
    }
    // Lay the row along the shorter side, then shrink the free rectangle
    if (rw >= rh) {
      const colW = sum / rh;
      let cy = ry;
      for (let j = k; j < end; j++) {
        const hh = areas[j][0] / colW;
        out[areas[j][1]] = { x: rx, y: cy, w: colW, h: hh };
        cy += hh;
      }
      rx += colW; rw -= colW;
    } else {
      const rowH = sum / rw;
      let cx = rx;
      for (let j = k; j < end; j++) {
        const ww = areas[j][0] / rowH;
        out[areas[j][1]] = { x: cx, y: ry, w: ww, h: rowH };
        cx += ww;
      }
      ry += rowH; rh -= rowH;
    }
    k = end;
  }
  return out;
}
