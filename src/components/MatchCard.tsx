"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { EnrichedFixture } from "@/app/page";
import {
  FixtureOdds, BookmakerOdds, BetRecord, saveBet, getBets,
  getFixtureOdds, saveFixtureOdds, updateBetResult, cancelBet,
  setBankroll, addTransaction, uid,
} from "@/lib/storage";
import { analyzeMatch, BetRecommendation } from "@/lib/analysis";
import { TEAMS } from "@/data/teams";
import { MatchProbabilities } from "@/lib/poisson";
import {
  fetchTeamStrength, fetchInjuries, fetchH2H,
  InjuryInfo, RealTeamStrength, H2HSummary, extractOddsFromEvents,
} from "@/lib/apiClient";
import OddsInput from "./OddsInput";
import {
  ChevronDown, ChevronUp, TrendingUp, Target,
  AlertTriangle, Wifi, WifiOff, RefreshCw, ExternalLink, X,
  HelpCircle,
} from "lucide-react";

interface Props {
  fixture: EnrichedFixture;
  bankroll: number;
  onBankrollChange: () => void;
}

interface BetFormState { amount: string; odds: string }

// ─── Bookmaker metadata ────────────────────────────────────────────────────────

const BOOKMAKER_NAMES: Record<string, string> = {
  betfair: "Betfair", betfair_ex_eu: "Betfair Exchange", betfair_ex_uk: "Betfair Exchange UK",
  pinnacle: "Pinnacle", bet365: "Bet365", unibet: "Unibet", unibet_eu: "Unibet EU",
  williamhill: "William Hill", betway: "Betway", draftkings: "DraftKings",
  fanduel: "FanDuel", betmgm: "BetMGM", caesars: "Caesars", bovada: "Bovada",
  mybookie_ag: "MyBookie", betonlineag: "BetOnline", lowvig_ag: "LowVig",
  betus: "BetUS", nordicbet: "NordicBet", betsson: "Betsson",
  onexbet: "1xBet", sport888: "888sport", ladbrokes_au: "Ladbrokes",
  skybet: "Sky Bet", coral: "Coral", paddypower: "Paddy Power",
};

// Seção de futebol de cada casa — mais estável do que links copa-específicos
const BOOKMAKER_COPA_URLS: Record<string, string> = {
  betfair_ex_eu:  "https://www.betfair.com/exchange/plus/football",
  betfair_ex_uk:  "https://www.betfair.com/exchange/plus/football",
  betfair:        "https://www.betfair.com/sport/football",
  pinnacle:       "https://www.pinnacle.com/en/soccer/matchups",
  bet365:         "https://www.bet365.com/#/soccer",
  unibet:         "https://www.unibet.com/sport/football",
  unibet_eu:      "https://www.unibet.eu/sport/football",
  williamhill:    "https://www.williamhill.com/sport/football",
  betway:         "https://betway.com/en/sports/grp/football",
  betsson:        "https://www.betsson.com/en/sports/football",
  bovada:         "https://www.bovada.lv/sports/soccer",
  mybookie_ag:    "https://www.mybookie.ag/sportsbook/soccer",
  betonlineag:    "https://www.betonline.ag/sportsbook/soccer",
  lowvig_ag:      "https://www.lowvig.ag/sportsbook/soccer",
  draftkings:     "https://sportsbook.draftkings.com/leagues/soccer",
  fanduel:        "https://sportsbook.fanduel.com/soccer",
  nordicbet:      "https://www.nordicbet.com/en/sports/football",
  onexbet:        "https://www.1xbet.com/en/sport/football",
  skybet:         "https://m.skybet.com/football",
  paddypower:     "https://www.paddypower.com/football",
  coral:          "https://www.coral.co.uk/sport/football",
};

