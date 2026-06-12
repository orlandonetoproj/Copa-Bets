export interface TeamStrength {
  name: string;
  attack: number;
  defense: number;
  fifaRank: number;
}

// Attack > 1 = above average scorers; Defense < 1 = above average defensively
// Base expected goals per team per WC match ≈ 1.20
export const TEAMS: Record<string, TeamStrength> = {
  // Tier 1 — World Elite
  Argentina: { name: "Argentina", attack: 1.85, defense: 0.58, fifaRank: 1 },
  France: { name: "France", attack: 1.75, defense: 0.60, fifaRank: 2 },
  England: { name: "England", attack: 1.65, defense: 0.65, fifaRank: 3 },
  Spain: { name: "Spain", attack: 1.65, defense: 0.62, fifaRank: 4 },
  Brazil: { name: "Brazil", attack: 1.70, defense: 0.63, fifaRank: 5 },
  Portugal: { name: "Portugal", attack: 1.60, defense: 0.67, fifaRank: 6 },

  // Tier 2 — Strong contenders
  Netherlands: { name: "Netherlands", attack: 1.55, defense: 0.72, fifaRank: 7 },
  Germany: { name: "Germany", attack: 1.50, defense: 0.73, fifaRank: 8 },
  Belgium: { name: "Belgium", attack: 1.45, defense: 0.75, fifaRank: 9 },
  Croatia: { name: "Croatia", attack: 1.40, defense: 0.75, fifaRank: 10 },
  Uruguay: { name: "Uruguay", attack: 1.38, defense: 0.74, fifaRank: 11 },
  Colombia: { name: "Colombia", attack: 1.35, defense: 0.78, fifaRank: 12 },
  Morocco: { name: "Morocco", attack: 1.30, defense: 0.72, fifaRank: 13 },
  Switzerland: { name: "Switzerland", attack: 1.25, defense: 0.76, fifaRank: 14 },
  Japan: { name: "Japan", attack: 1.28, defense: 0.78, fifaRank: 15 },
  Denmark: { name: "Denmark", attack: 1.22, defense: 0.78, fifaRank: 16 },

  // Tier 3 — Solid
  USA: { name: "USA", attack: 1.18, defense: 0.85, fifaRank: 17 },
  Mexico: { name: "Mexico", attack: 1.18, defense: 0.84, fifaRank: 18 },
  Austria: { name: "Austria", attack: 1.20, defense: 0.82, fifaRank: 19 },
  Serbia: { name: "Serbia", attack: 1.20, defense: 0.83, fifaRank: 20 },
  Ecuador: { name: "Ecuador", attack: 1.15, defense: 0.85, fifaRank: 21 },
  Senegal: { name: "Senegal", attack: 1.18, defense: 0.84, fifaRank: 22 },
  Poland: { name: "Poland", attack: 1.15, defense: 0.85, fifaRank: 23 },
  Australia: { name: "Australia", attack: 1.12, defense: 0.87, fifaRank: 24 },
  "South Korea": { name: "South Korea", attack: 1.15, defense: 0.86, fifaRank: 25 },
  Turkey: { name: "Turkey", attack: 1.15, defense: 0.86, fifaRank: 26 },
  Canada: { name: "Canada", attack: 1.10, defense: 0.88, fifaRank: 27 },
  Hungary: { name: "Hungary", attack: 1.10, defense: 0.88, fifaRank: 28 },
  Nigeria: { name: "Nigeria", attack: 1.12, defense: 0.87, fifaRank: 29 },
  "Czech Republic": { name: "Czech Republic", attack: 1.10, defense: 0.89, fifaRank: 30 },

  // Tier 4 — Average
  Ukraine: { name: "Ukraine", attack: 1.08, defense: 0.90, fifaRank: 31 },
  Slovakia: { name: "Slovakia", attack: 1.05, defense: 0.91, fifaRank: 32 },
  Romania: { name: "Romania", attack: 1.05, defense: 0.91, fifaRank: 33 },
  Scotland: { name: "Scotland", attack: 1.05, defense: 0.91, fifaRank: 34 },
  "Saudi Arabia": { name: "Saudi Arabia", attack: 1.05, defense: 0.92, fifaRank: 35 },
  Iran: { name: "Iran", attack: 1.05, defense: 0.92, fifaRank: 36 },
  Paraguay: { name: "Paraguay", attack: 1.02, defense: 0.93, fifaRank: 37 },
  Tunisia: { name: "Tunisia", attack: 1.02, defense: 0.93, fifaRank: 38 },
  Algeria: { name: "Algeria", attack: 1.02, defense: 0.93, fifaRank: 39 },
  "Ivory Coast": { name: "Ivory Coast", attack: 1.05, defense: 0.92, fifaRank: 40 },
  Greece: { name: "Greece", attack: 1.00, defense: 0.93, fifaRank: 41 },
  Egypt: { name: "Egypt", attack: 1.02, defense: 0.93, fifaRank: 42 },
  Slovenia: { name: "Slovenia", attack: 1.00, defense: 0.93, fifaRank: 43 },
  Ghana: { name: "Ghana", attack: 1.00, defense: 0.95, fifaRank: 44 },
  Venezuela: { name: "Venezuela", attack: 0.98, defense: 0.97, fifaRank: 45 },
  Cameroon: { name: "Cameroon", attack: 1.00, defense: 0.96, fifaRank: 46 },
  Mali: { name: "Mali", attack: 0.98, defense: 0.97, fifaRank: 47 },
  Iraq: { name: "Iraq", attack: 0.95, defense: 0.98, fifaRank: 48 },

  // Tier 5 — Underdogs
  Honduras: { name: "Honduras", attack: 0.90, defense: 1.05, fifaRank: 49 },
  "Costa Rica": { name: "Costa Rica", attack: 0.92, defense: 1.02, fifaRank: 50 },
  Jamaica: { name: "Jamaica", attack: 0.88, defense: 1.06, fifaRank: 51 },
  Panama: { name: "Panama", attack: 0.88, defense: 1.07, fifaRank: 52 },
  Bolivia: { name: "Bolivia", attack: 0.85, defense: 1.08, fifaRank: 53 },
  "El Salvador": { name: "El Salvador", attack: 0.85, defense: 1.09, fifaRank: 54 },
  Uzbekistan: { name: "Uzbekistan", attack: 0.92, defense: 1.03, fifaRank: 55 },
  "New Zealand": { name: "New Zealand", attack: 0.82, defense: 1.10, fifaRank: 56 },
  "South Africa": { name: "South Africa", attack: 0.92, defense: 1.02, fifaRank: 57 },
  Jordan: { name: "Jordan", attack: 0.90, defense: 1.04, fifaRank: 58 },
  Albania: { name: "Albania", attack: 0.95, defense: 1.00, fifaRank: 59 },
  Norway: { name: "Norway", attack: 1.08, defense: 0.90, fifaRank: 36 },
  Iceland: { name: "Iceland", attack: 0.95, defense: 0.98, fifaRank: 60 },

  // Novos times Copa 2026
  Sweden: { name: "Sweden", attack: 1.15, defense: 0.87, fifaRank: 28 },
  "Bosnia and Herzegovina": { name: "Bosnia and Herzegovina", attack: 1.05, defense: 0.92, fifaRank: 38 },
  Qatar: { name: "Qatar", attack: 0.82, defense: 1.10, fifaRank: 68 },
  Haiti: { name: "Haiti", attack: 0.78, defense: 1.15, fifaRank: 85 },
  "Cape Verde": { name: "Cape Verde", attack: 0.90, defense: 1.03, fifaRank: 62 },
  "DR Congo": { name: "DR Congo", attack: 0.92, defense: 1.02, fifaRank: 55 },
  Curacao: { name: "Curacao", attack: 0.78, defense: 1.12, fifaRank: 88 },
};

export function getTeamStrength(name: string): TeamStrength {
  return (
    TEAMS[name] ?? {
      name,
      attack: 1.0,
      defense: 1.0,
      fifaRank: 99,
    }
  );
}

// Average home advantage factor (slight for host nations in WC)
export const HOST_ADVANTAGE = 1.12;
// Calibrated from Copa history: 2022=1.345, 2018=1.320, 2014=1.335 → avg 1.33
export const BASE_GOALS = 1.33;
