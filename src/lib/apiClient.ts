import { FixtureOdds, BookmakerOdds } from "./storage";
import { getTeamApiId } from "@/data/teamApiIds";
import { TeamStrength } from "@/data/teams";
import { getFlashscoreId } from "@/data/flashscoreIds";

// ─── Name aliases (The Odds API uses different names than we do) ───────────────

const TEAM_ALIASES: Record<string, string[]> = {
  USA: ["United States", "USA", "United States of America"],
  "South Korea": ["Korea Republic", "South Korea", "Republic of Korea"],
  "Ivory Coast": ["Cote d'Ivoire", "Ivory Coast", "Côte d'Ivoire"],
  "Czech Republic": ["Czechia", "Czech Republic"],
  "Saudi Arabia": ["Saudi Arabia"],
  "Costa Rica": ["Costa Rica"],
  "El Salvador": ["El Salvador"],
  "New Zealand": ["New Zealand"],
  "South Africa": ["South Africa"],
};

function buildAliasSet(name: string): string[] {
  return TEAM_ALIASES[name] ?? [name];
}

// ─── Fuzzy matching ────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, " ").trim();
}

export function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  // Try aliases
  const aliasesA = buildAliasSet(a).map(normalize);
  const aliasesB = buildAliasSet(b).map(normalize);
  return aliasesA.some((aa) => aliasesB.some((ab) => aa === ab || aa.includes(ab) || ab.includes(aa)));
}

// ─── Odds API ─────────────────────────────────────────────────────────────────

export interface OddsApiEvent {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
}

const ODDS_CACHE_KEY = "wc2026_odds_events_v2";
const ODDS_CACHE_TTL = 30 * 60 * 1000; // 30 min

interface OddsCache { events: OddsApiEvent[]; ts: number; remaining: string | null }

export function readOddsCache(): OddsCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ODDS_CACHE_KEY);
    if (!raw) return null;
    const c: OddsCache = JSON.parse(raw);
    if (Date.now() - c.ts > ODDS_CACHE_TTL) return null;
    return c;
  } catch { return null; }
}

export function writeOddsCache(events: OddsApiEvent[], remaining: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ODDS_CACHE_KEY, JSON.stringify({ events, ts: Date.now(), remaining }));
}

// Sharp bookmakers have ~2% margin and reflect professional money —
// use them as the analysis reference when available.
const SHARP_BOOKS = new Set([
  "pinnacle", "betfair_ex_eu", "betfair_ex_uk", "betfair", "lowvig_ag",
]);

