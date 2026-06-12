export interface KellyResult {
  fraction: number;
  halfFraction: number;
  betAmount: number;
  halfBetAmount: number;
  hasValue: boolean;
  edge: number;
}

export function kellyBet(
  ourProbability: number,
  decimalOdds: number,
  bankroll: number
): KellyResult {
  const b = decimalOdds - 1;
  const p = ourProbability;
  const q = 1 - p;

  const fraction = (b * p - q) / b;
  const halfFraction = fraction / 2;
  const hasValue = fraction > 0;
  const impliedProb = 1 / decimalOdds;
  const edge = p - impliedProb;

  return {
    fraction: Math.max(0, fraction),
    halfFraction: Math.max(0, halfFraction),
    betAmount: hasValue ? Math.round(Math.max(0, fraction) * bankroll * 100) / 100 : 0,
    halfBetAmount: hasValue ? Math.round(Math.max(0, halfFraction) * bankroll * 100) / 100 : 0,
    hasValue,
    edge,
  };
}

export function impliedProbability(decimalOdds: number): number {
  return 1 / decimalOdds;
}
