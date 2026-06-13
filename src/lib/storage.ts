const BANKROLL_KEY   = "wc2026_bankroll";
const BETS_KEY       = "wc2026_bets";
const ODDS_KEY       = "wc2026_odds";
const APIKEY_KEY     = "wc2026_apikey";
const TX_KEY         = "wc2026_transactions";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface BetRecord {
  id: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  label: string;
  odds: number;
  amount: number;
  edge: number;
  date: string;
  result?: "win" | "loss" | "void" | "cashout";
  profit?: number;
}

export interface BookmakerOdds {
  key: string;
  home: number;
  draw: number;
  away: number;
  over25?: number;
  under25?: number;
  bttsYes?: number;
  bttsNo?: number;
  cornersOver?: number;
  cornersUnder?: number;
  cornersLine?: number;
  overround?: number;  // sum of implied probs, e.g. 1.06 = 6% margin
  isSharp?: boolean;   // Pinnacle, Betfair Exchange, LowVig
}

export interface FixtureOdds {
  fixtureId: string;
  home: number;
  draw: number;
  away: number;
  over25?: number;
  under25?: number;
  bttsYes?: number;
  bttsNo?: number;
  cornersOver?: number;
  cornersUnder?: number;
  cornersLine?: number;
  dcHome?: number;  // Double Chance: home ou empate (calculado, devig)
  dcAway?: number;  // Double Chance: away ou empate (calculado, devig)
  bookmaker?: string;
  allBookmakers?: BookmakerOdds[];
  updatedAt: string;
}

export type TransactionType = "win" | "loss" | "void" | "adjustment" | "bet" | "cashout";

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;       // positivo = entrada, negativo = saída
  balance: number;      // saldo resultante após esta transação
  description: string;
  betId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isClient() {
  return typeof window !== "undefined";
}

export function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Bankroll ─────────────────────────────────────────────────────────────────

export function getBankroll(): number {
  if (!isClient()) return 100;
  const v = localStorage.getItem(BANKROLL_KEY);
  return v ? parseFloat(v) : 100;
}

export function setBankroll(value: number) {
  if (!isClient()) return;
  localStorage.setItem(BANKROLL_KEY, String(value));
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export function getBets(): BetRecord[] {
  if (!isClient()) return [];
  try { return JSON.parse(localStorage.getItem(BETS_KEY) ?? "[]"); } catch { return []; }
}

export function saveBet(bet: BetRecord) {
  const bets = getBets();
  const idx = bets.findIndex((b) => b.id === bet.id);
  if (idx >= 0) bets[idx] = bet;
  else bets.push(bet);
  if (isClient()) localStorage.setItem(BETS_KEY, JSON.stringify(bets));
}

export function updateBetResult(id: string, result: "win" | "loss" | "void", odds: number) {
  const bets = getBets();
  const bet = bets.find((b) => b.id === id);
  if (!bet) return;
  bet.result = result;
  // Stake was already deducted at placement, so:
  // win  → return stake + profit = odds × amount
  // loss → stake already gone, no further change
  // void → return stake (same as cancel)
  bet.profit =
    result === "win"  ? parseFloat(((odds - 1) * bet.amount).toFixed(2)) :
    result === "loss" ? -bet.amount : 0;
  if (isClient()) localStorage.setItem(BETS_KEY, JSON.stringify(bets));

  const delta = result === "win"
    ? parseFloat((odds * bet.amount).toFixed(2))
    : result === "void" ? bet.amount : 0;
  const newBalance = parseFloat((getBankroll() + delta).toFixed(2));
  setBankroll(newBalance);

  addTransaction({
    date: new Date().toISOString(),
    type: result,
    amount: delta,
    balance: newBalance,
    description: `${bet.label} @ ${bet.odds.toFixed(2)} — ${result === "win" ? "Ganhou" : result === "loss" ? "Perdeu" : "Void"}`,
    betId: id,
  });
}

export function cancelBet(id: string) {
  const bets = getBets();
  const bet = bets.find((b) => b.id === id);
  if (!bet || bet.result) return;
  const updated = bets.filter((b) => b.id !== id);
  if (isClient()) localStorage.setItem(BETS_KEY, JSON.stringify(updated));
  const newBalance = parseFloat((getBankroll() + bet.amount).toFixed(2));
  setBankroll(newBalance);
  addTransaction({
    date: new Date().toISOString(),
    type: "adjustment",
    amount: bet.amount,
    balance: newBalance,
    description: `Aposta cancelada — devolução R$ ${bet.amount.toFixed(2)} (${bet.label})`,
    betId: id,
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function getTransactions(): Transaction[] {
  if (!isClient()) return [];
  try { return JSON.parse(localStorage.getItem(TX_KEY) ?? "[]"); } catch { return []; }
}

export function addTransaction(t: Omit<Transaction, "id">) {
  if (!isClient()) return;
  const txs = getTransactions();
  txs.unshift({ ...t, id: uid() }); // mais recente primeiro
  localStorage.setItem(TX_KEY, JSON.stringify(txs.slice(0, 200))); // max 200
}

export function adjustBankroll(delta: number, description: string) {
  const newBalance = parseFloat((getBankroll() + delta).toFixed(2));
  setBankroll(newBalance);
  addTransaction({
    date: new Date().toISOString(),
    type: "adjustment",
    amount: delta,
    balance: newBalance,
    description: description || (delta >= 0 ? "Ajuste manual" : "Retirada manual"),
  });
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export function getFixtureOdds(fixtureId: string): FixtureOdds | null {
  if (!isClient()) return null;
  try {
    const all = JSON.parse(localStorage.getItem(ODDS_KEY) ?? "{}");
    return all[fixtureId] ?? null;
  } catch { return null; }
}

export function saveFixtureOdds(odds: FixtureOdds) {
  if (!isClient()) return;
  try {
    const all = JSON.parse(localStorage.getItem(ODDS_KEY) ?? "{}");
    all[odds.fixtureId] = odds;
    localStorage.setItem(ODDS_KEY, JSON.stringify(all));
  } catch {}
}

export function cashoutBet(id: string, cashoutAmount: number) {
  const bets = getBets();
  const bet = bets.find((b) => b.id === id);
  if (!bet || bet.result) return;
  bet.result = "cashout";
  bet.profit = parseFloat((cashoutAmount - bet.amount).toFixed(2));
  if (isClient()) localStorage.setItem(BETS_KEY, JSON.stringify(bets));

  const newBalance = parseFloat((getBankroll() + cashoutAmount).toFixed(2));
  setBankroll(newBalance);
  addTransaction({
    date: new Date().toISOString(),
    type: "cashout",
    amount: cashoutAmount,
    balance: newBalance,
    description: `Cashout: ${bet.label} @ ${bet.odds.toFixed(2)} — R$ ${cashoutAmount.toFixed(2)} resgatado`,
    betId: id,
  });
}

// ─── API Key ──────────────────────────────────────────────────────────────────

export function getApiKey(): string {
  if (!isClient()) return "";
  return localStorage.getItem(APIKEY_KEY) ?? "";
}

export function setApiKey(key: string) {
  if (!isClient()) return;
  localStorage.setItem(APIKEY_KEY, key);
}