export function extractOddsFromEvents(
  events: OddsApiEvent[],
  homeTeam: string,
  awayTeam: string,
  fixtureId: string
): FixtureOdds | null {
  const event = events.find(
    (e) => fuzzyMatch(e.home_team, homeTeam) && fuzzyMatch(e.away_team, awayTeam)
  );
  if (!event) return null;

  const allBookmakers: BookmakerOdds[] = [];

  for (const bm of event.bookmakers) {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;
    const home = h2h.outcomes.find((o) => fuzzyMatch(o.name, homeTeam))?.price ?? 0;
    const away = h2h.outcomes.find((o) => fuzzyMatch(o.name, awayTeam))?.price ?? 0;
    const draw = h2h.outcomes.find((o) => normalize(o.name) === "draw")?.price ?? 0;
    if (!home || !away || !draw) continue;

    const totals = bm.markets.find((m) => m.key === "totals");
    const over = totals?.outcomes.find((o) => o.name === "Over" && o.point === 2.5)?.price;
    const under = totals?.outcomes.find((o) => o.name === "Under" && o.point === 2.5)?.price;

    const bttsMarket = bm.markets.find((m) => m.key === "btts");
    const bttsYes = bttsMarket?.outcomes.find((o) => o.name === "Yes")?.price;
    const bttsNo  = bttsMarket?.outcomes.find((o) => o.name === "No")?.price;

    const overround = 1 / home + 1 / draw + 1 / away;
    allBookmakers.push({
      key: bm.key, home, draw, away, over25: over, under25: under,
      bttsYes, bttsNo,
      overround, isSharp: SHARP_BOOKS.has(bm.key),
    });
  }

  if (!allBookmakers.length) return null;

  // Select reference bookmaker for analysis:
  // prefer sharp (low-margin) books, then lowest overround among the rest.
  const sharps = allBookmakers.filter((b) => b.isSharp);
  const ref = sharps.length > 0
    ? sharps.reduce((best, b) => (b.overround ?? 99) < (best.overround ?? 99) ? b : best)
    : allBookmakers.reduce((best, b) => (b.overround ?? 99) < (best.overround ?? 99) ? b : best);

  // Best retail odds per outcome for when the user actually places the bet
  const bestRetailHome  = Math.max(...allBookmakers.map((b) => b.home));
  const bestRetailAway  = Math.max(...allBookmakers.map((b) => b.away));
  const bestRetailDraw  = Math.max(...allBookmakers.map((b) => b.draw));
  const bestRetailOver    = Math.max(...allBookmakers.map((b) => b.over25  ?? 0)) || undefined;
  const bestRetailUnder   = Math.max(...allBookmakers.map((b) => b.under25 ?? 0)) || undefined;
  const bestRetailBttsYes = Math.max(...allBookmakers.map((b) => b.bttsYes ?? 0)) || undefined;
  const bestRetailBttsNo  = Math.max(...allBookmakers.map((b) => b.bttsNo  ?? 0)) || undefined;

  return {
    fixtureId,
    // Analysis reference: sharp/low-margin odds
    home: ref.home,
    draw: ref.draw,
    away: ref.away,
    over25:   ref.over25   ?? bestRetailOver,
    under25:  ref.under25  ?? bestRetailUnder,
    bttsYes:  ref.bttsYes  ?? bestRetailBttsYes,
    bttsNo:   ref.bttsNo   ?? bestRetailBttsNo,
    bookmaker: ref.key,
    // Retail-best odds are stored separately in allBookmakers for the UI
    allBookmakers: allBookmakers.map((b) => ({
      ...b,
      // Mark the best available retail odds for each outcome
      home:  b.home  === bestRetailHome  ? b.home  : b.home,
      away:  b.away  === bestRetailAway  ? b.away  : b.away,
      draw:  b.draw  === bestRetailDraw  ? b.draw  : b.draw,
    })),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Team Strength ─────────────────────────────────────────────────────────────

export interface RealTeamStrength extends TeamStrength {
  source: "api" | "sofascore" | "espn" | "flashscore" | "fallback";
  matches: number;
  avgScored?: number;
  avgConceded?: number;
  lastFiveResults?: Array<"W" | "D" | "L">;
  styleModifier?: number; // 0.90–1.10: ajuste por estilo físico/ofensivo via cartões
  error?: string;
}

export interface H2HSummary {
  totalMatches: number;
  team1Wins: number;
  draws: number;
  team2Wins: number;
  team1AvgGoals: number;
  team2AvgGoals: number;
  recentMatches: Array<{ date: string; score: string; result: "team1" | "draw" | "team2" }>;
}

const STRENGTH_CACHE_KEY = "wc2026_strength_v3";
const STRENGTH_TTL = 24 * 60 * 60 * 1000;

interface StrengthCacheEntry { data: RealTeamStrength; ts: number }

function readStrengthCache(): Record<string, StrengthCacheEntry> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STRENGTH_CACHE_KEY) ?? "{}"); } catch { return {}; }
}
function writeStrengthCache(c: Record<string, StrengthCacheEntry>) {
  localStorage.setItem(STRENGTH_CACHE_KEY, JSON.stringify(c));
}


