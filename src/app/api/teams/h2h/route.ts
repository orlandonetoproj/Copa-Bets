import { NextRequest, NextResponse } from "next/server";
import type { H2HSummary } from "@/lib/apiClient";

const BASE = "https://v3.football.api-sports.io";

interface ApiFixture {
  fixture: { date: string; status: { short: string } };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  score: { fulltime: { home: number | null; away: number | null } };
}

function summarizeH2H(fixtures: ApiFixture[], h2hKey: string): H2HSummary {
  const [id1] = h2hKey.split("-").map(Number);
  const finished = fixtures.filter((f) =>
    ["FT", "AET", "PEN"].includes(f.fixture.status.short)
  );

  let team1Wins = 0, draws = 0, team2Wins = 0;
  let team1Goals = 0, team2Goals = 0;
  const recentMatches: H2HSummary["recentMatches"] = [];

  for (const f of finished) {
    const isTeam1Home = f.teams.home.id === id1;
    const scored   = isTeam1Home ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const conceded = isTeam1Home ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    team1Goals += scored;
    team2Goals += conceded;

    let result: "team1" | "draw" | "team2";
    if (scored > conceded)       result = "team1";
    else if (scored === conceded) result = "draw";
    else                          result = "team2";

    if (result === "team1") team1Wins++;
    else if (result === "draw") draws++;
    else team2Wins++;

    recentMatches.push({
      date: f.fixture.date.slice(0, 10),
      score: `${f.goals.home ?? 0}-${f.goals.away ?? 0}`,
      result,
    });
  }

  const n = finished.length;
  return {
    totalMatches: n,
    team1Wins,
    draws,
    team2Wins,
    team1AvgGoals: n > 0 ? team1Goals / n : 0,
    team2AvgGoals: n > 0 ? team2Goals / n : 0,
    recentMatches,
  };
}

// GET /api/teams/h2h?h2hKey=6-26  (homeTeamId-awayTeamId)
export async function GET(req: NextRequest) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || apiKey === "cole_sua_chave_aqui") {
    return NextResponse.json({ error: "API_FOOTBALL_KEY não configurada" }, { status: 400 });
  }

  const h2hKey = req.nextUrl.searchParams.get("h2hKey");
  if (!h2hKey || !/^\d+-\d+$/.test(h2hKey)) {
    return NextResponse.json({ error: "h2hKey inválido (esperado: id1-id2)" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BASE}/fixtures/headtohead?h2h=${h2hKey}&last=10`,
      { headers: { "x-apisports-key": apiKey }, next: { revalidate: 86400 * 30 } }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `API-Football ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    const fixtures: ApiFixture[] = data.response ?? [];
    return NextResponse.json(summarizeH2H(fixtures, h2hKey));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
