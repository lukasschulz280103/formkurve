// Statistik-Helfer ohne Abhängigkeiten.
export const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const round = (x, d = 0) => (isNum(x) ? Math.round(x * 10 ** d) / 10 ** d : null);

export function nums(a) {
  const out = [];
  for (const x of a) if (isNum(x)) out.push(x);
  return out;
}

export function sum(a) {
  let s = 0;
  for (const x of a) if (isNum(x)) s += x;
  return s;
}

export function mean(a) {
  let s = 0;
  let n = 0;
  for (const x of a) {
    if (isNum(x)) {
      s += x;
      n++;
    }
  }
  return n ? s / n : null;
}

export function sd(a) {
  const v = nums(a);
  if (v.length < 2) return null;
  const m = mean(v);
  let s = 0;
  for (const x of v) s += (x - m) ** 2;
  return Math.sqrt(s / (v.length - 1));
}

export function quantile(a, q) {
  const v = nums(a).sort((x, y) => x - y);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export const median = (a) => quantile(a, 0.5);

/** Rohe mittlere absolute Abweichung vom Median (ohne Faktor 1,4826). */
export function mad(a) {
  const v = nums(a);
  const m = median(v);
  if (m == null) return null;
  return median(v.map((x) => Math.abs(x - m)));
}

/** Gewichteter Mittelwert; fehlende Werte werden herausgerechnet (Gewichte renormiert). */
export function weightedMean(pairs) {
  let s = 0;
  let w = 0;
  for (const [v, wt] of pairs) {
    if (isNum(v) && wt > 0) {
      s += v * wt;
      w += wt;
    }
  }
  return w > 0 ? s / w : null;
}

/** Lineare Abbildung von [x0, x1] auf [y0, y1], begrenzt. x0 > x1 ist erlaubt (umgekehrte Richtung). */
export function linmap(x, x0, x1, y0 = 0, y1 = 100) {
  if (!isNum(x)) return null;
  const y = y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  return clamp(y, Math.min(y0, y1), Math.max(y0, y1));
}

export function pearson(x, y) {
  const px = [];
  const py = [];
  for (let i = 0; i < x.length; i++) {
    if (isNum(x[i]) && isNum(y[i])) {
      px.push(x[i]);
      py.push(y[i]);
    }
  }
  const n = px.length;
  if (n < 3) return { r: null, n };
  const mx = mean(px);
  const my = mean(py);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (px[i] - mx) * (py[i] - my);
    sxx += (px[i] - mx) ** 2;
    syy += (py[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return { r: null, n };
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

/** Deterministischer Zufallsgenerator (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Zweiseitiger Permutationstest für die Differenz der Mittelwerte. */
export function permutationTest(a, b, iters = 2000, rng = Math.random) {
  const nA = a.length;
  const nB = b.length;
  if (!nA || !nB) return 1;
  const all = a.concat(b);
  const n = all.length;
  let total = 0;
  for (const x of all) total += x;
  const obs = Math.abs(mean(a) - mean(b));
  const arr = Float64Array.from(all);
  let count = 0;
  for (let i = 0; i < iters; i++) {
    let sA = 0;
    for (let j = 0; j < nA; j++) {
      const k = j + Math.floor(rng() * (n - j));
      const t = arr[j];
      arr[j] = arr[k];
      arr[k] = t;
      sA += arr[j];
    }
    const d = Math.abs(sA / nA - (total - sA) / nB);
    if (d >= obs - 1e-12) count++;
  }
  return (count + 1) / (iters + 1);
}

/** Bootstrap-Konfidenzintervall der Mittelwertdifferenz a - b. */
export function bootstrapDiffCI(a, b, iters = 1000, rng = Math.random, alpha = 0.05) {
  if (!a.length || !b.length) return [null, null];
  const diffs = new Float64Array(iters);
  for (let i = 0; i < iters; i++) {
    let sA = 0;
    for (let j = 0; j < a.length; j++) sA += a[Math.floor(rng() * a.length)];
    let sB = 0;
    for (let j = 0; j < b.length; j++) sB += b[Math.floor(rng() * b.length)];
    diffs[i] = sA / a.length - sB / b.length;
  }
  diffs.sort();
  const lo = diffs[Math.max(0, Math.floor((alpha / 2) * iters))];
  const hi = diffs[Math.min(iters - 1, Math.ceil((1 - alpha / 2) * iters) - 1)];
  return [lo, hi];
}

/** Benjamini-Hochberg: wandelt p-Werte in q-Werte (False Discovery Rate) um. */
export function benjaminiHochberg(p) {
  const m = p.length;
  const idx = p.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const q = new Array(m);
  let prev = 1;
  for (let r = m - 1; r >= 0; r--) {
    const [v, i] = idx[r];
    const val = Math.min(prev, (v * m) / (r + 1));
    q[i] = val;
    prev = val;
  }
  return q;
}

/** Löst A x = b per Gauß-Elimination mit Pivotsuche. */
export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Ridge-Regression auf standardisierten Spalten. Gibt Koeffizienten in Rohskala zurück:
 * bei 0/1-Faktoren ist coef[j] der bereinigte Effekt "Faktor vorhanden vs. nicht".
 */
export function ridge(X, y, lambda = 1) {
  const n = X.length;
  const p = n ? X[0].length : 0;
  if (!n || !p) return null;
  const mu = new Array(p).fill(0);
  const sdv = new Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += X[i][j];
    mu[j] = s / n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (X[i][j] - mu[j]) ** 2;
    sdv[j] = Math.sqrt(v / n) || 1;
  }
  let ym = 0;
  for (const v of y) ym += v;
  ym /= n;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const bv = new Array(p).fill(0);
  const z = new Array(p);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) z[j] = (X[i][j] - mu[j]) / sdv[j];
    const yc = y[i] - ym;
    for (let j = 0; j < p; j++) {
      bv[j] += z[j] * yc;
      for (let k = j; k < p; k++) A[j][k] += z[j] * z[k];
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) A[j][k] = A[k][j];
    A[j][j] += lambda;
  }
  const beta = solve(A, bv);
  if (!beta) return null;
  const coef = beta.map((b, j) => b / sdv[j]);
  const intercept = ym - coef.reduce((s, c, j) => s + c * mu[j], 0);
  return { coef, intercept };
}
