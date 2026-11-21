// Dochia v1 — JavaScript (Node) reference implementation.
// Mirrors python/dochia.py. No dependencies.

const SQRT2 = Math.sqrt(2);
const SQRT2PI = Math.sqrt(2 * Math.PI);

function erf(x) {
  // Abramowitz & Stegun 7.1.26
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}

export const normCdf = (z) => 0.5 * (1 + erf(z / SQRT2));
export const normPdf = (z) => Math.exp(-0.5 * z * z) / SQRT2PI;

export function normPpf(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  let lo = -12, hi = 12;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (normCdf(mid) < p) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export function lognormalParams(mean, sd) {
  mean = Math.max(mean, 1e-6); sd = Math.max(sd, 1e-6);
  const s2 = Math.log1p((sd * sd) / (mean * mean));
  const s = Math.sqrt(s2);
  return { m: Math.log(mean) - 0.5 * s2, s };
}

export function mixtureFromMoments(mean, sd, pi, tailShift, tailSdMult, momentMatch = false) {
  pi = Math.min(Math.max(pi, 0), 0.45); mean = Math.max(mean, 1); sd = Math.max(sd, 0.2);
  if (pi <= 1e-9) {
    const main = lognormalParams(mean, sd);
    return { mean, sd, tailProb: 0, w: [1], m: [main.m], s: [main.s] };
  }
  if (!momentMatch) {
    const main = lognormalParams(mean, sd);
    const tail = lognormalParams(Math.max(mean + tailShift, mean * 1.02), Math.max(sd * tailSdMult, 0.3));
    return { mean, sd, tailProb: pi, w: [1 - pi, pi], m: [main.m, tail.m], s: [main.s, tail.s] };
  }
  const tailMean = Math.max(mean + tailShift, mean * 1.02);
  const tailSd = Math.max(sd * tailSdMult, 0.3);
  const mainMean = (mean - pi * tailMean) / (1 - pi);
  const mainVar = ((sd * sd + mean * mean - pi * (tailSd * tailSd + tailMean * tailMean)) / (1 - pi)) - mainMean * mainMean;
  if (mainMean <= 0.5 || mainVar <= 0.04) {
    const main = lognormalParams(mean, sd);
    return { mean, sd, tailProb: 0, w: [1], m: [main.m], s: [main.s] };
  }
  const main = lognormalParams(mainMean, Math.sqrt(mainVar));
  const tail = lognormalParams(tailMean, tailSd);
  return { mean, sd, tailProb: pi, w: [1 - pi, pi], m: [main.m, tail.m], s: [main.s, tail.s] };
}

export function mixCdf(mix, x) {
  if (x <= 0) return 0;
  let total = 0;
  for (let i = 0; i < mix.w.length; i++) total += mix.w[i] * normCdf((Math.log(x) - mix.m[i]) / mix.s[i]);
  return Math.min(Math.max(total, 0), 1);
}

export function mixPdf(mix, x) {
  if (x <= 0) return 0;
  let total = 0;
  for (let i = 0; i < mix.w.length; i++) {
    const z = (Math.log(x) - mix.m[i]) / mix.s[i];
    total += mix.w[i] * normPdf(z) / (x * mix.s[i]);
  }
  return total;
}

export function mixQuantile(mix, p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1000;
  let lo = 1, hi = 400;
  if (mixCdf(mix, lo) >= p) return lo;
  if (mixCdf(mix, hi) <= p) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    if (mixCdf(mix, mid) < p) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export function calibrated(mix, params) {
  return {
    mix,
    anchorLow: params.tailAnchorLow,
    anchorHigh: params.tailAnchorHigh,
    scaleLow: Math.max(params.tailScaleLow, 1e-6),
    scaleHigh: Math.max(params.tailScaleHigh, 1e-6),
    qLow: mixQuantile(mix, params.tailAnchorLow),
    qHigh: mixQuantile(mix, params.tailAnchorHigh),
  };
}

export function calQuantile(cal, p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1000;
  if (p <= cal.anchorLow) return cal.qLow + (mixQuantile(cal.mix, p) - cal.qLow) * cal.scaleLow;
  if (p >= cal.anchorHigh) return cal.qHigh + (mixQuantile(cal.mix, p) - cal.qHigh) * cal.scaleHigh;
  return mixQuantile(cal.mix, p);
}

export function calCdf(cal, x) {
  if (x <= cal.qLow) {
    const y = cal.qLow + (x - cal.qLow) / cal.scaleLow;
    return Math.min(Math.max(mixCdf(cal.mix, y), 0), 1);
  }
  if (x >= cal.qHigh) {
    const y = cal.qHigh + (x - cal.qHigh) / cal.scaleHigh;
    return Math.min(Math.max(mixCdf(cal.mix, y), 0), 1);
  }
  return mixCdf(cal.mix, x);
}

export function calPdf(cal, x) {
  if (x <= 0) return 0;
  if (x < cal.qLow) return mixPdf(cal.mix, cal.qLow + (x - cal.qLow) / cal.scaleLow) / cal.scaleLow;
  if (x > cal.qHigh) return mixPdf(cal.mix, cal.qHigh + (x - cal.qHigh) / cal.scaleHigh) / cal.scaleHigh;
  return mixPdf(cal.mix, x);
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2]);
}

