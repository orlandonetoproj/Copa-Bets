"use client";

import { useState, useEffect, useMemo } from "react";
import { GROUP_FIXTURES } from "@/data/fixtures";
import { getBankroll, getBets, BetRecord, setBankroll, getTransactions, adjustBankroll, Transaction } from "@/lib/storage";
import MatchCard from "@/components/MatchCard";
import BankrollTracker from "@/components/BankrollTracker";
import PendingBetsSidebar from "@/components/PendingBetsSidebar";
import {
  OddsApiEvent, readOddsCache, writeOddsCache, clearAllCaches, fuzzyMatch,
} from "@/lib/apiClient";
import { Search, RefreshCw, Wifi, WifiOff, Trash2 } from "lucide-react";

const INITIAL_BANKROLL = 100;

// Enrich Odds API events with group/venue info from our reference fixture list
function enrichEvent(ev: OddsApiEvent) {
  const ref = GROUP_FIXTURES.find(
    (f) => fuzzyMatch(f.homeTeam, ev.home_team) && fuzzyMatch(f.awayTeam, ev.away_team)
  );
  return {
    id: ev.id,
    homeTeam: ev.home_team,
    awayTeam: ev.away_team,
    date: ev.commence_time,
    group: ref?.group ?? "?",
    venue: ref?.venue ?? "",
    homeIsHost: ref?.homeIsHost ?? false,
    stage: ref?.stage ?? "Copa 2026",
    oddsEvent: ev,
  };
}

export type EnrichedFixture = ReturnType<typeof enrichEvent>;