async function fetchFromFlashscore(teamName: string): Promise<RealTeamStrength | null> {
  const fsInfo = getFlashscoreId(teamName);
  if (!fsInfo) return null;
  try {
    const res = await fetch(`/api/flashscore?teamId=${fsInfo.id}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.matches || json.matches === 0) return null;
    return {
      name: teamName,
      attack: json.attack,
      defense: json.defense,
      fifaRank: 0,
      source: "flashscore",
      matches: json.matches,
      avgScored: json.avgScored,
      avgConceded: json.avgConceded,
      lastFiveResults: json.lastFiveResults,
      styleModifier: json.styleModifier ?? 1.0,
    };
  } catch { return null; }
}

async function fetchFromEspn(teamName: string): Promise<RealTeamStrength | null> {
  try {
    const res = await fetch(`/api/teams/strength?name=${encodeURIComponent(teamName)}`);
    const json = await res.json();
    if (!res.ok || json.error || !json.matches || json.matches === 0) return null;
    return {
      name: teamName,
      attack: parseFloat(json.attack.toFixed(3)),
      defense: parseFloat(json.defense.toFixed(3)),
      fifaRank: 0,
      source: json.source ?? "espn",
      matches: json.matches,
      avgScored: json.avgScored,
      avgConceded: json.avgConceded,
      lastFiveResults: json.lastFiveResults,
    };
  } catch { return null; }
}

export async function fetchTeamStrength(
  teamName: string,
  forceRefresh = false
): Promise<RealTeamStrength | null> {
  const cache = readStrengthCache();
  const entry = cache[teamName];
  if (!forceRefresh && entry && Date.now() - entry.ts < STRENGTH_TTL) {
    return entry.data;
  }

  // Try Flashscore first (has real match data for all Copa teams)
  const flashscoreData = await fetchFromFlashscore(teamName);
  if (flashscoreData) {
    writeStrengthCache({ ...readStrengthCache(), [teamName]: { data: flashscoreData, ts: Date.now() } });
    return flashscoreData;
  }

  // Fallback to ESPN
  const espnData = await fetchFromEspn(teamName);
  if (espnData) {
    writeStrengthCache({ ...readStrengthCache(), [teamName]: { data: espnData, ts: Date.now() } });
    return espnData;
  }

  return null;
}

export function clearAllCaches() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STRENGTH_CACHE_KEY);
  localStorage.removeItem(ODDS_CACHE_KEY);
  localStorage.removeItem(H2H_CACHE_KEY);
}

// ─── H2H ──────────────────────────────────────────────────────────────────────

const H2H_CACHE_KEY = "wc2026_h2h_v1";

function readH2HCache(): Record<string, H2HSummary> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(H2H_CACHE_KEY) ?? "{}"); } catch { return {}; }
}
function writeH2HCache(c: Record<string, H2HSummary>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(H2H_CACHE_KEY, JSON.stringify(c));
}

export async function fetchH2H(
  homeTeam: string,
  awayTeam: string,
): Promise<H2HSummary | null> {
  const homeId = getTeamApiId(homeTeam);
  const awayId = getTeamApiId(awayTeam);
  if (!homeId || !awayId) return null;

  const cacheKey = `${homeId}-${awayId}`;
  const cache = readH2HCache();
  if (cache[cacheKey]) return cache[cacheKey];

  try {
    const res = await fetch(`/api/teams/h2h?h2hKey=${cacheKey}`);
    if (!res.ok) return null;
    const json: H2HSummary = await res.json();
    if (json.totalMatches === undefined) return null;
    writeH2HCache({ ...readH2HCache(), [cacheKey]: json });
    return json;
  } catch { return null; }
}

// ─── Injuries ─────────────────────────────────────────────────────────────────

export interface InjuryInfo { playerName: string; type: string; reason: string }

export interface MatchInjuries {
  home: InjuryInfo[];
  away: InjuryInfo[];
  attackPenaltyHome: number;
  attackPenaltyAway: number;
}

function injuryPenalty(injuries: InjuryInfo[]): number {
  let penalty = 0;
  for (const inj of injuries) {
    if (inj.type === "Missing Fixture") penalty += 0.05;
    else if (inj.type === "Questionable") penalty += 0.02;
  }
  return Math.max(0.8, 1 - Math.min(penalty, 0.2));
}

export async function fetchInjuries(
  homeTeam: string,
  awayTeam: string,
  date: string
): Promise<MatchInjuries | null> {
  const homeId = getTeamApiId(homeTeam);
  const awayId = getTeamApiId(awayTeam);
  if (!homeId || !awayId) return null;

  try {
    const res = await fetch(
      `/api/injuries?homeId=${homeId}&awayId=${awayId}&date=${date.split("T")[0]}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;

    const mapInjury = (p: { player: { name: string }; type: string; reason: string }): InjuryInfo => ({
      playerName: p.player.name,
      type: p.type,
      reason: p.reason,
    });

    const home: InjuryInfo[] = (json.home ?? []).map(mapInjury);
    const away: InjuryInfo[] = (json.away ?? []).map(mapInjury);
    return { home, away, attackPenaltyHome: injuryPenalty(home), attackPenaltyAway: injuryPenalty(away) };
  } catch { return null; }
}
