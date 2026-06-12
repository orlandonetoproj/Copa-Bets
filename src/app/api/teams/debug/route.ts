import { NextRequest, NextResponse } from "next/server";

const BASE = "https://v3.football.api-sports.io";

// GET /api/teams/debug?teamId=6&name=Brazil
export async function GET(req: NextRequest) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || apiKey === "cole_sua_chave_aqui") {
    return NextResponse.json({ error: "API_FOOTBALL_KEY não configurada" }, { status: 400 });
  }

  const teamId = req.nextUrl.searchParams.get("teamId");
  const name = req.nextUrl.searchParams.get("name") ?? "";

  const today = new Date().toISOString().split("T")[0];

  // 1. Verify team ID
  const teamRes = await fetch(`${BASE}/teams?id=${teamId}`, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });
  const teamData = await teamRes.json();

  // Capture all rate-limit related headers
  const headers: Record<string, string> = {};
  teamRes.headers.forEach((v, k) => {
    if (k.includes("ratelimit") || k.includes("requests") || k.includes("x-")) {
      headers[k] = v;
    }
  });

  // 2. Get fixtures with date range (the working method for national teams)
  const fixturesRes = await fetch(
    `${BASE}/fixtures?team=${teamId}&from=2024-01-01&to=${today}`,
    { headers: { "x-apisports-key": apiKey }, cache: "no-store" }
  );
  const fixturesData = await fixturesRes.json();

  const fixtures = (fixturesData.response ?? []).map(
    (f: {
      fixture: { id: number; date: string; status: { short: string } };
      league: { name: string; country: string };
      teams: { home: { id: number; name: string }; away: { id: number; name: string } };
      goals: { home: number | null; away: number | null };
    }) => ({
      date: f.fixture.date.split("T")[0],
      status: f.fixture.status.short,
      competition: `${f.league.name} (${f.league.country})`,
      home: f.teams.home.name,
      away: f.teams.away.name,
      score: `${f.goals.home} x ${f.goals.away}`,
    })
  );

  return NextResponse.json({
    queriedId: Number(teamId),
    queriedName: name,
    teamFoundInApi: teamData.response?.[0]?.team ?? null,
    apiHeaders: headers,
    fixturesFrom2024: {
      total: fixtures.length,
      finished: fixtures.filter((f: { status: string }) => ["FT","AET","PEN"].includes(f.status)).length,
      list: fixtures.slice(0, 15),
    },
  });
}
