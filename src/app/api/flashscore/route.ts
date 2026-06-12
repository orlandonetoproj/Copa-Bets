import { NextRequest, NextResponse } from "next/server";

const NINJA_BASE = "https://global.flashscore.ninja/401/x/feed";
const HEADERS = {
  "x-fsign": "SW9D1eZo",
  "Referer": "https://www.flashscore.com.br/",
  "Accept": "*/*",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

// WC average goals per team per match — used to normalize attack/defense
const WC_AVG_GOALS = 1.20;

interface FeedRecord { [key: string]: string }

function parseFeed(raw: string): FeedRecord[] {
  if (!raw || raw.trim() === "0") return [];
  return raw
    .split("~")
    .filter(Boolean)
    .map((rec) => {
      const obj: FeedRecord = {};
      rec.split("¬").filter(Boolean).forEach((field) => {
        const i = field.indexOf("÷");
        if (i > 0) obj[field.slice(0, i)] = field.slice(i + 1);
      });
      return obj;
    })
    .filter((o) => Object.keys(o).length > 0 && o.AA); // only match records
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");
  const maxPages = Math.min(parseInt(searchParams.get("pages") ?? "2"), 3);

  if (!teamId) {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }

  // Fetch results pages from Flashscore ninja API
  const allMatches: FeedRecord[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${NINJA_BASE}/pr_1_2_${teamId}_${page}_-3_pt-br_1`;
    try {
      const res = await fetch(url, { headers: HEADERS, next: { revalidate: 3600 } });
      if (!res.ok) break;
      const text = await res.text();
      const records = parseFeed(text);
      if (records.length === 0) break;
      allMatches.push(...records);
    } catch {
      break;
    }
  }

  if (allMatches.length === 0) {
    return NextResponse.json({ error: "Nenhum resultado encontrado para esse time", matches: 0 }, { status: 404 });
  }

  // Use at most 20 most recent matches for relevance
  const recentMatches = allMatches.slice(0, 20);
  let totalScored = 0;
  let totalConceded = 0;
  const lastFiveResults: ("W" | "D" | "L")[] = [];
  const recentResults: { date: string; home: string; homeGoals: number; away: string; awayGoals: number }[] = [];

  for (const r of recentMatches) {
    // PY = home team ID, PX = away team ID (confirmed from field analysis)
    const isHome = r.PY === teamId;
    const homeGoals = parseInt(r.AH ?? "0");
    const awayGoals = parseInt(r.AG ?? "0");

    const teamGoals = isHome ? homeGoals : awayGoals;
    const oppGoals = isHome ? awayGoals : homeGoals;

    totalScored += teamGoals;
    totalConceded += oppGoals;

    if (lastFiveResults.length < 5) {
      if (teamGoals > oppGoals) lastFiveResults.push("W");
      else if (teamGoals < oppGoals) lastFiveResults.push("L");
      else lastFiveResults.push("D");
    }

    const ts = r.AD ? parseInt(r.AD) * 1000 : null;
    recentResults.push({
      date: ts ? new Date(ts).toISOString().split("T")[0] : "?",
      home: r.AF ?? "?",
      homeGoals,
      away: r.AE ?? "?",
      awayGoals,
    });
  }

  const n = recentMatches.length;
  const avgScored = parseFloat((totalScored / n).toFixed(3));
  const avgConceded = parseFloat((totalConceded / n).toFixed(3));
  const attack = parseFloat((avgScored / WC_AVG_GOALS).toFixed(3));
  const defense = parseFloat((avgConceded / WC_AVG_GOALS).toFixed(3));

  return NextResponse.json({
    source: "flashscore",
    matches: n,
    avgScored,
    avgConceded,
    attack,
    defense,
    lastFiveResults,
    recentResults: recentResults.slice(0, 8),
  });
}
