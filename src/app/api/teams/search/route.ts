import { NextRequest, NextResponse } from "next/server";

const BASE = "https://v3.football.api-sports.io";

// GET /api/teams/search?name=Brazil
// Returns team ID for a national team by name
export async function GET(req: NextRequest) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || apiKey === "cole_sua_chave_aqui") {
    return NextResponse.json({ error: "API_FOOTBALL_KEY não configurada" }, { status: 400 });
  }

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });

  const res = await fetch(
    `${BASE}/teams?name=${encodeURIComponent(name)}&type=national`,
    { headers: { "x-apisports-key": apiKey }, next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `API-Football ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  const teams = data.response ?? [];

  // Return all matches so client can pick best
  return NextResponse.json(
    teams.map((t: { team: { id: number; name: string; code: string; country: string } }) => ({
      id: t.team.id,
      name: t.team.name,
      code: t.team.code,
      country: t.team.country,
    }))
  );
}
