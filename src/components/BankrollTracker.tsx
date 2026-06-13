"use client";

import { useState, useRef } from "react";
import { BetRecord, Transaction } from "@/lib/storage";
import {
  TrendingUp, TrendingDown, DollarSign, Target, Trophy,
  ChevronDown, ChevronUp, PlusCircle, Check, X, Download, Upload,
} from "lucide-react";

interface Props {
  bankroll: number;
  initialBankroll: number;
  bets: BetRecord[];
  transactions: Transaction[];
  onAdjust: (delta: number, description: string) => void;
  onImport: () => void;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `${mins}min atrás`;
  if (hrs < 24)   return `${hrs}h atrás`;
  return `${days}d atrás`;
}

const TX_COLORS: Record<string, string> = {
  win:        "text-green-400 bg-green-900/30 border-green-700/40",
  loss:       "text-red-400 bg-red-900/30 border-red-700/40",
  void:       "text-gray-400 bg-white/5 border-white/10",
  adjustment: "text-blue-400 bg-blue-900/20 border-blue-700/30",
  cashout:    "text-yellow-400 bg-yellow-900/20 border-yellow-700/30",
};

const TX_LABELS: Record<string, string> = {
  win: "Ganhou", loss: "Perdeu", void: "Void", adjustment: "Ajuste", cashout: "Cashout",
};

const STORAGE_KEYS = {
  bankroll: "wc2026_bankroll",
  bets: "wc2026_bets",
  transactions: "wc2026_transactions",
};

export default function BankrollTracker({
  bankroll, initialBankroll, bets, transactions, onAdjust, onImport,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  function exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      bankroll: localStorage.getItem(STORAGE_KEYS.bankroll),
      bets: localStorage.getItem(STORAGE_KEYS.bets),
      transactions: localStorage.getItem(STORAGE_KEYS.transactions),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `copa-bets-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.bankroll)      localStorage.setItem(STORAGE_KEYS.bankroll,     data.bankroll);
        if (data.bets)          localStorage.setItem(STORAGE_KEYS.bets,         data.bets);
        if (data.transactions)  localStorage.setItem(STORAGE_KEYS.transactions, data.transactions);
        onImport();
      } catch {
        alert("Arquivo inválido — importe um .json exportado pelo Copa Bets.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const settled = bets.filter((b) => b.result && b.result !== "void");
  const wins    = settled.filter((b) => b.result === "win");
  const pending = bets.filter((b) => !b.result);

  // Lucro real: para wins/cashouts usa b.profit; para losses usa -amount (garante consistência mesmo em registros antigos)
  const totalProfit = settled.reduce((sum, b) => {
    if (b.result === "loss") return sum - b.amount;
    return sum + (b.profit ?? 0);
  }, 0);
  const totalStaked = settled.reduce((sum, b) => sum + b.amount, 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  // O saldo atual já tem as apostas pendentes debitadas — devolve pro cálculo de % para não contar como perda
  const pendingStaked = pending.reduce((s, b) => s + b.amount, 0);
  const profitPct = ((bankroll + pendingStaked - initialBankroll) / initialBankroll) * 100;
  const isPositive = bankroll + pendingStaked >= initialBankroll;

  function handleAdjust() {
    const delta = parseFloat(adjustValue.replace(",", "."));
    if (isNaN(delta) || delta === 0) return;
    onAdjust(delta, adjustDesc.trim() || (delta > 0 ? "Depósito" : "Retirada"));
    setAdjustValue("");
    setAdjustDesc("");
    setShowAdjustForm(false);
  }

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 mb-6 space-y-4">
      {/* Cabeçalho + saldo */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bankroll</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white tabular-nums">
              R$ {bankroll.toFixed(2)}
            </span>
            <span className={`text-sm font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{profitPct.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPositive
            ? <TrendingUp size={18} className="text-green-400" />
            : <TrendingDown size={18} className="text-red-400" />
          }
          <button
            onClick={exportData}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors"
            title="Exportar dados">
            <Download size={12} />
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors"
            title="Importar dados">
            <Upload size={12} />
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <button
            onClick={() => { setShowAdjustForm((v) => !v); setShowHistory(false); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors"
            title="Ajustar saldo manualmente">
            <PlusCircle size={12} /> Ajustar
          </button>
        </div>
      </div>

      {/* Formulário de ajuste inline */}
      {showAdjustForm && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-400 font-semibold">Ajuste manual de saldo</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 mb-0.5 block">Valor (+ depósito / − retirada)</label>
              <input
                type="number"
                step="0.01"
                placeholder="ex: +50 ou -20"
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdjust()}
                className="w-full bg-gray-800 border border-white/10 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 mb-0.5 block">Descrição (opcional)</label>
              <input
                type="text"
                placeholder="ex: Depósito inicial"
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdjust()}
                className="w-full bg-gray-800 border border-white/10 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdjustForm(false)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-2 py-1">
              <X size={11} /> Cancelar
            </button>
            <button onClick={handleAdjust}
              className="flex items-center gap-1 text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded font-semibold">
              <Check size={11} /> Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy size={13} className="text-yellow-400" />
            <span className="text-xs text-gray-400">Vitórias</span>
          </div>
          <p className="text-xl font-bold text-green-400">{wins.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">de {settled.length} encerradas</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={13} className="text-blue-400" />
            <span className="text-xs text-gray-400">ROI</span>
          </div>
          <p className={`text-xl font-bold ${roi >= 0 ? "text-green-400" : "text-red-400"}`}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-0.5">sobre apostado</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={13} className="text-purple-400" />
            <span className="text-xs text-gray-400">Lucro/Prej.</span>
          </div>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalProfit >= 0 ? "+" : ""}R$ {totalProfit.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">total realizado</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-orange-400" />
            <span className="text-xs text-gray-400">Pendentes</span>
          </div>
          <p className="text-xl font-bold text-orange-400">{pending.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            R$ {pending.reduce((s, b) => s + b.amount, 0).toFixed(2)} em jogo
          </p>
        </div>
      </div>

      {/* Histórico de transações */}
      {transactions.length > 0 && (
        <div>
          <button
            onClick={() => { setShowHistory((v) => !v); setShowAdjustForm(false); }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full text-left">
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Histórico de transações ({transactions.length})
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1 max-h-72 overflow-y-auto pr-1">
              {transactions.slice(0, 50).map((tx) => (
                <div key={tx.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 border text-xs ${TX_COLORS[tx.type]}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold shrink-0">{TX_LABELS[tx.type]}</span>
                      <span className="text-gray-400 truncate">{tx.description}</span>
                    </div>
                    <p className="text-gray-600 mt-0.5">{relativeTime(tx.date)} · saldo: R$ {tx.balance.toFixed(2)}</p>
                  </div>
                  <span className={`font-mono font-bold shrink-0 ml-3 ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {tx.amount >= 0 ? "+" : ""}R$ {tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {transactions.length > 50 && (
                <p className="text-center text-[10px] text-gray-600 py-1">
                  Mostrando 50 de {transactions.length} transações
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