export function personalState(lengthsIn, params) {
  const lengths = lengthsIn.filter((y) => y >= params.minLength && y <= params.maxLength).map(Number);
  const n = lengths.length;
  if (n === 0) {
    const withinVar = params.withinSdPrior ** 2;
    const between = params.popBetweenSd ** 2;
    const posterior = (withinVar * between) / Math.max(1e-9, withinVar);
    return {
      mean: params.popMean, withinVar, cycleSd: Math.sqrt(withinVar + posterior), n: 0,
      tailProb: params.tailProbBase, trend: 0, recentSd: 0, recentRange: 0,
      gap: false, abstain: false, confidence: 'new',
    };
  }
  const mean = lengths.reduce((a, b) => a + b, 0) / n;
  let sampleVar = 0;
  if (n > 1) sampleVar = lengths.reduce((a, y) => a + (y - mean) ** 2, 0) / (n - 1);
  const med = median(lengths);
  const mad = median(lengths.map((y) => Math.abs(y - med)));
  const robustVar = (1.4826 * mad) ** 2;
  sampleVar = params.varianceBlend * sampleVar + (1 - params.varianceBlend) * robustVar;

  const priorVar = params.withinSdPrior ** 2;
  let priorWeight = params.priorWeight;
  if (sampleVar > priorVar) priorWeight = Math.max(0.5, (params.priorWeight * priorVar) / sampleVar);
  let withinVar = (n * sampleVar + priorWeight * priorVar) / (n + priorWeight);
  withinVar = Math.min(Math.max(withinVar, params.minWithinVar), params.maxWithinVar);

  const between = params.popBetweenSd ** 2;
  const weight = (n * between) / Math.max(1e-9, n * between + withinVar);
  let shrunk = weight * mean + (1 - weight) * params.popMean;
  shrunk = Math.min(Math.max(shrunk, params.minMean), params.maxMean);

  const recent = lengths.slice(-6);
  let trend = 0;
  if (n >= 4 && recent.length >= 3) {
    const weights = Array.from({ length: recent.length }, (_, k) => (1 - params.trendEwma) ** (recent.length - 1 - k));
    trend = recent.reduce((acc, y, i) => acc + (y - shrunk) * weights[i], 0) / weights.reduce((a, b) => a + b, 0);
    const shift = Math.abs(trend) < params.trendThreshold ? 0 : Math.max(-params.trendMaxShift, Math.min(params.trendMaxShift, trend));
    shrunk = Math.min(Math.max(shrunk + shift, params.minMean), params.maxMean);
  }
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const recentSd = recent.length >= 2
    ? Math.sqrt(recent.reduce((a, y) => a + (y - recentMean) ** 2, 0) / (recent.length - 1))
    : 0;
  const recentRange = Math.max(...recent) - Math.min(...recent);
  const gap = Math.max(...recent) > params.abstainGapDays;

  let pi = params.tailProbBase
    + params.tailProbSdGain * Math.max(0, recentSd - 2)
    + params.tailProbRangeGain * Math.max(0, recentRange - 7);
  if (gap) pi += params.tailProbGapBonus;
  pi = Math.min(Math.max(pi, params.tailProbBase), params.tailProbMax);

  const abstain = gap || recentSd > params.abstainRecentSd || n < params.abstainMinCycles;
  const confidence = abstain ? 'abstain' : n >= 6 ? 'established' : n >= 3 ? 'building' : n >= 1 ? 'learning' : 'new';
  const posterior = (withinVar * between) / Math.max(1e-9, n * between + withinVar);
  return {
    mean: shrunk, withinVar, cycleSd: Math.sqrt(withinVar + posterior), n, tailProb: pi,
    trend, recentSd, recentRange, gap, abstain, confidence,
  };
}

export function predictive(state, params) {
  const mix = mixtureFromMoments(state.mean, state.cycleSd * params.bodyScale, state.tailProb,
    params.tailShiftDays, params.tailSdMultiplier, params.momentMatch);
  return calibrated(mix, params);
}

export function hazardCurve(cal, params) {
  const curve = new Array(params.hazardMaxDay).fill(0);
  let prev = 1;
  for (let day = 1; day <= params.hazardMaxDay; day++) {
    if (prev <= 1e-12) { curve[day - 1] = 1; continue; }
    const f = calCdf(cal, day) - calCdf(cal, day - 1);
    curve[day - 1] = Math.min(Math.max(Math.max(0, f) / prev, 0), 1);
    prev -= Math.max(0, f);
    if (prev < 0) prev = 0;
  }
  return curve;
}

