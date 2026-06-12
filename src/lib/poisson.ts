export function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logProb = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logProb -= Math.log(i);
  return Math.exp(logProb);
}

export interface MatchProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  lambdaHome: number;
  lambdaAway: number;
  // Probabilidades conjuntas — calculadas diretamente do modelo, não P(A)×P(B)
  drawBtts: number;       // Empate + Ambos marcam (1-1, 2-2, ...)
  drawUnder25: number;    // Empate + Under 2.5   (0-0, 1-1)
  homeWinBtts: number;    // Vitória mandante + Ambos marcam
  awayWinBtts: number;    // Vitória visitante + Ambos marcam
  homeWinOver25: number;  // Vitória mandante + Over 2.5
  awayWinOver25: number;  // Vitória visitante + Over 2.5
}

// Dixon-Coles (1997) low-score correction.
// Poisson overestimates 0-0 draws and underestimates 1-0/0-1 results.
// rho=-0.13 is the standard calibrated value for international football.
function dixonColesTau(i: number, j: number, lh: number, la: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

export function computeMatchProbabilities(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 10,
  rho = -0.13
): MatchProbabilities {
  let homeWin = 0, draw = 0, awayWin = 0, over25 = 0;
  let drawBtts = 0, drawUnder25 = 0;
  let homeWinBtts = 0, awayWinBtts = 0;
  let homeWinOver25 = 0, awayWinOver25 = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const tau = dixonColesTau(h, a, lambdaHome, lambdaAway, rho);
      const p = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a) * tau;
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a >= 3) over25 += p;
      // Combinados
      if (h === a && h > 0)      drawBtts      += p;
      if (h === a && h + a <= 2) drawUnder25   += p;
      if (h > a  && a > 0)       homeWinBtts   += p;
      if (a > h  && h > 0)       awayWinBtts   += p;
      if (h > a  && h + a >= 3)  homeWinOver25 += p;
      if (a > h  && h + a >= 3)  awayWinOver25 += p;
    }
  }

  // Normalize back to valid probability distributions
  // (Dixon-Coles correction slightly breaks normalization)
  const total1x2 = homeWin + draw + awayWin;
  if (total1x2 > 0) {
    homeWin /= total1x2;
    draw    /= total1x2;
    awayWin /= total1x2;
    over25  /= total1x2;
    drawBtts      /= total1x2;
    drawUnder25   /= total1x2;
    homeWinBtts   /= total1x2;
    awayWinBtts   /= total1x2;
    homeWinOver25 /= total1x2;
    awayWinOver25 /= total1x2;
  }

  const bttsYes =
    (1 - poissonProb(lambdaHome, 0)) * (1 - poissonProb(lambdaAway, 0));

  return {
    homeWin, draw, awayWin, over25,
    under25: 1 - over25,
    bttsYes, bttsNo: 1 - bttsYes,
    lambdaHome, lambdaAway,
    drawBtts, drawUnder25,
    homeWinBtts, awayWinBtts,
    homeWinOver25, awayWinOver25,
  };
}
