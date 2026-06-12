import { computeMatchProbabilities, MatchProbabilities } from "./poisson";
import { kellyBet, KellyResult } from "./kelly";
import { getTeamStrength, TeamStrength, BASE_GOALS, HOST_ADVANTAGE } from "@/data/teams";
import type { H2HSummary } from "./apiClient";

export interface Odds {
  home: number;
  draw: number;
  away: number;
  over25?: number;
  under25?: number;
  bttsYes?: number;
  bttsNo?: number;
}

export type DataQuality = "good" | "partial" | "poor";

export interface BetRecommendation {
  market: string;
  ourProb: number;
  impliedProb: number;    // raw: 1/odds
  fairImpliedProb: number; // de-vigged market probability
  overround: number;
  edge: number;           // ourProb - fairImpliedProb (honest edge)
  odds: number;
  kelly: KellyResult;
  label: string;
  dataQuality: DataQuality;
  divergenceRatio: number;
  warnings: string[];
  isCombo?: boolean;
  comboLegs?: string[];   // e.g. ["Empate", "Ambos marcam"]
}

export interface MatchAnalysis {
  probabilities: MatchProbabilities;
  recommendations: BetRecommendation[];
  comboRecommendations: BetRecommendation[];
  strengthSource: "api" | "sofascore" | "espn" | "flashscore" | "fallback";
  homeMatches: number;
  awayMatches: number;
  h2hAdjusted: boolean;
  sharpLine: boolean;
}

export interface AnalysisOptions {
  homeIsHost?: boolean;
  homeStrength?: TeamStrength | null;
  awayStrength?: TeamStrength | null;
  injuryFactorHome?: number;
  injuryFactorAway?: number;
  h2h?: H2HSummary | null;
}

// ─── De-vig ────────────────────────────────────────────────────────────────────
// Removes bookmaker margin from implied probabilities.
// A 6% overround book prices a 50% event at 1/(0.50×1.06)≈1.89; de-vigged prob = 0.53.

function deVig1X2(h: number, d: number, a: number) {
  const vig = 1 / h + 1 / d + 1 / a;
  return {
    fairHome: (1 / h) / vig,
    fairDraw: (1 / d) / vig,
    fairAway: (1 / a) / vig,
    overround: vig,
  };
}

function deVig2Way(o1: number, o2: number) {
  const vig = 1 / o1 + 1 / o2;
  return { fair1: (1 / o1) / vig, fair2: (1 / o2) / vig, overround: vig };
}

// ─── Bayesian shrinkage ────────────────────────────────────────────────────────
const PRIOR_WEIGHT = 20;
function shrink(value: number, matches: number): number {
  return (value * matches + PRIOR_WEIGHT * 1.0) / (matches + PRIOR_WEIGHT);
}

function getMatches(s: TeamStrength): number {
  return (s as { matches?: number }).matches ?? 0;
}

function isApiSource(s: TeamStrength | null | undefined): boolean {
  const src = (s as { source?: string })?.source;
  return src === "api" || src === "sofascore" || src === "espn" || src === "flashscore";
}

// ─── Dynamic edge threshold ────────────────────────────────────────────────────
function minEdgeFor(fairProb: number): number {
  if (fairProb < 0.12) return 0.12;
  if (fairProb < 0.20) return 0.08;
  if (fairProb < 0.30) return 0.06;
  return 0.04;
}