export function onsetProbs(cal, currentDay, params) {
  currentDay = Math.max(1, Math.trunc(currentDay));
  const curve = hazardCurve(cal, params);
  const s0 = Math.max(1e-12, 1 - calCdf(cal, currentDay - 1));
  const within = (k) => {
    const st = Math.max(0, 1 - calCdf(cal, currentDay - 1 + k));
    return Math.min(Math.max(1 - st / s0, 0), 1);
  };
  const curveOut = {};
  for (let d = currentDay; d <= Math.min(params.hazardMaxDay, currentDay + 13); d++) curveOut[d] = curve[d - 1];
  return {
    current_day: currentDay,
    p_today: currentDay <= curve.length ? curve[currentDay - 1] : 0,
    p_within_3: within(3), p_within_7: within(7), p_within_14: within(14),
    late_probability: 1 - calCdf(cal, currentDay - 1),
    curve: curveOut,
  };
}

export function ovulationDistribution(cal, params) {
  const sdO = Math.sqrt(Math.max(cal.mix.sd ** 2 - params.lutealSd ** 2, params.ovulationSdFloor ** 2));
  const meanO = cal.mix.mean - params.lutealMean;
  const step = params.ovulationGridStep;
  const edges = [];
  for (let y = 0; y <= 365 + 1e-9; y += step) edges.push(y);
  const cdfEdges = edges.map((e) => calCdf(cal, e));
  const maxDay = params.hazardMaxDay;
  const probs = new Array(maxDay).fill(0);
  let prev = 0;
  for (let day = 1; day <= maxDay; day++) {
    let total = 0;
    for (let i = 0; i < edges.length - 1; i++) {
      const mass = cdfEdges[i + 1] - cdfEdges[i];
      if (mass <= 0) continue;
      const yMid = 0.5 * (edges[i] + edges[i + 1]);
      total += mass * normCdf((day - yMid + params.lutealMean) / params.lutealSd);
    }
    probs[day - 1] = Math.min(Math.max(total - prev, 0), 1);
    prev = total;
  }
  probs[maxDay - 1] += Math.max(0, 1 - prev);
  const fertile = new Array(maxDay).fill(0);
  for (let day = 1; day <= maxDay; day++) {
    let sum = 0;
    const last = Math.min(maxDay, day + params.fertileWindowDays - 1);
    for (let o = day; o <= last; o++) sum += probs[o - 1];
    fertile[day - 1] = Math.min(Math.max(sum, 0), 1);
  }
  const maxP = Math.max(...fertile);
  const peakDays = [];
  const windowDays = [];
  for (let d = 1; d <= maxDay; d++) {
    if (fertile[d - 1] >= Math.max(0.25, 0.5 * maxP)) peakDays.push(d);
    if (fertile[d - 1] >= 0.05) windowDays.push(d);
  }
  return {
    mean_day: meanO, sd_day: sdO,
    fertile_probabilities: Object.fromEntries(fertile.map((p, i) => [i + 1, p])),
    peak_days: peakDays,
    window_start: windowDays.length ? Math.min(...windowDays) : null,
    window_end: windowDays.length ? Math.max(...windowDays) : null,
  };
}

export function forecast(lengths, currentDay = 1, params = literatureParams()) {
  const state = personalState(lengths, params);
  const cal = predictive(state, params);
  const hazard = onsetProbs(cal, currentDay, params);
  const ovulation = ovulationDistribution(cal, params);
  const labels = ['0.025', '0.05', '0.1', '0.25', '0.5', '0.75', '0.9', '0.95', '0.975'];
  const ps = [0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.975];
  const quantiles = Object.fromEntries(labels.map((label, i) => [label, calQuantile(cal, ps[i])]));
  return {
    params_version: params.version,
    mean_length: state.mean,
    sd_length: state.cycleSd * params.bodyScale,
    cycles_used: state.n,
    confidence: state.confidence,
    abstain: state.abstain,
    tail_prob: state.tailProb,
    trend: state.trend,
    quantiles, hazard, ovulation,
  };
}

export function literatureParams() {
  return {
    version: 'dochia-v1-literature',
    popMean: 29.0, popBetweenSd: 3.5, withinSdPrior: 2.0, priorWeight: 4.0,
    minMean: 18.0, maxMean: 90.0, minWithinVar: 1.44, maxWithinVar: 36.0,
    lutealMean: 14.13, lutealSd: 1.41, fertileWindowDays: 6,
    ovulationSdFloor: 0.35, ovulationGridStep: 0.25,
    varianceBlend: 1.0, momentMatch: false,
    tailProbBase: 0.10, tailProbMax: 0.40, tailProbSdGain: 0.06,
    tailProbRangeGain: 0.02, tailProbGapBonus: 0.20,
    tailShiftDays: 3.0, tailSdMultiplier: 2.2,
    trendEwma: 0.4, trendThreshold: 3.0, trendMaxShift: 3.0,
    bodyScale: 1.0, tailScaleLow: 1.0, tailScaleHigh: 1.0,
    tailAnchorLow: 0.10, tailAnchorHigh: 0.90,
    minLength: 15, maxLength: 120, hazardMaxDay: 120,
    abstainGapDays: 90, abstainRecentSd: 6.0, abstainMinCycles: 0,
  };
}
