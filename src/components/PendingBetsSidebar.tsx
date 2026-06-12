"use client";

import { useState } from "react";
import { BetRecord, updateBetResult, cancelBet, cashoutBet } from "@/lib/storage";
import { Clock, X } from "lucide-react";

interface Props {
  bets: BetRecord[];
  onRefresh: () => void;
}

export default function PendingBetsSidebar({ bets, onRefresh }: Props) {
  const pending = bets.filter((b) => !b.result);

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-orange-400" />
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Bets Pendentes
        </h2>
        <span className="ml-auto bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
          {pending.length}
        </span>
      </div>

      {pending.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-6">
          Nenhuma aposta pendente
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map((bet) => (
            <PendingBetCard key={bet.id} bet={bet} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingBetCard({ bet, onRefresh }: { bet: BetRecord; onRefresh: () => void }) {
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutValue, setCashoutValue] = useState("");

  function resolve(result: "win" | "loss" | "void") {
    updateBetResult(bet.id, result, bet.odds);
    onRefresh();
  }

  function handleCashout() {
    const amount = parseFloat(cashoutValue.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;
    cashoutBet(bet.id, amount);
    onRefresh();
  }

  function handleCancel() {
    cancelBet(bet.id);
    onRefresh();
  }

  const potentialReturn = bet.odds * bet.amount;
  const parsedCashout = parseFloat(cashoutValue.replace(",", "."));
  const cashoutProfit = !isNaN(parsedCashout) ? parsedCashout - bet.amount : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2.5">
      {/* Teams */}
      <p className="text-[10px] text-gray-500 font-mono truncate">
        {bet.homeTeam} vs {bet.awayTeam}
      </p>

      {/* Label + odds */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-white leading-tight">{bet.label}</p>
        <span className="text-xs font-mono text-gray-300 shrink-0">@ {bet.odds.toFixed(2)}</span>
      </div>

      {/* Amounts */}
      <div className="flex gap-2 text-xs flex-wrap">
        <span className="text-gray-500">
          Aposta <span className="text-white font-mono font-bold">R$ {bet.amount.toFixed(2)}</span>
        </span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-500">
          Retorno <span className="text-green-400 font-mono">R$ {potentialReturn.toFixed(2)}</span>
        </span>
      </div>

      {/* Result buttons */}
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={() => resolve("win")}
          className="bg-green-700 hover:bg-green-600 active:bg-green-800 text-white text-xs py-1.5 rounded font-semibold transition-colors"
        >
          Ganhou
        </button>
        <button
          onClick={() => resolve("loss")}
          className="bg-red-700 hover:bg-red-600 active:bg-red-800 text-white text-xs py-1.5 rounded font-semibold transition-colors"
        >
          Perdeu
        </button>
        <button
          onClick={() => resolve("void")}
          className="bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white text-xs py-1.5 rounded font-semibold transition-colors"
        >
          Void
        </button>
      </div>

      {/* Cashout toggle */}
      <button
        onClick={() => setShowCashout((v) => !v)}
        className="w-full text-xs text-yellow-500 hover:text-yellow-400 border border-yellow-700/40 hover:bg-yellow-900/20 py-1.5 rounded transition-colors font-semibold"
      >
        {showCashout ? "Cancelar" : "💰 Cashout"}
      </button>

      {showCashout && (
        <div className="space-y-1.5 pt-0.5">
          <label className="text-[10px] text-gray-500 block">
            Valor do cashout (R$) · potencial máx. {potentialReturn.toFixed(2)}
          </label>
          <div className="flex gap-1.5">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={cashoutValue}
              onChange={(e) => setCashoutValue(e.target.value)}
              className="flex-1 bg-gray-800 border border-yellow-700/40 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-yellow-500 placeholder-gray-600"
              autoFocus
            />
            <button
              onClick={handleCashout}
              disabled={!cashoutValue || isNaN(parsedCashout) || parsedCashout <= 0}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white px-3 rounded text-xs font-bold transition-colors"
            >
              OK
            </button>
          </div>
          {cashoutProfit !== null && !isNaN(cashoutProfit) && (
            <p className="text-[10px] text-gray-500">
              Resultado líquido:{" "}
              <span className={cashoutProfit >= 0 ? "text-green-400 font-mono" : "text-red-400 font-mono"}>
                {cashoutProfit >= 0 ? "+" : ""}R$ {cashoutProfit.toFixed(2)}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Cancel bet */}
      <button
        onClick={handleCancel}
        className="flex items-center justify-center gap-1 w-full text-[10px] text-gray-600 hover:text-red-400 hover:bg-red-900/10 border border-white/5 hover:border-red-700/30 py-1 rounded transition-colors"
      >
        <X size={9} /> Cancelar aposta
      </button>
    </div>
  );
}
