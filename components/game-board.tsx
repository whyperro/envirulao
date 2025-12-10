// components/game/game-board.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useMultiplayerGame } from "@/lib/game/MultiplayerGameContext";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import React, { useRef, useState } from "react";
import { HandView } from "./hand-view";
import { PlayerPanel } from "./player-panel";
import { TreatmentCard } from "@/lib/game/types";

/* ────────────────────────────────────────────────────────────── */
/*  Chips de jugadores en la parte superior                      */
/* ────────────────────────────────────────────────────────────── */

const PlayerChip: React.FC<{
  id: string;
  name: string;
  isCurrent: boolean;
  isMe: boolean;
  organs: number;
  hand: number;
  index: number;
}> = ({ id, name, isCurrent, isMe, organs, hand, index }) => {
  const colors = [
    "from-emerald-500 to-emerald-700",
    "from-sky-500 to-sky-700",
    "from-amber-500 to-amber-700",
    "from-fuchsia-500 to-fuchsia-700",
    "from-cyan-500 to-cyan-700",
  ];
  const gradient = colors[index % colors.length];

  return (
    <div
      className={cn(
        "relative px-3 py-1.5 rounded-2xl border border-slate-700/80",
        "bg-slate-900/80 backdrop-blur-sm flex items-center gap-2",
        isCurrent && "ring-2 ring-emerald-400/80"
      )}
      key={id}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-semibold text-white shadow mt-2",
          gradient
        )}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-100 truncate max-w-[7rem]">
          {name}
        </span>
        <span className="text-[10px] text-slate-400">
          Órg: {organs} · Mano: {hand}
        </span>
      </div>
      <div className="flex items-center gap-1 ml-1">
        {isMe && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/60">
            Tú
          </span>
        )}
        {isCurrent && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/60">
            Turno
          </span>
        )}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────── */
/*  GameBoard principal                                          */
/* ────────────────────────────────────────────────────────────── */