export function analyzeMatch(
  homeTeam: string,
  awayTeam: string,
  odds: Odds,
  bankroll: number,
  options: AnalysisOptions = {}
): MatchAnalysis {
  const {
    homeIsHost = false, homeStrength, awayStrength,
    injuryFactorHome = 1, injuryFactorAway = 1,
    h2h = null,
  } = options;

  const homeRaw = homeStrength ?? getTeamStrength(homeTeam);
  const awayRaw = awayStrength ?? getTeamStrength(awayTeam);

  const homeMatches = getMatches(homeRaw);
  const awayMatches = getMatches(awayRaw);
  const homeIsApi = isApiSource(homeStrength);
  const awayIsApi = isApiSource(awayStrength);
  const rawSource = (homeStrength as { source?: string })?.source;
  const strengthSource: "api" | "sofascore" | "espn" | "flashscore" | "fallback" = homeIsApi
    ? ((rawSource === "sofascore" || rawSource === "espn" || rawSource === "flashscore" ? rawSource : "api") as "api" | "sofascore" | "espn" | "flashscore")
    : "fallback";

  // Bayesian shrinkage
  let homeAttack  = homeMatches > 0 ? shrink(homeRaw.attack,  homeMatches) : homeRaw.attack;
  let homeDefense = homeMatches > 0 ? shrink(homeRaw.defense, homeMatches) : homeRaw.defense;
  let awayAttack  = awayMatches > 0 ? shrink(awayRaw.attack,  awayMatches) : awayRaw.attack;
  let awayDefense = awayMatches > 0 ? shrink(awayRaw.defense, awayMatches) : awayRaw.defense;

  // H2H blend (80% current form, 20% historical matchup)
  // Only applied when sample is large enough to be meaningful.
  let h2hAdjusted = false;
  if (h2h && h2h.totalMatches >= 3) {
    const h2hHomeAttack  = h2h.team1AvgGoals / BASE_GOALS;
    const h2hHomeDefense = h2h.team2AvgGoals / BASE_GOALS;
    const h2hAwayAttack  = h2h.team2AvgGoals / BASE_GOALS;
    const h2hAwayDefense = h2h.team1AvgGoals / BASE_GOALS;
    homeAttack  = 0.80 * homeAttack  + 0.20 * h2hHomeAttack;
    homeDefense = 0.80 * homeDefense + 0.20 * h2hHomeDefense;
    awayAttack  = 0.80 * awayAttack  + 0.20 * h2hAwayAttack;
    awayDefense = 0.80 * awayDefense + 0.20 * h2hAwayDefense;
    h2hAdjusted = true;
  }

  const hostFactor = homeIsHost ? HOST_ADVANTAGE : 1.0;
  const lambdaHome = BASE_GOALS * homeAttack * awayDefense * hostFactor * injuryFactorHome;
  const lambdaAway = BASE_GOALS * awayAttack * homeDefense * injuryFactorAway;

  const probs = computeMatchProbabilities(lambdaHome, lambdaAway);

  // De-vig the 1X2 market for honest edge calculation
  const dv1x2 = deVig1X2(odds.home, odds.draw, odds.away);
  const fairMap: Record<string, number> = {
    [`${homeTeam} vence`]: dv1x2.fairHome,
    "Empate":              dv1x2.fairDraw,
    [`${awayTeam} vence`]: dv1x2.fairAway,
  };
  const mainOverround = dv1x2.overround;

  // Detect whether the reference line is from a sharp book
  // (passed implicitly through the odds object being sharp-selected in apiClient)
  const sharpLine = mainOverround < 1.04; // <4% margin = sharp

  const dataQuality: DataQuality =
    homeIsApi && awayIsApi   ? "good"    :
    !homeIsApi && !awayIsApi ? "poor"    : "partial";

  const dataMultiplier =
    dataQuality === "good"    ? 1.0 :
    dataQuality === "partial" ? 0.5 : 0.25;

  const candidates = [
    { market: "1X2", ourProb: probs.homeWin, odds: odds.home, label: `${homeTeam} vence` },
    { market: "1X2", ourProb: probs.draw,    odds: odds.draw, label: "Empate"            },
    { market: "1X2", ourProb: probs.awayWin, odds: odds.away, label: `${awayTeam} vence` },
    ...(odds.over25  != null ? [{ market: "O/U",  ourProb: probs.over25,  odds: odds.over25,  label: "Over 2.5 gols"      }] : []),
    ...(odds.under25 != null ? [{ market: "O/U",  ourProb: probs.under25, odds: odds.under25, label: "Under 2.5 gols"     }] : []),
    ...(odds.bttsYes != null ? [{ market: "BTTS", ourProb: probs.bttsYes, odds: odds.bttsYes, label: "Ambos marcam - Sim" }] : []),
    ...(odds.bttsNo  != null ? [{ market: "BTTS", ourProb: probs.bttsNo,  odds: odds.bttsNo,  label: "Ambos marcam - Não" }] : []),
  ];

  const recommendations: BetRecommendation[] = candidates
    .map((c) => {
      const rawImplied = 1 / c.odds;

      // Use de-vigged fair probability for edge calculation
      let fairImpliedProb: number;
      let overround: number;
      if (c.market === "1X2") {
        fairImpliedProb = fairMap[c.label] ?? rawImplied;
        overround = mainOverround;
      } else if (c.market === "O/U" && odds.over25 && odds.under25) {
        const dv = deVig2Way(odds.over25, odds.under25);
        fairImpliedProb = c.label.startsWith("Over") ? dv.fair1 : dv.fair2;
        overround = dv.overround;
      } else if (c.market === "BTTS" && odds.bttsYes && odds.bttsNo) {
        const dv = deVig2Way(odds.bttsYes, odds.bttsNo);
        fairImpliedProb = c.label.includes("Sim") ? dv.fair1 : dv.fair2;
        overround = dv.overround;
      } else {
        fairImpliedProb = rawImplied;
        overround = 1;
      }

      const edge = c.ourProb - fairImpliedProb;
      const divergenceRatio = fairImpliedProb > 0 ? c.ourProb / fairImpliedProb : 1;

      const divergencePenalty = divergenceRatio <= 1.5 ? 1.0
        : Math.min(1.0, 1.5 / divergenceRatio);

      const effectiveMultiplier = dataMultiplier * divergencePenalty;

      const rawKelly = kellyBet(c.ourProb, c.odds, bankroll);
      const adjustedKelly: KellyResult = {
        ...rawKelly,
        fraction:      rawKelly.fraction      * effectiveMultiplier,
        halfFraction:  rawKelly.halfFraction  * effectiveMultiplier,
        betAmount:     Math.round(rawKelly.betAmount     * effectiveMultiplier * 100) / 100,
        halfBetAmount: Math.round(rawKelly.halfBetAmount * effectiveMultiplier * 100) / 100,
      };

      const warnings: string[] = [];
      if (dataQuality === "poor")
        warnings.push("Nenhum time tem dados históricos confiáveis — modelo muito incerto");
      else if (dataQuality === "partial")
        warnings.push("Um dos times sem dados reais — força estimada por ranking FIFA");
      if (homeMatches > 0 && homeMatches < 10)
        warnings.push(`${homeTeam}: apenas ${homeMatches} jogo(s) — dados insuficientes`);
      if (awayMatches > 0 && awayMatches < 10)
        warnings.push(`${awayTeam}: apenas ${awayMatches} jogo(s) — dados insuficientes`);
      if (divergenceRatio > 2.5)
        warnings.push(`Modelo diverge ${divergenceRatio.toFixed(1)}× do mercado — mercado provavelmente sabe mais`);
      else if (divergenceRatio > 1.8)
        warnings.push(`Divergência moderada (${divergenceRatio.toFixed(1)}×) — aposta reduzida automaticamente`);
      if (fairImpliedProb < 0.20)
        warnings.push(`Azarão extremo (odds ${c.odds.toFixed(2)}) — risco muito elevado`);

      return {
        ...c,
        impliedProb: rawImplied,
        fairImpliedProb,
        overround,
        edge,
        kelly: adjustedKelly,
        dataQuality,
        divergenceRatio,
        warnings,
      };
    })
    .filter((r) => {
      if (!r.kelly.hasValue) return false;
      if (r.edge < minEdgeFor(r.fairImpliedProb)) return false;
      if (dataQuality === "poor" && r.fairImpliedProb < 0.30) return false;
      return true;
    })
    .sort((a, b) => b.kelly.fraction - a.kelly.fraction);

  // ─── Mercados combinados ───────────────────────────────────────────────────────
  // Probabilidades conjuntas são calculadas diretamente pelo Poisson (não P(A)×P(B)),
  // capturando a correlação real entre resultado e gols.
  // Odds estimadas como parlay (odd_A × odd_B) — o usuário deve conferir na casa.

  const dvBtts = odds.bttsYes != null && odds.bttsNo != null
    ? deVig2Way(odds.bttsYes, odds.bttsNo) : null;
  const dvOU = odds.over25 != null && odds.under25 != null
    ? deVig2Way(odds.over25, odds.under25) : null;

  const comboDefs: Array<{
    ourProb: number; odds: number; label: string;
    fairImpliedProb: number; overround: number; comboLegs: string[];
  }> = [];

  if (dvBtts && odds.bttsYes != null) {
    comboDefs.push({
      ourProb: probs.drawBtts,
      odds: odds.draw * odds.bttsYes,
      label: "Empate + Ambos marcam",
      fairImpliedProb: dv1x2.fairDraw * dvBtts.fair1,
      overround: dv1x2.overround * dvBtts.overround,
      comboLegs: ["Empate", "Ambos marcam"],
    });
    comboDefs.push({
      ourProb: probs.homeWinBtts,
      odds: odds.home * odds.bttsYes,
      label: `${homeTeam} vence + Ambos marcam`,
      fairImpliedProb: dv1x2.fairHome * dvBtts.fair1,
      overround: dv1x2.overround * dvBtts.overround,
      comboLegs: [`${homeTeam} vence`, "Ambos marcam"],
    });
    comboDefs.push({
      ourProb: probs.awayWinBtts,
      odds: odds.away * odds.bttsYes,
      label: `${awayTeam} vence + Ambos marcam`,
      fairImpliedProb: dv1x2.fairAway * dvBtts.fair1,
      overround: dv1x2.overround * dvBtts.overround,
      comboLegs: [`${awayTeam} vence`, "Ambos marcam"],
    });
  }
  if (dvOU) {
    comboDefs.push({
      ourProb: probs.drawUnder25,
      odds: odds.draw * odds.under25!,
      label: "Empate + Under 2.5 gols",
      fairImpliedProb: dv1x2.fairDraw * dvOU.fair2,
      overround: dv1x2.overround * dvOU.overround,
      comboLegs: ["Empate", "Under 2.5 gols"],
    });
    comboDefs.push({
      ourProb: probs.homeWinOver25,
      odds: odds.home * odds.over25!,
      label: `${homeTeam} vence + Over 2.5 gols`,
      fairImpliedProb: dv1x2.fairHome * dvOU.fair1,
      overround: dv1x2.overround * dvOU.overround,
      comboLegs: [`${homeTeam} vence`, "Over 2.5 gols"],
    });
    comboDefs.push({
      ourProb: probs.awayWinOver25,
      odds: odds.away * odds.over25!,
      label: `${awayTeam} vence + Over 2.5 gols`,
      fairImpliedProb: dv1x2.fairAway * dvOU.fair1,
      overround: dv1x2.overround * dvOU.overround,
      comboLegs: [`${awayTeam} vence`, "Over 2.5 gols"],
    });
  }

  const comboRecommendations: BetRecommendation[] = comboDefs
    .map((c) => {
      const rawImplied = 1 / c.odds;
      const edge = c.ourProb - c.fairImpliedProb;
      const divergenceRatio = c.fairImpliedProb > 0 ? c.ourProb / c.fairImpliedProb : 1;
      const divergencePenalty = divergenceRatio <= 1.5 ? 1.0 : Math.min(1.0, 1.5 / divergenceRatio);
      const effectiveMultiplier = dataMultiplier * divergencePenalty;

      const rawKelly = kellyBet(c.ourProb, c.odds, bankroll);
      const adjustedKelly: KellyResult = {
        ...rawKelly,
        fraction:      rawKelly.fraction      * effectiveMultiplier,
        halfFraction:  rawKelly.halfFraction  * effectiveMultiplier,
        betAmount:     Math.round(rawKelly.betAmount     * effectiveMultiplier * 100) / 100,
        halfBetAmount: Math.round(rawKelly.halfBetAmount * effectiveMultiplier * 100) / 100,
      };

      const warnings: string[] = ["Odd estimada como parlay — confirme o valor real na casa de apostas"];
      if (dataQuality !== "good")
        warnings.push("Dados incompletos — aposta reduzida automaticamente");
      if (divergenceRatio > 2.5)
        warnings.push(`Modelo diverge ${divergenceRatio.toFixed(1)}× do mercado — confiança baixa`);

      return {
        market: "COMBO",
        ourProb: c.ourProb,
        impliedProb: rawImplied,
        fairImpliedProb: c.fairImpliedProb,
        overround: c.overround,
        edge,
        odds: c.odds,
        kelly: adjustedKelly,
        label: c.label,
        dataQuality,
        divergenceRatio,
        warnings,
        isCombo: true,
        comboLegs: c.comboLegs,
      };
    })
    .filter((r) => {
      if (!r.kelly.hasValue) return false;
      if (r.edge < minEdgeFor(r.fairImpliedProb)) return false;
      return true;
    })
    .sort((a, b) => b.kelly.fraction - a.kelly.fraction);

  return {
    probabilities: probs, recommendations, comboRecommendations, strengthSource,
    homeMatches, awayMatches, h2hAdjusted, sharpLine,
  };
}
