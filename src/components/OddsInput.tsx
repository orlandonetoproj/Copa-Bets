"use client";

import { useState } from "react";
import { FixtureOdds, saveFixtureOdds } from "@/lib/storage";
import { Fixture } from "@/data/fixtures";

interface Props {
  fixture: Fixture;
  existing: FixtureOdds | null;
  onSave: (odds: FixtureOdds) => void;
}

export default function OddsInput({ fixture, existing, onSave }: Props) {
  const [home, setHome] = useState(existing?.home?.toString() ?? "");
  const [draw, setDraw] = useState(existing?.draw?.toString() ?? "");
  const [away, setAway] = useState(existing?.away?.toString() ?? "");
  const [over25, setOver25] = useState(existing?.over25?.toString() ?? "");
  const [under25, setUnder25] = useState(existing?.under25?.toString() ?? "");

  function handleSave() {
    const h = parseFloat(home);
    const d = parseFloat(draw);
    const a = parseFloat(away);
    if (isNaN(h) || isNaN(d) || isNaN(a) || h <= 1 || d <= 1 || a <= 1) return;
    const odds: FixtureOdds = {
      fixtureId: fixture.id,
      home: h,
      draw: d,
      away: a,
      over25: over25 ? parseFloat(over25) : undefined,
      under25: under25 ? parseFloat(under25) : undefined,
      updatedAt: new Date().toISOString(),
    };
    saveFixtureOdds(odds);
    onSave(odds);
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-xs text-gray-400 mb-2">Inserir odds (formato decimal, ex: 2.10)</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: fixture.homeTeam, value: home, set: setHome },
          { label: "Empate", value: draw, set: setDraw },
          { label: fixture.awayTeam, value: away, set: setAway },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label className="text-xs text-gray-400 block mb-1 truncate">{label}</label>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder="2.10"
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: "Over 2.5", value: over25, set: setOver25 },
          { label: "Under 2.5", value: under25, set: setUnder25 },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label className="text-xs text-gray-400 block mb-1">{label}</label>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-semibold py-1.5 rounded transition-colors"
      >
        Analisar
      </button>
    </div>
  );
}
