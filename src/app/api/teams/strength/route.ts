import { NextRequest, NextResponse } from "next/server";

// ─── ESPN IDs for all 48 Copa 2026 teams ─────────────────────────────────────
const ESPN_IDS: Record<string, number> = {
  Algeria:                 624,
  Argentina:               202,
  Australia:               628,
  Austria:                 474,
  Belgium:                 459,
  "Bosnia and Herzegovina": 452,
  Brazil:                  205,
  Canada:                  206,
  "Cape Verde":            2597,
  Colombia:                208,
  "DR Congo":              2850,
  Croatia:                 477,
  Curacao:                11678,
  "Czech Republic":        450,
  Ecuador:                 209,
  Egypt:                  2620,
  England:                 448,
  France:                  478,
  Germany:                 481,
  Ghana:                  4469,
  Haiti:                  2654,
  Iran:                    469,
  Iraq:                   4375,
  "Ivory Coast":          4789,
  Japan:                   627,
  Jordan:                 2917,
  Mexico:                  203,
  Morocco:                2869,
  Netherlands:             449,
  "New Zealand":          2666,
  Norway:                  464,
  Panama:                 2659,
  Paraguay:                210,
  Portugal:                482,
  Qatar:                  4398,
  "Saudi Arabia":          655,
  Scotland:                580,
  Senegal:                 654,
  "South Africa":          467,
  "South Korea":           451,
  Spain:                   164,
  Sweden:                  466,
  Switzerland:             475,
  Tunisia:                 659,
  Turkey:                  465,
  USA:                     660,
  Uruguay:                 212,
  Uzbekistan:             2570,
};

// Confederation qualifier league for each team
const QUALIFIER_LEAGUE: Record<string, string> = {
  // CONMEBOL
  Argentina: "fifa.worldq.conmebol", Brazil: "fifa.worldq.conmebol",
  Colombia:  "fifa.worldq.conmebol", Ecuador: "fifa.worldq.conmebol",
  Paraguay:  "fifa.worldq.conmebol", Uruguay: "fifa.worldq.conmebol",
  // UEFA
  Austria:   "fifa.worldq.uefa",    Belgium:  "fifa.worldq.uefa",
  "Bosnia and Herzegovina": "fifa.worldq.uefa",
  Croatia:   "fifa.worldq.uefa",    "Czech Republic": "fifa.worldq.uefa",
  England:   "fifa.worldq.uefa",    France:   "fifa.worldq.uefa",
  Germany:   "fifa.worldq.uefa",    Netherlands: "fifa.worldq.uefa",
  Norway:    "fifa.worldq.uefa",    Portugal: "fifa.worldq.uefa",
  Scotland:  "fifa.worldq.uefa",    Spain:    "fifa.worldq.uefa",
  Sweden:    "fifa.worldq.uefa",    Switzerland: "fifa.worldq.uefa",
  Turkey:    "fifa.worldq.uefa",
  // CONCACAF
  Canada:    "fifa.worldq.concacaf", Curacao: "fifa.worldq.concacaf",
  Haiti:     "fifa.worldq.concacaf", Mexico:  "fifa.worldq.concacaf",
  Panama:    "fifa.worldq.concacaf", USA:     "fifa.worldq.concacaf",
  // CAF
  Algeria:   "fifa.worldq.caf",   "Cape Verde":  "fifa.worldq.caf",
  "DR Congo":"fifa.worldq.caf",    Egypt:    "fifa.worldq.caf",
  Ghana:     "fifa.worldq.caf",    "Ivory Coast": "fifa.worldq.caf",
  Morocco:   "fifa.worldq.caf",    Senegal:  "fifa.worldq.caf",
  "South Africa": "fifa.worldq.caf", Tunisia: "fifa.worldq.caf",
  // AFC
  Australia: "fifa.worldq.afc",    Iran:     "fifa.worldq.afc",
  Iraq:      "fifa.worldq.afc",    Japan:    "fifa.worldq.afc",
  Jordan:    "fifa.worldq.afc",    Qatar:    "fifa.worldq.afc",
  "Saudi Arabia": "fifa.worldq.afc", "South Korea": "fifa.worldq.afc",
  Uzbekistan:"fifa.worldq.afc",
  // OFC
  "New Zealand": "fifa.worldq.ofc",
};

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const BASE_GOALS = 1.33;
const LAMBDA_DECAY = Math.LN2 / 180;

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { id: string; displayName: string };
  score: { value: number; displayValue: string } | null;
}

