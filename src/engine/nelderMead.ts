/**
 * Tiny Nelder-Mead simplex implementation specialised for 2D (tax%, trad%) per-year refinement.
 * The third axis (roth%) is the dependent variable: roth = 1 - tax - trad.
 *
 * Returns the best (tax, trad) pair found. Bound to [0,1]; sum bound to ≤1 (roth ≥ 0).
 */

export interface NMPoint {
  x: [number, number];   // (tax%, trad%)
  f: number;             // objective; lower is better
}

export interface NMOptions {
  maxIter?: number;       // default 30
  tolerance?: number;     // default 1e-3
  alpha?: number;         // reflection (default 1)
  gamma?: number;         // expansion (default 2)
  rho?: number;           // contraction (default 0.5)
  sigma?: number;         // shrink (default 0.5)
}

const project = (x: [number, number]): [number, number] => {
  const tax = Math.max(0, Math.min(1, x[0]));
  const trad = Math.max(0, Math.min(1, x[1]));
  if (tax + trad > 1) {
    // Project onto the simplex hypotenuse so roth >= 0
    const scale = 1 / (tax + trad);
    return [tax * scale, trad * scale];
  }
  return [tax, trad];
};

const evalAt = (x: [number, number], objective: (p: [number, number]) => number): NMPoint => {
  const p = project(x);
  return { x: p, f: objective(p) };
};

export function nelderMead2D(
  start: [number, number],
  objective: (p: [number, number]) => number,
  opts: NMOptions = {}
): NMPoint {
  const maxIter = opts.maxIter ?? 30;
  const tol = opts.tolerance ?? 1e-3;
  const alpha = opts.alpha ?? 1;
  const gamma = opts.gamma ?? 2;
  const rho = opts.rho ?? 0.5;
  const sigma = opts.sigma ?? 0.5;
  const step = 0.05;

  let simplex: NMPoint[] = [
    evalAt(start, objective),
    evalAt([start[0] + step, start[1]], objective),
    evalAt([start[0], start[1] + step], objective),
  ];

  for (let iter = 0; iter < maxIter; iter++) {
    simplex.sort((a, b) => a.f - b.f);
    const best = simplex[0], worst = simplex[2], second = simplex[1];
    if (Math.abs(worst.f - best.f) < tol) break;

    // Centroid of best + second (exclude worst)
    const centroid: [number, number] = [(best.x[0] + second.x[0]) / 2, (best.x[1] + second.x[1]) / 2];

    // Reflect
    const xr: [number, number] = [centroid[0] + alpha * (centroid[0] - worst.x[0]), centroid[1] + alpha * (centroid[1] - worst.x[1])];
    const r = evalAt(xr, objective);

    if (r.f < second.f && r.f >= best.f) {
      simplex[2] = r;
      continue;
    }

    // Expand
    if (r.f < best.f) {
      const xe: [number, number] = [centroid[0] + gamma * (xr[0] - centroid[0]), centroid[1] + gamma * (xr[1] - centroid[1])];
      const e = evalAt(xe, objective);
      simplex[2] = e.f < r.f ? e : r;
      continue;
    }

    // Contract
    const xc: [number, number] = [centroid[0] + rho * (worst.x[0] - centroid[0]), centroid[1] + rho * (worst.x[1] - centroid[1])];
    const c = evalAt(xc, objective);
    if (c.f < worst.f) {
      simplex[2] = c;
      continue;
    }

    // Shrink toward best
    simplex = [
      best,
      evalAt([best.x[0] + sigma * (second.x[0] - best.x[0]), best.x[1] + sigma * (second.x[1] - best.x[1])], objective),
      evalAt([best.x[0] + sigma * (worst.x[0] - best.x[0]), best.x[1] + sigma * (worst.x[1] - best.x[1])], objective),
    ];
  }

  simplex.sort((a, b) => a.f - b.f);
  return simplex[0];
}