export default function Home() {
  const [bankroll, setBankrollState] = useState(INITIAL_BANKROLL);
  const [bets, setBetsState] = useState<BetRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("Todos");
  const [showPast, setShowPast] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [oddsEvents, setOddsEvents] = useState<OddsApiEvent[]>([]);
  const [oddsStatus, setOddsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [oddsError, setOddsError] = useState("");
  const [oddsRemaining, setOddsRemaining] = useState<string | null>(null);
  const [oddsAge, setOddsAge] = useState<Date | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("wc2026_bankroll")) setBankroll(INITIAL_BANKROLL);
    setBankrollState(getBankroll());
    setBetsState(getBets());
    setTransactions(getTransactions());

    // Load cache immediately
    const cached = readOddsCache();
    if (cached?.events.length) {
      setOddsEvents(cached.events);
      setOddsRemaining(cached.remaining);
      setOddsAge(new Date(cached.ts));
      setOddsStatus("ok");
    }
    setHydrated(true);
  }, []);

  // Auto-fetch if no cache
  useEffect(() => {
    if (hydrated && !readOddsCache()) fetchOdds();
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOdds() {
    setOddsStatus("loading");
    setOddsError("");
    try {
      const res = await fetch("/api/odds");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const events: OddsApiEvent[] = json.events ?? [];
      writeOddsCache(events, json.remaining ?? null);
      setOddsEvents(events);
      setOddsRemaining(json.remaining ?? null);
      setOddsAge(new Date());
      setOddsStatus(events.length > 0 ? "ok" : "error");
      if (events.length === 0)
        setOddsError("API retornou 0 eventos. Verifique a chave ou tente mais tarde.");
    } catch (err) {
      setOddsError(String(err));
      setOddsStatus("error");
    }
  }

  function refresh() {
    setBankrollState(getBankroll());
    setBetsState(getBets());
    setTransactions(getTransactions());
  }

  const now = new Date();

  // Use Odds API events as the source of truth for fixtures
  const enriched = useMemo(
    () => oddsEvents.map(enrichEvent).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ),
    [oddsEvents]
  );

  const groups = useMemo(() => {
    const gs = new Set(enriched.map((e) => e.group).filter((g) => g !== "?"));
    return ["Todos", ...Array.from(gs).sort()];
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((f) => {
      const isPast = new Date(f.date) < now;
      if (!showPast && isPast) return false;
      if (selectedGroup !== "Todos" && f.group !== selectedGroup) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          f.homeTeam.toLowerCase().includes(q) ||
          f.awayTeam.toLowerCase().includes(q)
        );
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, selectedGroup, search, showPast]);

  const upcoming = filtered.filter((f) => new Date(f.date) >= now);
  const past     = filtered.filter((f) => new Date(f.date) <  now);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Copa 2026</h1>
            <p className="text-xs text-gray-500">Análise estatística de apostas</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Bankroll</p>
            <p className="text-sm font-bold text-green-400">R$ {bankroll.toFixed(2)}</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── Coluna principal ── */}
          <div>
            <BankrollTracker
              bankroll={bankroll}
              initialBankroll={INITIAL_BANKROLL}
              bets={bets}
              transactions={transactions}
              onAdjust={(delta, desc) => { adjustBankroll(delta, desc); refresh(); }}
              onImport={refresh}
            />

            {/* Filters */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar seleção (Brazil, France…)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {groups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGroup(g)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      selectedGroup === g ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {g === "Todos" ? "Todos" : `Grupo ${g}`}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setShowPast((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${showPast ? "bg-green-600" : "bg-gray-700"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showPast ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-gray-400">Mostrar jogos passados</span>
              </label>
            </div>

            {/* Odds status */}
            <div className="bg-gray-900 border border-white/10 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {oddsStatus === "ok"    ? <Wifi    size={14} className="text-green-400" />
                  : oddsStatus === "error" ? <WifiOff size={14} className="text-red-400" />
                                            : <WifiOff size={14} className="text-gray-600" />}
                  <span className="text-sm font-semibold text-gray-300">Odds em tempo real</span>
                  {oddsAge && (
                    <span className="text-xs text-gray-600">
                      · {oddsAge.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { clearAllCaches(); setOddsEvents([]); setOddsStatus("idle"); setOddsAge(null); }}
                    className="text-gray-700 hover:text-gray-500 p-1" title="Limpar caches">
                    <Trash2 size={12} />
                  </button>
                  <button onClick={fetchOdds} disabled={oddsStatus === "loading"}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">
                    <RefreshCw size={12} className={oddsStatus === "loading" ? "animate-spin" : ""} />
                    {oddsStatus === "loading" ? "Buscando..." : "Atualizar"}
                  </button>
                </div>
              </div>
              {oddsStatus === "ok" && (
                <p className="text-xs text-green-700">
                  {oddsEvents.length} jogos · {oddsRemaining ?? "?"} req restantes este mês
                </p>
              )}
              {oddsStatus === "error" && <p className="text-xs text-red-500">{oddsError}</p>}
              {oddsStatus === "idle"  && <p className="text-xs text-gray-600">Buscando odds automaticamente...</p>}
              {oddsStatus === "loading" && <p className="text-xs text-gray-600">Conectando à API...</p>}
            </div>

            {/* No events yet */}
            {oddsEvents.length === 0 && oddsStatus !== "loading" && (
              <div className="text-center py-16 text-gray-600">
                <p className="text-lg mb-1">Nenhum jogo carregado</p>
                <p className="text-sm mb-4">Verifique a ODDS_API_KEY no .env.local e clique em Atualizar</p>
                <button onClick={fetchOdds} className="bg-green-700 text-white text-sm px-4 py-2 rounded-lg">
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Próximos jogos ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map((f) => (
                    <MatchCard key={f.id} fixture={f} bankroll={bankroll} onBankrollChange={refresh} />
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {showPast && past.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Jogos passados ({past.length})
                </h2>
                <div className="space-y-3">
                  {past.map((f) => (
                    <MatchCard key={f.id} fixture={f} bankroll={bankroll} onBankrollChange={refresh} />
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 && oddsEvents.length > 0 && (
              <div className="text-center py-12 text-gray-600">
                <p>Nenhum jogo encontrado com esse filtro.</p>
              </div>
            )}

            <p className="text-center text-xs text-gray-700 mt-10">
              Modelo Poisson + Kelly ½ · Apenas para fins recreativos
            </p>
          </div>

          {/* ── Coluna lateral: bets pendentes ── */}
          <div className="lg:sticky lg:top-20">
            <PendingBetsSidebar bets={bets} onRefresh={refresh} />
          </div>

        </div>
      </main>
    </div>
  );
}