type FxType = "virus" | "medicine" | "organLost" | null;
export const GameBoard: React.FC = () => {
  const { state, currentPlayer, reset, playCard, roomId, playerId, lastFx } =
    useMultiplayerGame();
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
    const [selectedSourceOrganId, setSelectedSourceOrganId] = useState<string | null>(null);

  // Jugador local ("yo")
  const me =
    playerId != null
      ? state.players.find((p) => p.id === playerId) || null
      : null;

  if (!me || !currentPlayer) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">
          Conectando a la mesa...
        </p>
      </div>
    );
  }


  const opponents = state.players.filter((p) => p.id !== me.id);
  const playerCount = state.players.length;

  // Multi-selección de cartas en mano

  const clearSelection = () => {
    setSelectedCardIds([]);
    setSelectedSourceOrganId(null);
  };

  const toggleSelection = (id: string) => {
      setSelectedCardIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    };
  // Carta activa (para elegir objetivo): primera seleccionada
  const activeCardId = selectedCardIds[0] ?? null;

  const handleSelectTarget = (targetPlayerId: string) => {
    if (!activeCardId) return;
    const activePlayer = state.players.find(
      (p) => p.id === state.currentPlayerId,
    );
    const selectedCard = activePlayer?.hand.find(
      (c) => c.id === activeCardId,
    );

    if (!selectedCard) {
      clearSelection();
      return;
    }

    // efectos de jugador (virus, tratamientos tipo latex, etc.)
    playCard(activeCardId, targetPlayerId);
    clearSelection();
  };

  const handleSelectOrganTarget = (
    targetPlayerId: string,
    targetOrganId: string,
  ) => {
    if (!activeCardId) return;

    const activePlayer = state.players.find(
      (p) => p.id === state.currentPlayerId,
    );
    const selectedCard = activePlayer?.hand.find(
      (c) => c.id === activeCardId,
    );

    if (!selectedCard) {
      clearSelection();
      return;
    }

    // Tratamiento de trasplante → flujo de 2 clics:
    // 1) clic en tu órgano → marca sourceOrganId
    // 2) clic en órgano rival → ejecuta el trasplante
    if (
      selectedCard.kind === "treatment" &&
      (selectedCard as TreatmentCard).effect === "transplant"
    ) {
      // "me" ya lo tienes calculado más arriba
      const meId = me.id;

      // Clic sobre tu propio órgano → eliges qué donas
      if (targetPlayerId === meId) {
        setSelectedSourceOrganId(targetOrganId);
        return;
      }

      // Clic sobre un órgano enemigo
      if (!selectedSourceOrganId) {
        // No has elegido aún qué órgano tuyo usar → ignoramos este clic
        return;
      }

      // Tenemos source (tu órgano) y target (órgano rival)
      playCard(activeCardId, targetPlayerId, targetOrganId, selectedSourceOrganId);
      clearSelection();
      return;
    }

    // Resto de cartas que apuntan a órgano (medicinas, stealOrgan, etc.)
    playCard(activeCardId, targetPlayerId, targetOrganId);
    clearSelection();
  };

  const lastEvents = [...(state.log ?? [])].slice(-14).reverse();

  return (
    <div className="flex flex-col bg-slate-950 text-slate-50 overflow-hidden h-screen">
      {/* Fondo sutil */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,#22c55e1a,transparent_55%),radial-gradient(circle_at_80%_100%,#0ea5e91a,transparent_55%)]" />

      {/* Header */}
      <header className="z-10 shrink-0 border-b border-slate-800/80 px-5 py-2.5 flex flex-col gap-2 backdrop-blur-xl bg-slate-950/85">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight">
              Virus! Online
            </h1>
            <p className="text-[11px] text-slate-400">
              Estás jugando como{" "}
              <span className="font-semibold text-slate-100">
                {me.name}
              </span>
              . Turno de{" "}
              <span className="font-semibold text-emerald-300">
                {currentPlayer.name}
              </span>
              .
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700/80">
              Mesa: <span className="font-mono">{roomId}</span>
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700/80">
              Jugadores: {playerCount}/5
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700/80">
              Mazo: {state.deck.length}
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700/80">
              Descarte: {state.discardPile.length}
            </span>
            <Button variant="outline" size="sm" onClick={reset} className="text-white bg-red-200` `1  ">
              Reiniciar
            </Button>
          </div>
        </div>

        {/* Cinta de jugadores */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {state.players.map((p, index) => (
            <PlayerChip
              key={p.id}
              id={p.id}
              name={p.name}
              isCurrent={p.id === state.currentPlayerId}
              isMe={p.id === me.id}
              organs={p.organs.length}
              hand={p.hand.length}
              index={index}
            />
          ))}
        </div>
      </header>

      {/* Zona central: tapete + panel lateral */}
      <main className="relative z-10 flex-1 grid lg:grid-cols-2 gap-3 px-4 pb-2 pt-2 overflow-hidden">
        {/* Tapete central */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-xl px-4 py-3 flex flex-col h-full overflow-hidden">
          {/* Rivales */}
          <div className="grid sm:grid-cols-2 gap-2 overflow-y-auto pr-1 p-4">
            {opponents.length > 0 ? (
              opponents.map((p) => (
                <PlayerPanel
                  key={p.id}
                  playerId={p.id}
                  activeCardId={activeCardId}
                  onSelectTarget={handleSelectTarget}
                  onSelectOrganTarget={handleSelectOrganTarget}
                  compact
                />
              ))
            ) : (
              <div className="flex items-center justify-center text-xs text-slate-500 col-span-full">
                Esperando a que se unan más jugadores a la mesa.
              </div>
            )}
          </div>

          {/* Tu mesa, siempre grande */}
          <div className="mt-3">
            <PlayerPanel
              playerId={me.id}
              activeCardId={activeCardId}
              onSelectTarget={handleSelectTarget}
              onSelectOrganTarget={handleSelectOrganTarget}
              compact={false}
            />
          </div>
        </section>

        {/* Panel lateral derecho */}
        <aside className="grid grid-cols-1 gap-4">
        {/* Primer bloque - Estado de mesa */}
        <div className="flex gap-4 h-full">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-xl p-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">
            Estado de mesa
          </h2>
          <ul className="text-[11px] text-slate-300 space-y-1">
            <li>
              <span className="text-slate-500">Turno actual: </span>
              <span className="font-semibold text-slate-100">
                {currentPlayer.name}
              </span>
            </li>
            <li>
              <span className="text-slate-500">Tu posición: </span>
              {state.players.findIndex((p) => p.id === me.id) + 1}º
            </li>
            <li>
              <span className="text-slate-500">Objetivo: </span>
              completa 4 órganos sanos antes que los demás.
            </li>
          </ul>
        </div>

        {/* Segundo bloque - Log de acciones (más compacto) */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-xl p-3 flex-1 min-h-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">
            Log de acciones
          </h2>
          {lastEvents.length === 0 ? (
            <p className="text-[16px] text-slate-500">
              Aún no hay jugadas registradas.
            </p>
          ) : (
            <ul className="text-[11px] text-slate-300 space-y-1 overflow-y-auto max-h-32 pr-1">
              {lastEvents.map((entry, idx) => (
                <li
                  key={idx}
                  className="border-b border-slate-800/70 pb-1 last:border-b-0"
                >
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>


              <div className="h-full overflow-auto">
                <HandView
                  selectedCardIds={selectedCardIds}
                  onToggleCard={toggleSelection}
                  onClearSelection={clearSelection}
                />
              </div>
          </aside>
      </main>

      {/* Mensaje de ganador */}
      {state.winnerId && (
        <div className="fixed inset-x-0 bottom-24 flex justify-center z-30 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-slate-950/95 border border-emerald-500/70 rounded-3xl px-5 py-3 text-sm shadow-xl shadow-emerald-500/20 pointer-events-auto"
          >
            <span className="font-semibold">
              {state.players.find((p) => p.id === state.winnerId)?.name}
            </span>{" "}
            ha completado su cuerpo y gana la partida.
          </motion.div>
        </div>
      )}

            {/* FX de feedback (virus / medicina / pérdida de órgano) */}
      <AnimatePresence>
        {lastFx && (
          <motion.div
            key={lastFx}
            initial={{ opacity: 0 }}
            animate={{ opacity: lastFx === "virus" ? 0.6 : 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "pointer-events-none fixed inset-0 z-40",
              lastFx === "virus" && "bg-red-800/70",
              lastFx === "medicine" && "bg-emerald-500/60",
              lastFx === "organLost" && "bg-slate-900/85"
            )}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 py-2 rounded-2xl bg-black/50 border border-white/20 text-white text-lg font-semibold tracking-wide shadow-xl shadow-black/50"
              >
                {lastFx === "virus" && "¡Infección!"}
                {lastFx === "medicine" && "Tratamiento aplicado"}
                {lastFx === "organLost" && "Has perdido un órgano"}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