/**
 * 3D variant: (tax%, trad%, c). c is an independent normalized conversion-fraction
 * in [0, 1]; tax+trad bounded so roth >= 0.
 */
export interface NMPoint3 {
  x: [number, number, number];
  f: number;
}

const project3 = (x: [number, number, number]): [number, number, number] => {
  let tax = Math.max(0, Math.min(1, x[0]));
  let trad = Math.max(0, Math.min(1, x[1]));
  if (tax + trad > 1) {
    const scale = 1 / (tax + trad);
    tax *= scale; trad *= scale;
  }
  const c = Math.max(0, Math.min(1, x[2]));
  return [tax, trad, c];
};

const evalAt3 = (x: [number, number, number], objective: (p: [number, number, number]) => number): NMPoint3 => {
  const p = project3(x);
  return { x: p, f: objective(p) };
};

export function nelderMead3D(
  start: [number, number, number],
  objective: (p: [number, number, number]) => number,
  opts: NMOptions = {}
): NMPoint3 {
  const maxIter = opts.maxIter ?? 30;
  const tol = opts.tolerance ?? 1e-3;
  const alpha = opts.alpha ?? 1;
  const gamma = opts.gamma ?? 2;
  const rho = opts.rho ?? 0.5;
  const sigma = opts.sigma ?? 0.5;
  const step = 0.05;

  let simplex: NMPoint3[] = [
    evalAt3(start, objective),
    evalAt3([start[0] + step, start[1], start[2]], objective),
    evalAt3([start[0], start[1] + step, start[2]], objective),
    evalAt3([start[0], start[1], start[2] + step], objective),
  ];

  const N = 3;
  const centroid = (pts: NMPoint3[]): [number, number, number] => {
    const c: [number, number, number] = [0, 0, 0];
    for (const p of pts) { c[0] += p.x[0]; c[1] += p.x[1]; c[2] += p.x[2]; }
    return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length];
  };

  for (let iter = 0; iter < maxIter; iter++) {
    simplex.sort((a, b) => a.f - b.f);
    const best = simplex[0];
    const worst = simplex[N];
    const second = simplex[N - 1];
    if (Math.abs(worst.f - best.f) < tol) break;

    const cen = centroid(simplex.slice(0, N));

    // Reflect
    const xr: [number, number, number] = [
      cen[0] + alpha * (cen[0] - worst.x[0]),
      cen[1] + alpha * (cen[1] - worst.x[1]),
      cen[2] + alpha * (cen[2] - worst.x[2]),
    ];
    const r = evalAt3(xr, objective);

    if (r.f < second.f && r.f >= best.f) {
      simplex[N] = r;
      continue;
    }

    if (r.f < best.f) {
      const xe: [number, number, number] = [
        cen[0] + gamma * (xr[0] - cen[0]),
        cen[1] + gamma * (xr[1] - cen[1]),
        cen[2] + gamma * (xr[2] - cen[2]),
      ];
      const e = evalAt3(xe, objective);
      simplex[N] = e.f < r.f ? e : r;
      continue;
    }

    // Contract
    const xc: [number, number, number] = [
      cen[0] + rho * (worst.x[0] - cen[0]),
      cen[1] + rho * (worst.x[1] - cen[1]),
      cen[2] + rho * (worst.x[2] - cen[2]),
    ];
    const c = evalAt3(xc, objective);
    if (c.f < worst.f) {
      simplex[N] = c;
      continue;
    }

    // Shrink toward best
    simplex = simplex.map((p, i) => i === 0 ? best : evalAt3([
      best.x[0] + sigma * (p.x[0] - best.x[0]),
      best.x[1] + sigma * (p.x[1] - best.x[1]),
      best.x[2] + sigma * (p.x[2] - best.x[2]),
    ], objective));
  }

  simplex.sort((a, b) => a.f - b.f);
  return simplex[0];
}
