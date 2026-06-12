export interface Fixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string; // ISO
  group: string;
  stage: string;
  venue: string;
  homeIsHost?: boolean;
}

// FIFA World Cup 2026 — Group Stage
// Groups conforme sorteio oficial (5 Dez 2024)
// Rodada 3 de cada grupo sempre simultânea (mesmo horário)
export const GROUP_FIXTURES: Fixture[] = [

  // ── Grupo A: México · África do Sul · Coreia do Sul · República Tcheca ──
  { id: "GA1", homeTeam: "Mexico",       awayTeam: "South Africa", date: "2026-06-11T16:00", group: "A", stage: "Fase de Grupos", venue: "SoFi Stadium, Los Angeles",      homeIsHost: true },
  { id: "GA2", homeTeam: "South Korea",  awayTeam: "Czech Republic", date: "2026-06-11T19:00", group: "A", stage: "Fase de Grupos", venue: "AT&T Stadium, Dallas" },
  { id: "GA3", homeTeam: "Mexico",       awayTeam: "South Korea",  date: "2026-06-15T19:00", group: "A", stage: "Fase de Grupos", venue: "Estadio Azteca, Cidade do México", homeIsHost: true },
  { id: "GA4", homeTeam: "Czech Republic", awayTeam: "South Africa", date: "2026-06-15T16:00", group: "A", stage: "Fase de Grupos", venue: "AT&T Stadium, Dallas" },
  { id: "GA5", homeTeam: "Mexico",       awayTeam: "Czech Republic", date: "2026-06-19T20:00", group: "A", stage: "Fase de Grupos", venue: "Estadio BBVA, Monterrey",         homeIsHost: true },
  { id: "GA6", homeTeam: "South Africa", awayTeam: "South Korea",  date: "2026-06-19T20:00", group: "A", stage: "Fase de Grupos", venue: "NRG Stadium, Houston" },

  // ── Grupo B: Canadá · Bósnia e Herzegovina · Catar · Suíça ──
  { id: "GB1", homeTeam: "Canada",       awayTeam: "Qatar",               date: "2026-06-12T18:00", group: "B", stage: "Fase de Grupos", venue: "BC Place, Vancouver",            homeIsHost: true },
  { id: "GB2", homeTeam: "Bosnia and Herzegovina", awayTeam: "Switzerland", date: "2026-06-12T21:00", group: "B", stage: "Fase de Grupos", venue: "Levi's Stadium, San Francisco" },
  { id: "GB3", homeTeam: "Canada",       awayTeam: "Bosnia and Herzegovina", date: "2026-06-16T18:00", group: "B", stage: "Fase de Grupos", venue: "BMO Field, Toronto",            homeIsHost: true },
  { id: "GB4", homeTeam: "Qatar",        awayTeam: "Switzerland",         date: "2026-06-16T21:00", group: "B", stage: "Fase de Grupos", venue: "Levi's Stadium, San Francisco" },
  { id: "GB5", homeTeam: "Canada",       awayTeam: "Switzerland",         date: "2026-06-20T21:00", group: "B", stage: "Fase de Grupos", venue: "BC Place, Vancouver",            homeIsHost: true },
  { id: "GB6", homeTeam: "Bosnia and Herzegovina", awayTeam: "Qatar",     date: "2026-06-20T21:00", group: "B", stage: "Fase de Grupos", venue: "Levi's Stadium, San Francisco" },

  // ── Grupo C: Brasil · Marrocos · Haiti · Escócia ──
  { id: "GC1", homeTeam: "Brazil",   awayTeam: "Scotland", date: "2026-06-12T19:00", group: "C", stage: "Fase de Grupos", venue: "MetLife Stadium, Nova York" },
  { id: "GC2", homeTeam: "Morocco",  awayTeam: "Haiti",    date: "2026-06-12T16:00", group: "C", stage: "Fase de Grupos", venue: "Hard Rock Stadium, Miami" },
  { id: "GC3", homeTeam: "Brazil",   awayTeam: "Morocco",  date: "2026-06-16T19:00", group: "C", stage: "Fase de Grupos", venue: "MetLife Stadium, Nova York" },
  { id: "GC4", homeTeam: "Haiti",    awayTeam: "Scotland", date: "2026-06-16T16:00", group: "C", stage: "Fase de Grupos", venue: "Hard Rock Stadium, Miami" },
  { id: "GC5", homeTeam: "Brazil",   awayTeam: "Haiti",    date: "2026-06-20T19:00", group: "C", stage: "Fase de Grupos", venue: "MetLife Stadium, Nova York" },
  { id: "GC6", homeTeam: "Morocco",  awayTeam: "Scotland", date: "2026-06-20T19:00", group: "C", stage: "Fase de Grupos", venue: "Hard Rock Stadium, Miami" },

  // ── Grupo D: EUA · Paraguai · Austrália · Turquia ──
  { id: "GD1", homeTeam: "USA",       awayTeam: "Paraguay",   date: "2026-06-13T21:00", group: "D", stage: "Fase de Grupos", venue: "MetLife Stadium, Nova York",       homeIsHost: true },
  { id: "GD2", homeTeam: "Australia", awayTeam: "Turkey",     date: "2026-06-13T18:00", group: "D", stage: "Fase de Grupos", venue: "Arrowhead Stadium, Kansas City" },
  { id: "GD3", homeTeam: "USA",       awayTeam: "Australia",  date: "2026-06-17T21:00", group: "D", stage: "Fase de Grupos", venue: "Levi's Stadium, San Francisco",    homeIsHost: true },
  { id: "GD4", homeTeam: "Paraguay",  awayTeam: "Turkey",     date: "2026-06-17T18:00", group: "D", stage: "Fase de Grupos", venue: "Arrowhead Stadium, Kansas City" },
  { id: "GD5", homeTeam: "USA",       awayTeam: "Turkey",     date: "2026-06-21T21:00", group: "D", stage: "Fase de Grupos", venue: "Levi's Stadium, San Francisco",    homeIsHost: true },
  { id: "GD6", homeTeam: "Paraguay",  awayTeam: "Australia",  date: "2026-06-21T21:00", group: "D", stage: "Fase de Grupos", venue: "Arrowhead Stadium, Kansas City" },

  // ── Grupo E: Alemanha · Curaçau · Costa do Marfim · Equador ──
  { id: "GE1", homeTeam: "Germany",      awayTeam: "Curacao",      date: "2026-06-13T16:00", group: "E", stage: "Fase de Grupos", venue: "Lincoln Financial Field, Philadelphia" },
  { id: "GE2", homeTeam: "Ivory Coast",  awayTeam: "Ecuador",      date: "2026-06-13T19:00", group: "E", stage: "Fase de Grupos", venue: "Empower Field, Denver" },
  { id: "GE3", homeTeam: "Germany",      awayTeam: "Ivory Coast",  date: "2026-06-17T16:00", group: "E", stage: "Fase de Grupos", venue: "Lincoln Financial Field, Philadelphia" },
  { id: "GE4", homeTeam: "Curacao",      awayTeam: "Ecuador",      date: "2026-06-17T19:00", group: "E", stage: "Fase de Grupos", venue: "Empower Field, Denver" },
  { id: "GE5", homeTeam: "Germany",      awayTeam: "Ecuador",      date: "2026-06-21T16:00", group: "E", stage: "Fase de Grupos", venue: "Lincoln Financial Field, Philadelphia" },
  { id: "GE6", homeTeam: "Curacao",      awayTeam: "Ivory Coast",  date: "2026-06-21T16:00", group: "E", stage: "Fase de Grupos", venue: "Empower Field, Denver" },

  // ── Grupo F: Holanda · Japão · Suécia · Tunísia ──
  { id: "GF1", homeTeam: "Netherlands", awayTeam: "Tunisia", date: "2026-06-14T19:00", group: "F", stage: "Fase de Grupos", venue: "Gillette Stadium, Boston" },
  { id: "GF2", homeTeam: "Japan",       awayTeam: "Sweden",  date: "2026-06-14T16:00", group: "F", stage: "Fase de Grupos", venue: "Camping World Stadium, Orlando" },
  { id: "GF3", homeTeam: "Netherlands", awayTeam: "Japan",   date: "2026-06-18T19:00", group: "F", stage: "Fase de Grupos", venue: "Gillette Stadium, Boston" },
  { id: "GF4", homeTeam: "Sweden",      awayTeam: "Tunisia", date: "2026-06-18T16:00", group: "F", stage: "Fase de Grupos", venue: "Camping World Stadium, Orlando" },
  { id: "GF5", homeTeam: "Netherlands", awayTeam: "Sweden",  date: "2026-06-22T19:00", group: "F", stage: "Fase de Grupos", venue: "Gillette Stadium, Boston" },
  { id: "GF6", homeTeam: "Tunisia",     awayTeam: "Japan",   date: "2026-06-22T19:00", group: "F", stage: "Fase de Grupos", venue: "Camping World Stadium, Orlando" },

  // ── Grupo G: Bélgica · Egito · Irã · Nova Zelândia ──
  { id: "GG1", homeTeam: "Belgium",     awayTeam: "New Zealand", date: "2026-06-14T18:00", group: "G", stage: "Fase de Grupos", venue: "AT&T Stadium, Dallas" },
  { id: "GG2", homeTeam: "Egypt",       awayTeam: "Iran",        date: "2026-06-14T21:00", group: "G", stage: "Fase de Grupos", venue: "NRG Stadium, Houston" },
  { id: "GG3", homeTeam: "Belgium",     awayTeam: "Egypt",       date: "2026-06-18T18:00", group: "G", stage: "Fase de Grupos", venue: "AT&T Stadium, Dallas" },
  { id: "GG4", homeTeam: "Iran",        awayTeam: "New Zealand", date: "2026-06-18T21:00", group: "G", stage: "Fase de Grupos", venue: "NRG Stadium, Houston" },
  { id: "GG5", homeTeam: "Belgium",     awayTeam: "Iran",        date: "2026-06-22T18:00", group: "G", stage: "Fase de Grupos", venue: "AT&T Stadium, Dallas" },
  { id: "GG6", homeTeam: "Egypt",       awayTeam: "New Zealand", date: "2026-06-22T18:00", group: "G", stage: "Fase de Grupos", venue: "NRG Stadium, Houston" },

  // ── Grupo H: Espanha · Cabo Verde · Arábia Saudita · Uruguai ──
  { id: "GH1", homeTeam: "Spain",         awayTeam: "Cape Verde",   date: "2026-06-15T21:00", group: "H", stage: "Fase de Grupos", venue: "Hard Rock Stadium, Miami" },
  { id: "GH2", homeTeam: "Saudi Arabia",  awayTeam: "Uruguay",      date: "2026-06-15T18:00", group: "H", stage: "Fase de Grupos", venue: "Estadio Azteca, Cidade do México" },
  { id: "GH3", homeTeam: "Spain",         awayTeam: "Saudi Arabia", date: "2026-06-19T21:00", group: "H", stage: "Fase de Grupos", venue: "Hard Rock Stadium, Miami" },
  { id: "GH4", homeTeam: "Cape Verde",    awayTeam: "Uruguay",      date: "2026-06-19T18:00", group: "H", stage: "Fase de Grupos", venue: "Estadio Azteca, Cidade do México" },
  { id: "GH5", homeTeam: "Spain",         awayTeam: "Uruguay",      date: "2026-06-23T21:00", group: "H", stage: "Fase de Grupos", venue: "Hard Rock Stadium, Miami" },
  { id: "GH6", homeTeam: "Saudi Arabia",  awayTeam: "Cape Verde",   date: "2026-06-23T21:00", group: "H", stage: "Fase de Grupos", venue: "Estadio Azteca, Cidade do México" },

  // ── Grupo I: França · Senegal · Iraque · Noruega ──
  { id: "GI1", homeTeam: "France",  awayTeam: "Iraq",    date: "2026-06-15T16:00", group: "I", stage: "Fase de Grupos", venue: "Empower Field, Denver" },
  { id: "GI2", homeTeam: "Senegal", awayTeam: "Norway",  date: "2026-06-15T19:00", group: "I", stage: "Fase de Grupos", venue: "Commanders Field, Washington D.C." },
  { id: "GI3", homeTeam: "France",  awayTeam: "Senegal", date: "2026-06-19T16:00", group: "I", stage: "Fase de Grupos", venue: "Empower Field, Denver" },
  { id: "GI4", homeTeam: "Iraq",    awayTeam: "Norway",  date: "2026-06-19T19:00", group: "I", stage: "Fase de Grupos", venue: "Commanders Field, Washington D.C." },
  { id: "GI5", homeTeam: "France",  awayTeam: "Norway",  date: "2026-06-23T16:00", group: "I", stage: "Fase de Grupos", venue: "Empower Field, Denver" },
  { id: "GI6", homeTeam: "Senegal", awayTeam: "Iraq",    date: "2026-06-23T16:00", group: "I", stage: "Fase de Grupos", venue: "Commanders Field, Washington D.C." },

  // ── Grupo J: Argentina · Argélia · Áustria · Jordânia ──
  { id: "GJ1", homeTeam: "Argentina", awayTeam: "Algeria", date: "2026-06-16T21:00", group: "J", stage: "Fase de Grupos", venue: "MetLife Stadium, Nova York" },
  { id: "GJ2", homeTeam: "Austria",   awayTeam: "Jordan",  date: "2026-06-16T18:00", group: "J", stage: "Fase de Grupos", venue: "Estadio Akron, Guadalajara" },
  { id: "GJ3", homeTeam: "Argentina", awayTeam: "Austria", date: "2026-06-20T21:00", group: "J", stage: "Fase de Grupos", venue: "MetLife Stadium, Nova York" },
  { id: "GJ4", homeTeam: "Algeria",   awayTeam: "Jordan",  date: "2026-06-20T18:00", group: "J", stage: "Fase de Grupos", venue: "Estadio Akron, Guadalajara" },
  { id: "GJ5", homeTeam: "Argentina", awayTeam: "Jordan",  date: "2026-06-24T21:00", group: "J", stage: "Fase de Grupos", venue: "MetLife Stadium, Nova York" },
  { id: "GJ6", homeTeam: "Algeria",   awayTeam: "Austria", date: "2026-06-24T21:00", group: "J", stage: "Fase de Grupos", venue: "Estadio Akron, Guadalajara" },

  // ── Grupo K: Portugal · RD do Congo · Uzbequistão · Colômbia ──
  { id: "GK1", homeTeam: "Portugal",   awayTeam: "Uzbekistan", date: "2026-06-17T19:00", group: "K", stage: "Fase de Grupos", venue: "BMO Field, Toronto" },
  { id: "GK2", homeTeam: "DR Congo",   awayTeam: "Colombia",   date: "2026-06-17T22:00", group: "K", stage: "Fase de Grupos", venue: "BC Place, Vancouver" },
  { id: "GK3", homeTeam: "Portugal",   awayTeam: "DR Congo",   date: "2026-06-21T19:00", group: "K", stage: "Fase de Grupos", venue: "BMO Field, Toronto" },
  { id: "GK4", homeTeam: "Uzbekistan", awayTeam: "Colombia",   date: "2026-06-21T22:00", group: "K", stage: "Fase de Grupos", venue: "BC Place, Vancouver" },
  { id: "GK5", homeTeam: "Portugal",   awayTeam: "Colombia",   date: "2026-06-25T19:00", group: "K", stage: "Fase de Grupos", venue: "BMO Field, Toronto" },
  { id: "GK6", homeTeam: "DR Congo",   awayTeam: "Uzbekistan", date: "2026-06-25T19:00", group: "K", stage: "Fase de Grupos", venue: "BC Place, Vancouver" },

  // ── Grupo L: Inglaterra · Croácia · Gana · Panamá ──
  { id: "GL1", homeTeam: "England", awayTeam: "Panama",  date: "2026-06-18T16:00", group: "L", stage: "Fase de Grupos", venue: "Arrowhead Stadium, Kansas City" },
  { id: "GL2", homeTeam: "Croatia", awayTeam: "Ghana",   date: "2026-06-18T19:00", group: "L", stage: "Fase de Grupos", venue: "Camping World Stadium, Orlando" },
  { id: "GL3", homeTeam: "England", awayTeam: "Croatia", date: "2026-06-22T16:00", group: "L", stage: "Fase de Grupos", venue: "Arrowhead Stadium, Kansas City" },
  { id: "GL4", homeTeam: "Panama",  awayTeam: "Ghana",   date: "2026-06-22T19:00", group: "L", stage: "Fase de Grupos", venue: "Camping World Stadium, Orlando" },
  { id: "GL5", homeTeam: "England", awayTeam: "Ghana",   date: "2026-06-26T16:00", group: "L", stage: "Fase de Grupos", venue: "Arrowhead Stadium, Kansas City" },
  { id: "GL6", homeTeam: "Croatia", awayTeam: "Panama",  date: "2026-06-26T16:00", group: "L", stage: "Fase de Grupos", venue: "Camping World Stadium, Orlando" },
];