interface EspnEvent {
  date: string;
  competitions: Array<{
    status: { type: { state: string; completed: boolean } };
    competitors: EspnCompetitor[];
  }>;
}

async function fetchSchedule(league: string, teamId: number): Promise<EspnEvent[]> {
  const url = `${ESPN_BASE}/${league}/teams/${teamId}/schedule`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.events) ? data.events : [];
}

function extractMatches(events: EspnEvent[], espnId: number) {
  const completed = events.filter(
    (e) => e.competitions[0]?.status?.type?.state === "post"
      || e.competitions[0]?.status?.type?.completed === true
  );

  return completed.map((e) => {
    const comp = e.competitions[0];
    const teamComp = comp.competitors.find(
      (c) => String(c.team?.id) === String(espnId)
    );
    const opponentComp = comp.competitors.find(
      (c) => String(c.team?.id) !== String(espnId)
    );
    const scored    = Number(teamComp?.score?.value     ?? teamComp?.score?.displayValue     ?? 0);
    const conceded  = Number(opponentComp?.score?.value ?? opponentComp?.score?.displayValue ?? 0);
    return { date: e.date, scored, conceded };
  }).filter((m) => m.date);
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const espnId = ESPN_IDS[name];
  if (!espnId) {
    return NextResponse.json({ error: `ESPN ID not found for: ${name}` }, { status: 404 });
  }

  const qualifierLeague = QUALIFIER_LEAGUE[name];
  if (!qualifierLeague) {
    return NextResponse.json({ error: `Qualifier league not found for: ${name}` }, { status: 404 });
  }

  try {
    // Fetch qualifier results AND friendlies in parallel for maximum recent history
    const [qualEvents, friendlyEvents] = await Promise.all([
      fetchSchedule(qualifierLeague, espnId),
      fetchSchedule("fifa.friendly", espnId),
    ]);

    const qualMatches     = extractMatches(qualEvents, espnId);
    const friendlyMatches = extractMatches(friendlyEvents, espnId);

    // Merge and sort all matches by date descending, take 10 most recent
    const all = [...qualMatches, ...friendlyMatches]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Deduplicate by date+score (same game may appear in multiple leagues)
    const seen = new Set<string>();
    const deduped = all.filter((m) => {
      const key = `${m.date.substring(0, 10)}-${m.scored}-${m.conceded}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const recent = deduped.slice(0, 10);

    if (recent.length === 0) {
      return NextResponse.json({ error: "No completed matches found" }, { status: 404 });
    }

    const lastFiveResults = deduped.slice(0, 5).map((m) =>
      m.scored > m.conceded ? "W" : m.scored === m.conceded ? "D" : "L"
    ) as Array<"W" | "D" | "L">;

    const now = Date.now();
    let weightedScored = 0, weightedConceded = 0, totalWeight = 0;
    let rawScored = 0, rawConceded = 0;

    for (const m of recent) {
      const daysSince = (now - new Date(m.date).getTime()) / 86400000;
      const w = Math.exp(-LAMBDA_DECAY * daysSince);
      weightedScored   += m.scored   * w;
      weightedConceded += m.conceded * w;
      totalWeight      += w;
      rawScored  += m.scored;
      rawConceded += m.conceded;
    }

    const n = recent.length;
    return NextResponse.json({
      name,
      espnTeamId: espnId,
      source: "espn",
      attack:      Math.max(0.5, (weightedScored   / totalWeight) / BASE_GOALS),
      defense:     Math.max(0.3, (weightedConceded / totalWeight) / BASE_GOALS),
      matches:     n,
      avgScored:   rawScored   / n,
      avgConceded: rawConceded / n,
      lastFiveResults,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
