import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey || apiKey === "cole_sua_chave_aqui") {
    return NextResponse.json({ error: "ODDS_API_KEY não configurada" }, { status: 400 });
  }

  // Sport já está no path; regions=eu,us garante mais cobertura de bookmakers
  const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${apiKey}&regions=eu,us,uk,us2&markets=h2h,totals,btts&oddsFormat=decimal`;

  try {
    // cache: no-store — o cliente controla o cache via localStorage (30 min)
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `The Odds API ${res.status}: ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json({
      events: Array.isArray(data) ? data : [],
      remaining: res.headers.get("x-requests-remaining"),
      used: res.headers.get("x-requests-used"),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