function bookmakerName(key: string) {
  return BOOKMAKER_NAMES[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bookmakerCopaUrl(key: string): string | null {
  return BOOKMAKER_COPA_URLS[key] ?? null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function edgeColor(edge: number) {
  if (edge >= 0.08) return "text-green-400";
  if (edge >= 0.04) return "text-yellow-400";
  return "text-orange-400";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

// Extrai a odd relevante de um bookmaker para o mercado desta recomendação
function getRelevantOdds(rec: BetRecommendation, bm: BookmakerOdds, homeTeam: string, awayTeam: string): number | undefined {
  const lbl = rec.label.toLowerCase();
  if (lbl.includes("over"))  return bm.over25;
  if (lbl.includes("under")) return bm.under25;
  if (lbl === "empate")      return bm.draw;
  // 1X2 home ou away
  if (rec.label.toLowerCase().includes(homeTeam.toLowerCase())) return bm.home;
  if (rec.label.toLowerCase().includes(awayTeam.toLowerCase())) return bm.away;
  return undefined;
}

// Gera lista de TODOS os candidatos com razão de aceite/rejeição
function buildAllCandidates(
  probs: MatchProbabilities,
  fixtureOdds: FixtureOdds,
  homeTeam: string,
  awayTeam: string,
) {
  const MIN_EDGE = 0.04;
  const raw = [
    { label: `${homeTeam} vence`,  ourProb: probs.homeWin,  marketOdds: fixtureOdds.home },
    { label: "Empate",              ourProb: probs.draw,     marketOdds: fixtureOdds.draw },
    { label: `${awayTeam} vence`,  ourProb: probs.awayWin,  marketOdds: fixtureOdds.away },
    ...(fixtureOdds.over25  ? [{ label: "Over 2.5 gols",   ourProb: probs.over25,  marketOdds: fixtureOdds.over25  }] : []),
    ...(fixtureOdds.under25 ? [{ label: "Under 2.5 gols",  ourProb: probs.under25, marketOdds: fixtureOdds.under25 }] : []),
  ];
  return raw.map((c) => {
    const impliedProb = 1 / c.marketOdds;
    const edge = c.ourProb - impliedProb;
    let reason: string | null = null;
    if (edge < 0)        reason = `modelo ${(c.ourProb*100).toFixed(1)}% < implícita ${(impliedProb*100).toFixed(1)}% → sem valor`;
    else if (edge < MIN_EDGE) reason = `edge ${(edge*100).toFixed(1)}% abaixo do mínimo de 4%`;
    return { ...c, impliedProb, edge, accepted: !reason, reason };
  });
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function SourceBadge({
  label, href, color = "gray",
}: { label: string; href?: string; color?: "green" | "yellow" | "gray" }) {
  const cls =
    color === "green"  ? "bg-green-900/40 text-green-500 border-green-700/40" :
    color === "yellow" ? "bg-yellow-900/40 text-yellow-500 border-yellow-700/40" :
                         "bg-white/5 text-gray-500 border-white/10";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 font-mono hover:opacity-80 ${cls}`}>
        {label}<ExternalLink size={8} />
      </a>
    );
  }
  return (
    <span className={`inline-flex items-center text-[10px] border rounded px-1.5 py-0.5 font-mono ${cls}`}>
      {label}
    </span>
  );
}

// Tabela de casas de apostas para um mercado específico
function BookmakerTable({
  rec, allBookmakers, bestKey, homeTeam, awayTeam,
}: {
  rec: BetRecommendation;
  allBookmakers: BookmakerOdds[];
  bestKey: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const rows = allBookmakers
    .map((bm) => ({ bm, odds: getRelevantOdds(rec, bm, homeTeam, awayTeam) }))
    .filter((r): r is { bm: BookmakerOdds; odds: number } => r.odds != null && r.odds > 1)
    .sort((a, b) => b.odds - a.odds)
    .slice(0, 6);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden border border-white/10 text-xs">
      <div className="bg-white/5 px-3 py-1.5 text-gray-500 font-semibold text-[10px] uppercase tracking-wider">
        Odds disponíveis — clique para apostar
      </div>
      {rows.map(({ bm, odds }) => {
        const isBest = bm.key === bestKey;
        const url = bookmakerCopaUrl(bm.key);
        const name = bookmakerName(bm.key);
        return (
          <div key={bm.key}
            className={`flex items-center justify-between px-3 py-2 border-t border-white/5 ${
              isBest ? "bg-green-950/40" : "hover:bg-white/5"
            }`}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`font-semibold ${isBest ? "text-green-300" : "text-gray-300"}`}>
                {name}
              </span>
              {bm.isSharp && (
                <span className="text-[9px] bg-blue-700/30 text-blue-400 border border-blue-700/40 rounded px-1">
                  SHARP
                </span>
              )}
              {isBest && (
                <span className="text-[9px] bg-green-700/40 text-green-400 border border-green-700/40 rounded px-1">
                  referência
                </span>
              )}
              {bm.overround != null && (
                <span className="text-[9px] text-gray-600">
                  {((bm.overround - 1) * 100).toFixed(1)}% margem
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono font-bold ${isBest ? "text-green-400" : "text-gray-200"}`}>
                {odds.toFixed(2)}
              </span>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${
                    isBest
                      ? "bg-green-700 hover:bg-green-600 text-white"
                      : "bg-white/10 hover:bg-white/20 text-gray-300"
                  }`}>
                  Apostar <ExternalLink size={9} />
                </a>
              ) : (
                <span className="text-gray-600 text-[10px]">sem link direto</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Explicação detalhada do porquê desta aposta
function BetExplanation({
  rec, probs, fixtureOdds, homeTeam, awayTeam,
  homeStrength, awayStrength, strengthSource,
}: {
  rec: BetRecommendation;
  probs: MatchProbabilities;
  fixtureOdds: FixtureOdds;
  homeTeam: string;
  awayTeam: string;
  homeStrength: RealTeamStrength | null;
  awayStrength: RealTeamStrength | null;
  strengthSource: "api" | "sofascore" | "espn" | "flashscore" | "fallback";
}) {
  const [open, setOpen] = useState(false);
  const all = buildAllCandidates(probs, fixtureOdds, homeTeam, awayTeam);
  const rejected = all.filter((c) => !c.accepted && c.label !== rec.label);

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
        <HelpCircle size={12} />
        {open ? "Fechar explicação" : "Por que esta aposta e não outras?"}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="mt-2 bg-gray-950 border border-white/10 rounded-lg p-3 space-y-3 text-xs">

          {/* Fonte dos dados */}
          {strengthSource === "flashscore" ? (
            <p className="text-green-700">
              ✓ Baseado em {homeStrength?.matches ?? "?"}+ partidas reais via Flashscore (dados diretos, atualizados).
            </p>
          ) : strengthSource !== "fallback" ? (
            <p className="text-green-700">
              ✓ Baseado em {homeStrength?.matches ?? "?"}+ partidas reais (classificatórias + amistosos, via ESPN).
            </p>
          ) : (
            <p className="text-yellow-700">
              ⚠ Usando estimativa estática (dados históricos indisponíveis — menos preciso).
            </p>
          )}

          {/* Histórico dos times */}
          {(homeStrength?.avgScored != null || awayStrength?.avgScored != null) && (
            <div className="space-y-0.5 text-gray-400">
              {homeStrength?.avgScored != null && (
                <p>
                  <span className="text-gray-200 font-semibold">{homeTeam}:</span>{" "}
                  {homeStrength.avgScored.toFixed(2)} gols marcados / {homeStrength.avgConceded?.toFixed(2)} sofridos por jogo
                  ({homeStrength.matches} partidas)
                </p>
              )}
              {awayStrength?.avgScored != null && (
                <p>
                  <span className="text-gray-200 font-semibold">{awayTeam}:</span>{" "}
                  {awayStrength.avgScored.toFixed(2)} gols marcados / {awayStrength.avgConceded?.toFixed(2)} sofridos por jogo
                  ({awayStrength.matches} partidas)
                </p>
              )}
            </div>
          )}

          {/* xG e Poisson */}
          <div className="bg-white/5 rounded p-2 space-y-1">
            <p className="text-gray-500 font-semibold">Distribuição de Poisson calculou:</p>
            <p className="text-gray-300">
              xG esperado → <span className="text-white font-mono">{homeTeam} {probs.lambdaHome.toFixed(2)}</span>
              {" × "}<span className="text-white font-mono">{awayTeam} {probs.lambdaAway.toFixed(2)}</span>
            </p>
            <div className="flex gap-3 mt-0.5 text-[10px]">
              <span className="text-green-400">{homeTeam} vence: {(probs.homeWin*100).toFixed(1)}%</span>
              <span className="text-yellow-400">Empate: {(probs.draw*100).toFixed(1)}%</span>
              <span className="text-blue-400">{awayTeam} vence: {(probs.awayWin*100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Esta aposta */}
          <div className="space-y-0.5">
            <p className="text-gray-500 font-semibold">Esta aposta — {rec.label}:</p>
            <p className="text-gray-300">
              Modelo diz <span className="text-white font-mono">{(rec.ourProb*100).toFixed(1)}%</span>
              {" "}· mercado fair <span className="text-yellow-300 font-mono">{(rec.fairImpliedProb*100).toFixed(1)}%</span>
              {" ("}bruta {(rec.impliedProb*100).toFixed(1)}%{")"}
              {" "}· edge real <span className={`font-mono font-bold ${edgeColor(rec.edge)}`}>+{(rec.edge*100).toFixed(1)}%</span>
            </p>
            <p className="text-gray-400">
              Kelly ½ = {(rec.kelly.halfFraction*100).toFixed(2)}% do bankroll
              {" "}(fórmula conservadora que pondera risco × retorno esperado)
            </p>
          </div>

          {/* Por que não as outras */}
          {rejected.length > 0 && (
            <div className="space-y-1">
              <p className="text-gray-500 font-semibold">Por que as outras foram descartadas:</p>
              {rejected.map((c) => (
                <p key={c.label} className="text-gray-600">
                  <span className="text-gray-400">• {c.label}:</span>{" "}{c.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function MatchCard({ fixture, bankroll, onBankrollChange }: Props) {
  const [odds, setOdds] = useState<FixtureOdds | null>(() => {
    const stored = getFixtureOdds(fixture.id);
    if (stored) return stored;
    const extracted = extractOddsFromEvents(
      [fixture.oddsEvent], fixture.homeTeam, fixture.awayTeam, fixture.id
    );
    if (extracted) { saveFixtureOdds(extracted); return extracted; }
    return null;
  });

  const [bets, setBets] = useState<BetRecord[]>(() =>
    getBets().filter((b) => b.fixtureId === fixture.id)
  );

  const [betForms, setBetForms] = useState<Record<string, BetFormState>>({});
  const [expanded, setExpanded] = useState(false);
  const [homeStrength, setHomeStrength] = useState<RealTeamStrength | null>(null);
  const [awayStrength, setAwayStrength] = useState<RealTeamStrength | null>(null);
  const [h2hData, setH2hData] = useState<H2HSummary | null>(null);
  const [homeInjuries, setHomeInjuries] = useState<InjuryInfo[]>([]);
  const [awayInjuries, setAwayInjuries] = useState<InjuryInfo[]>([]);
  const [injuryFactorHome, setInjuryFactorHome] = useState(1);
  const [injuryFactorAway, setInjuryFactorAway] = useState(1);
  const [strengthState, setStrengthState] = useState<"idle" | "loading" | "done">("idle");
  const [loadingInjuries, setLoadingInjuries] = useState(false);
  const [brazilMarketKey, setBrazilMarketKey] = useState<string>("");
  const loadingRef = useRef(false);

  useEffect(() => {
    const extracted = extractOddsFromEvents(
      [fixture.oddsEvent], fixture.homeTeam, fixture.awayTeam, fixture.id
    );
    if (extracted) { saveFixtureOdds(extracted); setOdds(extracted); }
  }, [fixture.oddsEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStrength = useCallback(async (force = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setStrengthState("loading");
    const [h, a, h2h] = await Promise.all([
      fetchTeamStrength(fixture.homeTeam, force),
      fetchTeamStrength(fixture.awayTeam, force),
      fetchH2H(fixture.homeTeam, fixture.awayTeam),
    ]);
    setHomeStrength(h);
    setAwayStrength(a);
    setH2hData(h2h);
    setStrengthState("done");
    loadingRef.current = false;
  }, [fixture.homeTeam, fixture.awayTeam]);

  useEffect(() => {
    if (expanded && strengthState === "idle") loadStrength();
  }, [expanded, strengthState, loadStrength]);

  function handleRefreshStrength(e: React.MouseEvent) {
    e.stopPropagation();
    loadingRef.current = false;
    setStrengthState("idle");
    setHomeStrength(null);
    setAwayStrength(null);
  }

  const loadInjuries = useCallback(async () => {
    setLoadingInjuries(true);
    const inj = await fetchInjuries(fixture.homeTeam, fixture.awayTeam, fixture.date);
    if (inj) {
      setHomeInjuries(inj.home);
      setAwayInjuries(inj.away);
      setInjuryFactorHome(inj.attackPenaltyHome);
      setInjuryFactorAway(inj.attackPenaltyAway);
    }
    setLoadingInjuries(false);
  }, [fixture.homeTeam, fixture.awayTeam, fixture.date]);

  const analysis = odds
    ? analyzeMatch(fixture.homeTeam, fixture.awayTeam, odds, bankroll, {
        homeIsHost: fixture.homeIsHost,
        homeStrength,
        awayStrength,
        injuryFactorHome,
        injuryFactorAway,
        h2h: h2hData,
      })
    : null;

  const probs = analysis?.probabilities ?? null;

  function placeBet(rec: BetRecommendation, customAmount: number, customOdds: number) {
    if (customAmount <= 0 || customOdds <= 1 || customAmount > bankroll) return;
    const betId = uid();
    const bet: BetRecord = {
      id: betId,
      fixtureId: fixture.id,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      market: rec.market,
      label: rec.label,
      odds: customOdds,
      amount: customAmount,
      edge: rec.edge,
      date: new Date().toISOString(),
    };
    saveBet(bet);
    // Deduct stake immediately so bankroll reflects funds in play
    const newBal = parseFloat((bankroll - customAmount).toFixed(2));
    setBankroll(newBal);
    addTransaction({
      date: new Date().toISOString(),
      type: "bet",
      amount: -customAmount,
      balance: newBal,
      description: `Aposta: ${rec.label} @ ${customOdds.toFixed(2)}`,
      betId,
    });
    setBets(getBets().filter((b) => b.fixtureId === fixture.id));
    onBankrollChange();
  }

  function resolveResult(bet: BetRecord, result: "win" | "loss" | "void") {
    updateBetResult(bet.id, result, bet.odds);
    setBets(getBets().filter((b) => b.fixtureId === fixture.id));
    onBankrollChange();
  }

  function handleCancelBet(bet: BetRecord) {
    cancelBet(bet.id);
    setBets(getBets().filter((b) => b.fixtureId === fixture.id));
    onBankrollChange();
  }

  const now = new Date();
  const matchDate = new Date(fixture.date);
  const isPast = matchDate < now;
  const hoursUntil = (matchDate.getTime() - now.getTime()) / 3600000;
  const fixtureForInput = { id: fixture.id, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam };
  const oddsUpdatedAt = odds?.updatedAt
    ? new Date(odds.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
      {/* ── Header ── */}
      <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500 font-mono">
              {fixture.group !== "?" ? `Grupo ${fixture.group} · ` : ""}
              {formatDate(fixture.date)}
            </span>
            {odds
              ? <span className="flex items-center gap-0.5 text-[10px] text-green-600"><Wifi size={9} /> odds ao vivo</span>
              : <span className="flex items-center gap-0.5 text-[10px] text-gray-600"><WifiOff size={9} /> sem odds</span>
            }
          </div>
          <div className="flex items-center gap-2">
            {analysis && (analysis.recommendations.length + analysis.comboRecommendations.length) > 0 && (
              <span className="text-xs bg-green-600/20 text-green-400 border border-green-600/30 rounded px-2 py-0.5 font-semibold">
                {analysis.recommendations.length + analysis.comboRecommendations.length} valor{(analysis.recommendations.length + analysis.comboRecommendations.length) > 1 ? "es" : ""}
              </span>
            )}
            {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex-1 text-center">
            <p className="font-bold text-white text-lg leading-tight">{fixture.homeTeam}</p>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              {TEAMS[fixture.homeTeam]?.fifaRank && (
                <span className="text-[10px] text-gray-500 font-mono">#{TEAMS[fixture.homeTeam].fifaRank} FIFA</span>
              )}
              {fixture.homeIsHost && <span className="text-[10px] text-yellow-500">Sede</span>}
            </div>
          </div>
          <div className="px-4 text-center min-w-[130px]">
            {probs ? (
              <div className="text-xs space-y-0.5">
                <div className="flex gap-2 justify-center font-semibold">
                  <span className="text-green-400">{(probs.homeWin * 100).toFixed(0)}%</span>
                  <span className="text-gray-600">—</span>
                  <span className="text-gray-300">{(probs.draw * 100).toFixed(0)}%</span>
                  <span className="text-gray-600">—</span>
                  <span className="text-blue-400">{(probs.awayWin * 100).toFixed(0)}%</span>
                </div>
                <div className="text-gray-600 text-xs">
                  {probs.lambdaHome.toFixed(2)} — {probs.lambdaAway.toFixed(2)} xG
                </div>
              </div>
            ) : (
              <span className="text-gray-600 text-sm font-mono">VS</span>
            )}
          </div>
          <div className="flex-1 text-center">
            <p className="font-bold text-white text-lg leading-tight">{fixture.awayTeam}</p>
            {TEAMS[fixture.awayTeam]?.fifaRank && (
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">#{TEAMS[fixture.awayTeam].fifaRank} FIFA</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10 space-y-4">
          {fixture.venue && <p className="text-xs text-gray-600 mt-2">{fixture.venue}</p>}

          {/* Fonte das odds */}
          {odds && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <SourceBadge label="The Odds API" href="https://the-odds-api.com" color="green" />
              {odds.bookmaker && <SourceBadge label={bookmakerName(odds.bookmaker)} />}
              {oddsUpdatedAt && <span className="text-[10px] text-gray-600">· {oddsUpdatedAt}</span>}
              {odds.allBookmakers && (
                <span className="text-[10px] text-gray-600">
                  · {odds.allBookmakers.length} casa{odds.allBookmakers.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Força dos times */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {strengthState === "loading" && (
                <span className="text-gray-500 flex items-center gap-1">
                  <RefreshCw size={11} className="animate-spin" /> Buscando histórico...
                </span>
              )}
              {strengthState === "done" && homeStrength?.source === "flashscore" && (
                <>
                  <SourceBadge label="Flashscore" href="https://www.flashscore.com.br" color="green" />
                  <span className="text-[10px] text-gray-500">
                    forma real · {homeStrength.matches} jogos
                  </span>
                </>
              )}
              {strengthState === "done" && (homeStrength?.source === "espn" || homeStrength?.source === "sofascore") && (
                <>
                  <SourceBadge label="ESPN" href="https://www.espn.com" color="green" />
                  <span className="text-[10px] text-gray-500">
                    forma recente · {homeStrength.matches}+ jogos
                  </span>
                </>
              )}
              {strengthState === "done" && homeStrength?.source !== "espn" && homeStrength?.source !== "sofascore" && homeStrength?.source !== "flashscore" && (
                <>
                  <SourceBadge label="Estimativa FIFA ranking" color="yellow" />
                  <span className="text-[10px] text-yellow-700">dados históricos indisponíveis</span>
                </>
              )}
            </div>
            <button onClick={handleRefreshStrength} className="text-gray-600 hover:text-gray-400 p-1" title="Recarregar força">
              <RefreshCw size={12} />
            </button>
          </div>

          {/* Detalhes de força + H2H */}
          {strengthState === "done" && (
            <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {([
                { label: fixture.homeTeam, s: homeStrength },
                { label: fixture.awayTeam, s: awayStrength },
              ] as { label: string; s: RealTeamStrength | null }[]).map(({ label, s }) => (
                <div key={label} className="bg-white/5 rounded-lg p-2">
                  <p className="font-semibold text-gray-300 truncate">{label}</p>
                  {s ? (
                    <>
                      <p className="text-gray-500 mt-0.5">
                        Ataque <span className="text-white font-mono">{s.attack.toFixed(2)}</span>
                        {" · "}Defesa <span className="text-white font-mono">{s.defense.toFixed(2)}</span>
                      </p>
                      {s.avgScored != null && (
                        <p className="text-gray-600">
                          {s.avgScored.toFixed(2)} marc / {s.avgConceded?.toFixed(2)} sofr · {s.matches}j
                        </p>
                      )}
                      {s.lastFiveResults && s.lastFiveResults.length > 0 && (
                        <div className="flex gap-0.5 mt-1.5">
                          {s.lastFiveResults.map((r, i) => (
                            <span key={i} className={`w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center ${
                              r === "W" ? "bg-green-700 text-green-200" :
                              r === "D" ? "bg-yellow-700 text-yellow-200" :
                                          "bg-red-900 text-red-300"
                            }`}>{r}</span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-600 mt-0.5">Sem dados</p>
                  )}
                </div>
              ))}
            </div>

            {/* H2H */}
            {h2hData && h2hData.totalMatches > 0 && (
              <div className="bg-white/5 rounded-lg p-2.5 text-xs">
                <p className="text-gray-400 font-semibold mb-1.5 flex items-center gap-1">
                  H2H
                  {analysis?.h2hAdjusted && (
                    <span className="text-[9px] text-blue-400 bg-blue-700/20 border border-blue-700/30 px-1.5 rounded">
                      ajustado no modelo
                    </span>
                  )}
                </p>
                {h2hData.totalMatches < 3 ? (
                  <p className="text-gray-600">Menos de 3 jogos — sem ajuste no modelo</p>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold ${h2hData.team1Wins > h2hData.team2Wins ? "text-green-400" : "text-gray-400"}`}>
                        {fixture.homeTeam.split(" ").slice(-1)[0]} {h2hData.team1Wins}V
                      </span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-400">{h2hData.draws}E</span>
                      <span className="text-gray-600">·</span>
                      <span className={`font-bold ${h2hData.team2Wins > h2hData.team1Wins ? "text-green-400" : "text-gray-400"}`}>
                        {h2hData.team2Wins}V {fixture.awayTeam.split(" ").slice(-1)[0]}
                      </span>
                    </div>
                    <span className="text-gray-600">
                      Méd. gols: {h2hData.team1AvgGoals.toFixed(1)} × {h2hData.team2AvgGoals.toFixed(1)}
                      {" · "}{h2hData.totalMatches}j
                    </span>
                  </div>
                )}
              </div>
            )}
            </>
          )}

          {/* Manual odds fallback */}
          {!isPast && !odds && (
            <OddsInput fixture={fixtureForInput as never} existing={null} onSave={(o) => setOdds(o)} />
          )}

          {/* Probabilidades */}
          {probs && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Probabilidades</p>
                <SourceBadge label="Poisson" href="https://en.wikipedia.org/wiki/Poisson_distribution" />
              </div>
              {[
                { label: fixture.homeTeam, v: probs.homeWin, bar: "bg-green-500",  txt: "text-green-400"  },
                { label: "Empate",         v: probs.draw,    bar: "bg-yellow-500", txt: "text-yellow-400" },
                { label: fixture.awayTeam, v: probs.awayWin, bar: "bg-blue-500",   txt: "text-blue-400"   },
                { label: "Over 2.5 gols",  v: probs.over25,  bar: "bg-purple-500", txt: "text-purple-400" },
                { label: "Ambos marcam",   v: probs.bttsYes, bar: "bg-pink-500",   txt: "text-pink-400"   },
              ].map(({ label, v, bar, txt }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-28 text-gray-400 truncate">{label}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${v * 100}%` }} />
                  </div>
                  <span className={`w-10 text-right font-mono ${txt}`}>{(v * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Lesões */}
          {!isPast && hoursUntil < 24 && (
            <div>
              {homeInjuries.length === 0 && awayInjuries.length === 0 ? (
                <button onClick={loadInjuries} disabled={loadingInjuries}
                  className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 disabled:opacity-50">
                  <AlertTriangle size={12} />
                  {loadingInjuries ? "Buscando lesões..." : "Verificar lesões / escalações"}
                </button>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-orange-400 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} /> Lesões / dúvidas
                    </p>
                    <SourceBadge label="API-Football" href="https://www.api-football.com" color="yellow" />
                  </div>
                  {[
                    { team: fixture.homeTeam, list: homeInjuries },
                    { team: fixture.awayTeam, list: awayInjuries },
                  ].map(({ team, list }) =>
                    list.length > 0 ? (
                      <p key={team} className="text-xs text-gray-400">
                        <span className="font-semibold text-gray-300">{team}: </span>
                        {list.map((p) => `${p.playerName} (${p.type})`).join(", ")}
                      </p>
                    ) : null
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Recomendações ── */}
          {analysis && analysis.recommendations.length > 0 && bets.length === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp size={12} className="text-green-400" />
                  O modelo recomenda
                </p>
                <SourceBadge label="Kelly ½" href="https://en.wikipedia.org/wiki/Kelly_criterion" />
                {analysis.strengthSource !== "fallback" && <SourceBadge label="força real" color="green" />}
                {analysis.sharpLine && <SourceBadge label="odds sharp" color="green" />}
                {analysis.h2hAdjusted && <SourceBadge label="H2H" color="green" />}
              </div>
              <div className="space-y-4">
                {analysis.recommendations.map((rec, i) => {
                  const isTop = i === 0;
                  const formKey = `${rec.market}_${rec.label}`;
                  const form = betForms[formKey] ?? {
                    amount: rec.kelly.halfBetAmount.toFixed(2),
                    odds: rec.odds.toFixed(2),
                  };
                  const customAmount = parseFloat(form.amount.replace(",", ".")) || 0;
                  const customOdds  = parseFloat(form.odds.replace(",", "."))  || 0;
                  const netGain   = customOdds > 1 ? (customOdds - 1) * customAmount : 0;
                  const totalBack = customOdds > 1 ? customOdds * customAmount : 0;

                  function updateForm(patch: Partial<BetFormState>) {
                    setBetForms((prev) => ({ ...prev, [formKey]: { ...form, ...patch } }));
                  }

                  return (
                    <div key={formKey}
                      className={`border rounded-xl p-3 space-y-3 ${
                        isTop ? "bg-green-950/40 border-green-700/50" : "bg-white/5 border-white/10"
                      }`}>

                      {isTop && (
                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
                          ★ Melhor aposta deste jogo
                        </p>
                      )}

                      {/* Cabeçalho da recomendação */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white">
                            Aposte em: <span className="text-green-300">{rec.label}</span>
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-400">
                            <span>Odd <span className="text-white font-mono font-bold">{rec.odds.toFixed(2)}</span></span>
                            <span>Modelo <span className="text-white font-mono">{(rec.ourProb * 100).toFixed(1)}%</span></span>
                            <span>Mercado fair <span className="text-yellow-300 font-mono">{(rec.fairImpliedProb * 100).toFixed(1)}%</span></span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold font-mono shrink-0 ${edgeColor(rec.edge)}`}>
                          +{(rec.edge * 100).toFixed(1)}%
                        </span>
                      </div>

                      {/* Avisos de qualidade de dados / divergência */}
                      {rec.warnings.length > 0 && (
                        <div className="bg-yellow-950/40 border border-yellow-700/40 rounded-lg px-3 py-2 space-y-1">
                          {rec.warnings.map((w, wi) => (
                            <p key={wi} className="text-[11px] text-yellow-400 flex items-start gap-1.5 leading-snug">
                              <span className="shrink-0 mt-0.5">⚠</span>{w}
                            </p>
                          ))}
                          {(rec.dataQuality === "partial" || rec.dataQuality === "poor" || rec.divergenceRatio > 1.8) && (
                            <p className="text-[10px] text-yellow-700 mt-1">
                              Apostas foram reduzidas automaticamente pelo modelo de incerteza.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Inputs editáveis */}
                      <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 space-y-2">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Editar antes de registrar</p>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-600 block mb-0.5">
                              Valor (R$) <span className="text-gray-700">· Kelly: {rec.kelly.halfBetAmount.toFixed(2)}</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={form.amount}
                              onChange={(e) => updateForm({ amount: e.target.value })}
                              className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-green-400 font-bold focus:outline-none focus:border-green-500 placeholder-gray-600"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-600 block mb-0.5">
                              Odd <span className="text-gray-700">· melhor: {rec.odds.toFixed(2)}</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="1.01"
                              value={form.odds}
                              onChange={(e) => updateForm({ odds: e.target.value })}
                              className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-white font-bold focus:outline-none focus:border-green-500 placeholder-gray-600"
                            />
                          </div>
                        </div>
                        {customAmount > 0 && customOdds > 1 && (
                          <div className="flex gap-4 text-xs pt-0.5">
                            <span className="text-gray-500">Ganho líq. <span className="text-green-400 font-mono font-bold">+R$ {netGain.toFixed(2)}</span></span>
                            <span className="text-gray-500">Retorno <span className="text-white font-mono font-bold">R$ {totalBack.toFixed(2)}</span></span>
                            <span className="text-gray-500">{(rec.kelly.halfFraction * 100).toFixed(1)}% Kelly</span>
                          </div>
                        )}
                      </div>

                      {/* Tabela de casas */}
                      {odds?.allBookmakers && odds.allBookmakers.length > 0 && (
                        <BookmakerTable
                          rec={rec}
                          allBookmakers={odds.allBookmakers}
                          bestKey={odds.bookmaker ?? ""}
                          homeTeam={fixture.homeTeam}
                          awayTeam={fixture.awayTeam}
                        />
                      )}

                      {/* Explicação */}
                      {probs && (
                        <BetExplanation
                          rec={rec}
                          probs={probs}
                          fixtureOdds={odds!}
                          homeTeam={fixture.homeTeam}
                          awayTeam={fixture.awayTeam}
                          homeStrength={homeStrength}
                          awayStrength={awayStrength}
                          strengthSource={analysis.strengthSource}
                        />
                      )}

                      {!isPast && (
                        <div className="space-y-1">
                          {customAmount > bankroll && (
                            <p className="text-xs text-red-400">Valor maior que o bankroll disponível (R$ {bankroll.toFixed(2)})</p>
                          )}
                          <button
                            onClick={() => placeBet(rec, customAmount, customOdds)}
                            disabled={customAmount <= 0 || customOdds <= 1 || customAmount > bankroll}
                            className={`w-full text-sm px-3 py-2 rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              isTop
                                ? "bg-green-700 hover:bg-green-600 active:bg-green-800 text-white"
                                : "bg-white/10 hover:bg-white/20 text-white"
                            }`}>
                            ✓ Registrar aposta · R$ {customAmount > 0 ? customAmount.toFixed(2) : rec.kelly.halfBetAmount.toFixed(2)} @ {customOdds > 1 ? customOdds.toFixed(2) : rec.odds.toFixed(2)}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analysis && analysis.recommendations.length === 0 && analysis.comboRecommendations.length === 0 && odds && bets.length === 0 && probs && (() => {
            const candidates = [
              { label: `${fixture.homeTeam} vence`, modelProb: probs.homeWin, odds: odds.home },
              { label: "Empate",                     modelProb: probs.draw,    odds: odds.draw },
              { label: `${fixture.awayTeam} vence`,  modelProb: probs.awayWin, odds: odds.away },
              ...(odds.over25  ? [{ label: "Over 2.5 gols",  modelProb: probs.over25,  odds: odds.over25  }] : []),
              ...(odds.under25 ? [{ label: "Under 2.5 gols", modelProb: probs.under25, odds: odds.under25 }] : []),
            ];
            return (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 space-y-1.5">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Por que não há recomendações</p>
                {candidates.map((c) => {
                  const impliedProb = 1 / c.odds;
                  const or1x2 = 1/odds.home + 1/odds.draw + 1/odds.away;
                  const fairProb  = impliedProb / (["Over 2.5 gols","Under 2.5 gols"].includes(c.label)
                    ? (odds.over25 && odds.under25 ? 1/odds.over25 + 1/odds.under25 : or1x2)
                    : or1x2);
                  const edge = c.modelProb - fairProb;
                  const isFiltered = impliedProb < 0.267; // odds > 3.75
                  return (
                    <div key={c.label} className="flex items-center justify-between text-[11px] gap-2">
                      <span className="text-gray-500 truncate">{c.label}</span>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="text-gray-600">{c.odds.toFixed(2)}</span>
                        <span className="text-gray-600">mod {(c.modelProb * 100).toFixed(0)}%</span>
                        <span className={edge >= 0.06 ? "text-green-600" : edge >= 0 ? "text-yellow-700" : "text-red-800"}>
                          {edge >= 0 ? "+" : ""}{(edge * 100).toFixed(1)}%
                        </span>
                        {isFiltered
                          ? <span className="text-gray-700">odd alta</span>
                          : edge < 0.06
                          ? <span className="text-gray-700">edge insuf.</span>
                          : <span className="text-green-700">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Mercados Combinados ── */}
          {analysis && analysis.comboRecommendations.length > 0 && bets.length === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp size={12} className="text-purple-400" />
                  Mercados combinados
                </p>
                <span className="text-[9px] bg-purple-900/40 text-purple-400 border border-purple-700/40 rounded px-1.5 py-0.5 font-mono">
                  Poisson joint
                </span>
                <span className="text-[10px] text-gray-600">odds estimadas · confirme na casa</span>
              </div>
              <div className="space-y-4">
                {analysis.comboRecommendations.map((rec) => {
                  const formKey = `COMBO_${rec.label}`;
                  const form = betForms[formKey] ?? {
                    amount: rec.kelly.halfBetAmount.toFixed(2),
                    odds: rec.odds.toFixed(2),
                  };
                  const customAmount = parseFloat(form.amount.replace(",", ".")) || 0;
                  const customOdds  = parseFloat(form.odds.replace(",", "."))  || 0;
                  const netGain   = customOdds > 1 ? (customOdds - 1) * customAmount : 0;
                  const totalBack = customOdds > 1 ? customOdds * customAmount : 0;

                  function updateComboForm(patch: Partial<BetFormState>) {
                    setBetForms((prev) => ({ ...prev, [formKey]: { ...form, ...patch } }));
                  }

                  const minValueOdds = rec.fairImpliedProb > 0
                    ? (1 / rec.fairImpliedProb).toFixed(2) : "—";

                  return (
                    <div key={formKey}
                      className="border rounded-xl p-3 space-y-3 bg-purple-950/20 border-purple-700/30">

                      <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                        ◆ Mercado combinado
                      </p>

                      {/* Cabeçalho */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white">
                            {rec.label}
                          </p>
                          {rec.comboLegs && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {rec.comboLegs.map((leg, i) => (
                                <span key={i}
                                  className="text-[10px] bg-white/10 text-gray-300 rounded px-1.5 py-0.5 font-mono">
                                  {leg}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-400">
                            <span>Odd parlay <span className="text-white font-mono font-bold">{rec.odds.toFixed(2)}</span></span>
                            <span>Modelo <span className="text-white font-mono">{(rec.ourProb * 100).toFixed(1)}%</span></span>
                            <span>Odd mín. valor <span className="text-yellow-400 font-mono font-bold">{minValueOdds}</span></span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold font-mono shrink-0 ${edgeColor(rec.edge)}`}>
                          +{(rec.edge * 100).toFixed(1)}%
                        </span>
                      </div>

                      {/* Aviso sempre visível */}
                      <div className="bg-purple-950/40 border border-purple-700/30 rounded-lg px-3 py-2 space-y-1">
                        <p className="text-[11px] text-purple-300 leading-snug">
                          <span className="font-bold">Odd estimada</span> = {rec.comboLegs?.[0]} × {rec.comboLegs?.[1]} como parlay.
                          {" "}Se a casa oferecer como mercado único, peça no mínimo{" "}
                          <span className="font-bold text-yellow-300">{minValueOdds}</span> para ter valor.
                        </p>
                        {rec.warnings.slice(1).map((w, wi) => (
                          <p key={wi} className="text-[11px] text-yellow-400 flex items-start gap-1.5 leading-snug">
                            <span className="shrink-0 mt-0.5">⚠</span>{w}
                          </p>
                        ))}
                      </div>

                      {/* Inputs editáveis */}
                      <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 space-y-2">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Editar antes de registrar</p>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-600 block mb-0.5">
                              Valor (R$) <span className="text-gray-700">· Kelly: {rec.kelly.halfBetAmount.toFixed(2)}</span>
                            </label>
                            <input
                              type="number" step="0.01" min="0.01"
                              value={form.amount}
                              onChange={(e) => updateComboForm({ amount: e.target.value })}
                              className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-green-400 font-bold focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-600 block mb-0.5">
                              Odd real <span className="text-gray-700">· est: {rec.odds.toFixed(2)}</span>
                            </label>
                            <input
                              type="number" step="0.01" min="1.01"
                              value={form.odds}
                              onChange={(e) => updateComboForm({ odds: e.target.value })}
                              className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-white font-bold focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                        {customAmount > 0 && customOdds > 1 && (
                          <div className="flex gap-4 text-xs pt-0.5">
                            <span className="text-gray-500">Ganho líq. <span className="text-green-400 font-mono font-bold">+R$ {netGain.toFixed(2)}</span></span>
                            <span className="text-gray-500">Retorno <span className="text-white font-mono font-bold">R$ {totalBack.toFixed(2)}</span></span>
                          </div>
                        )}
                      </div>

                      {!isPast && (
                        <div className="space-y-1">
                          {customAmount > bankroll && (
                            <p className="text-xs text-red-400">Valor maior que o bankroll disponível (R$ {bankroll.toFixed(2)})</p>
                          )}
                          <button
                            onClick={() => placeBet(rec, customAmount, customOdds)}
                            disabled={customAmount <= 0 || customOdds <= 1 || customAmount > bankroll}
                            className="w-full text-sm px-3 py-2 rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-purple-800 hover:bg-purple-700 active:bg-purple-900 text-white">
                            ◆ Registrar combinado · R$ {customAmount > 0 ? customAmount.toFixed(2) : rec.kelly.halfBetAmount.toFixed(2)} @ {customOdds > 1 ? customOdds.toFixed(2) : rec.odds.toFixed(2)}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Apostar no Brasil ── */}
          {(() => {
            const brazilIsHome = fixture.homeTeam === "Brazil";
            const brazilIsAway = fixture.awayTeam === "Brazil";
            if (!brazilIsHome && !brazilIsAway) return null;
            if (!odds || isPast) return null;

            const brazilName = brazilIsHome ? fixture.homeTeam : fixture.awayTeam;

            // Monta lista de mercados disponíveis a favor do Brasil
            type BrMarket = { key: string; label: string; market: string; odds: number };
            const brMarkets: BrMarket[] = [
              { key: "BR_WIN",  label: `${brazilName} vence (1X2)`,        market: "1X2",   odds: brazilIsHome ? odds.home : odds.away },
              { key: "BR_DC",   label: `${brazilName} ou Empate (DC)`,     market: "DC",    odds: brazilIsHome ? (odds.dcHome ?? 0) : (odds.dcAway ?? 0) },
            ];
            if (odds.over25)        brMarkets.push({ key: "BR_OVER25",   label: "Over 2.5 gols",                    market: "Over/Under",  odds: odds.over25 });
            if (odds.under25)       brMarkets.push({ key: "BR_UNDER25",  label: "Under 2.5 gols",                   market: "Over/Under",  odds: odds.under25 });
            if (odds.bttsYes)       brMarkets.push({ key: "BR_BTTS_S",   label: "Ambos marcam – Sim",               market: "BTTS",        odds: odds.bttsYes });
            if (odds.bttsNo)        brMarkets.push({ key: "BR_BTTS_N",   label: "Ambos marcam – Não",               market: "BTTS",        odds: odds.bttsNo });
            if (odds.cornersOver && odds.cornersLine)
                                    brMarkets.push({ key: "BR_CRNR_O",   label: `Over ${odds.cornersLine} escanteios`,  market: "Corners", odds: odds.cornersOver });
            if (odds.cornersUnder && odds.cornersLine)
                                    brMarkets.push({ key: "BR_CRNR_U",   label: `Under ${odds.cornersLine} escanteios`, market: "Corners", odds: odds.cornersUnder! });

            // Filtra mercados já apostados e odds inválidas
            const available = brMarkets.filter(
              (m) => m.odds > 1 && !bets.some((b) => b.label === m.label)
            );
            if (available.length === 0) return null;

            // Seleciona o mercado ativo (default = primeiro disponível)
            const activeKey = brazilMarketKey && available.some((m) => m.key === brazilMarketKey)
              ? brazilMarketKey
              : available[0].key;
            const activeMkt = available.find((m) => m.key === activeKey)!;

            const form = betForms[activeKey] ?? {
              amount: Math.max(1, bankroll * 0.05).toFixed(2),
              odds: activeMkt.odds.toFixed(2),
            };
            const customAmount = parseFloat(form.amount.replace(",", ".")) || 0;
            const customOdds   = parseFloat(form.odds.replace(",", "."))   || 0;
            const netGain   = customOdds > 1 ? (customOdds - 1) * customAmount : 0;
            const totalBack = customOdds > 1 ? customOdds * customAmount : 0;

            return (
              <div className="border border-yellow-700/50 rounded-xl p-3 space-y-3 bg-yellow-950/20">
                <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">
                  🇧🇷 Apostar no Brasil
                </p>

                {/* Seletor de mercado */}
                <div className="flex flex-wrap gap-1.5">
                  {available.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => {
                        setBrazilMarketKey(m.key);
                        // Pré-preenche a odd do mercado escolhido se a odd ainda não foi editada
                        setBetForms((p) => ({
                          ...p,
                          [m.key]: p[m.key] ?? {
                            amount: Math.max(1, bankroll * 0.05).toFixed(2),
                            odds: m.odds.toFixed(2),
                          },
                        }));
                      }}
                      className={`text-[11px] px-2 py-1 rounded-full font-semibold transition-colors ${
                        m.key === activeKey
                          ? "bg-yellow-600 text-white"
                          : "bg-white/10 text-gray-300 hover:bg-white/20"
                      }`}
                    >
                      {m.label}
                      <span className="ml-1 font-mono opacity-80">{m.odds.toFixed(2)}</span>
                    </button>
                  ))}
                </div>

                {/* Formulário do mercado selecionado */}
                <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-600 block mb-0.5">Valor (R$)</label>
                      <input
                        type="number" step="0.01" min="0.01"
                        value={form.amount}
                        onChange={(e) => setBetForms((p) => ({ ...p, [activeKey]: { ...form, amount: e.target.value } }))}
                        className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-yellow-400 font-bold focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-600 block mb-0.5">Odd real</label>
                      <input
                        type="number" step="0.01" min="1.01"
                        value={form.odds}
                        onChange={(e) => setBetForms((p) => ({ ...p, [activeKey]: { ...form, odds: e.target.value } }))}
                        className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-white font-bold focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  </div>
                  {customAmount > 0 && customOdds > 1 && (
                    <div className="flex gap-4 text-xs pt-0.5">
                      <span className="text-gray-500">Ganho líq. <span className="text-green-400 font-mono font-bold">+R$ {netGain.toFixed(2)}</span></span>
                      <span className="text-gray-500">Retorno <span className="text-white font-mono font-bold">R$ {totalBack.toFixed(2)}</span></span>
                    </div>
                  )}
                </div>

                {customAmount > bankroll && (
                  <p className="text-xs text-red-400">Valor maior que o bankroll (R$ {bankroll.toFixed(2)})</p>
                )}
                <button
                  onClick={() => {
                    if (customAmount <= 0 || customOdds <= 1 || customAmount > bankroll) return;
                    placeBet(
                      { market: activeMkt.market, label: activeMkt.label, edge: 0, odds: activeMkt.odds,
                        ourProb: 0, impliedProb: 1 / activeMkt.odds, fairImpliedProb: 1 / activeMkt.odds,
                        overround: 1, kelly: { hasValue: false, fraction: 0, halfFraction: 0, betAmount: 0, halfBetAmount: 0, edge: 0 },
                        dataQuality: "good", divergenceRatio: 1, warnings: [] },
                      customAmount,
                      customOdds
                    );
                  }}
                  disabled={customAmount <= 0 || customOdds <= 1 || customAmount > bankroll}
                  className="w-full text-sm px-3 py-2 rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-yellow-700 hover:bg-yellow-600 text-white">
                  🇧🇷 Registrar · {activeMkt.label} · R$ {customAmount > 0 ? customAmount.toFixed(2) : "0.00"} @ {customOdds > 1 ? customOdds.toFixed(2) : activeMkt.odds.toFixed(2)}
                </button>
              </div>
            );
          })()}

          {/* ── Apostas registradas ── */}
          {bets.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                <Target size={12} className="text-yellow-400" /> Apostas registradas
              </p>
              <div className="space-y-2">
                {bets.map((bet) => (
                  <div key={bet.id}
                    className={`rounded-lg p-3 border text-xs ${
                      bet.result === "win"  ? "bg-green-900/30 border-green-700/40" :
                      bet.result === "loss" ? "bg-red-900/30 border-red-700/40"    :
                                              "bg-white/5 border-white/10"
                    }`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{bet.label}</p>
                        <p className="text-gray-400 mt-0.5">
                          <span className="font-mono font-bold text-white">R$ {bet.amount.toFixed(2)}</span>
                          {" @ "}{bet.odds.toFixed(2)}
                          {" · "}edge {(bet.edge * 100).toFixed(1)}%
                        </p>
                        <p className="text-gray-600 mt-0.5">
                          Retorno potencial: +R$ {((bet.odds - 1) * bet.amount).toFixed(2)}
                        </p>
                      </div>
                      {bet.result ? (
                        <span className={`font-bold shrink-0 ${
                          bet.result === "win"  ? "text-green-400" :
                          bet.result === "loss" ? "text-red-400"   : "text-gray-400"}`}>
                          {bet.result === "win"  ? `+R$ ${bet.profit?.toFixed(2)}` :
                           bet.result === "loss" ? `-R$ ${bet.amount.toFixed(2)}`  : "Void"}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1 shrink-0">
                          <div className="flex gap-1">
                            <button onClick={() => resolveResult(bet, "win")}
                              className="bg-green-700 hover:bg-green-600 text-white px-2 py-0.5 rounded font-semibold">
                              Ganhou
                            </button>
                            <button onClick={() => resolveResult(bet, "loss")}
                              className="bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded font-semibold">
                              Perdeu
                            </button>
                          </div>
                          <button onClick={() => handleCancelBet(bet)}
                            className="flex items-center justify-center gap-1 text-gray-500 hover:text-red-400 hover:bg-red-900/20 border border-white/10 hover:border-red-700/40 px-2 py-0.5 rounded transition-colors">
                            <X size={10} /> Cancelar aposta
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
