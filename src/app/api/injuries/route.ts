import { NextRequest, NextResponse } from "next/server";

const BASE = "https://v3.football.api-sports.io";

async function apiFetch(path: string, apiKey: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
    next: { revalidate: 3600 }, // cache 1h
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  return res.json();
}

// GET /api/injuries?homeId=26&awayId=6&date=2026-06-13
export async function GET(req: NextRequest) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || apiKey === "cole_sua_chave_aqui") {
    return NextResponse.json({ error: "API_FOOTBALL_KEY não configurada" }, { status: 400 });
  }

  const homeId = req.nextUrl.searchParams.get("homeId");
  const awayId = req.nextUrl.searchParams.get("awayId");
  const date = req.nextUrl.searchParams.get("date"); // YYYY-MM-DD

  if (!homeId || !awayId || !date) {
    return NextResponse.json({ error: "homeId, awayId e date são obrigatórios" }, { status: 400 });
  }

  try {
    // Injuries endpoint requires a fixture ID, but we can search by team + date range
    // Alternative: use /players/squads to get squad, then check recent injuries
    const [homeData, awayData] = await Promise.all([
      apiFetch(`/injuries?team=${homeId}&season=2026`, apiKey),
      apiFetch(`/injuries?team=${awayId}&season=2026`, apiKey),
    ]);

    const homeInjuries = (homeData.response ?? []) as InjuryPlayer[];
    const awayInjuries = (awayData.response ?? []) as InjuryPlayer[];

    return NextResponse.json({ home: homeInjuries, away: awayInjuries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

interface InjuryPlayer {
  player: { id: number; name: string; photo: string };
  team: { id: number; name: string };
  fixture: { id: number; date: string; timezone: string };
  league: { id: number; season: number; name: string };
  reason: string;
  type: string; // "Missing Fixture", "Questionable", etc.
}
