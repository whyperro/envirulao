import { useMultiplayerGame } from "@/lib/game/MultiplayerGameContext";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { CardView } from "./card-view";
import { TreatmentCard } from "@/lib/game/types";

interface PlayerPanelProps {
  playerId: string;
  activeCardId: string | null;
  onSelectTarget: (playerId: string) => void;
  onSelectOrganTarget: (playerId: string, organId: string) => void;
  compact?: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  playerId,
  activeCardId,
  onSelectTarget,
  onSelectOrganTarget,
  compact,
}) => {
  const { state, playerId: myId } = useMultiplayerGame();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const isCurrent = state.currentPlayerId === player.id;
  const isMe = player.id === myId;

  // Carta activa del jugador en turno
  const activePlayer = state.players.find(
    (p) => p.id === state.currentPlayerId
  );
  const selectedCard =
    activeCardId && activePlayer
      ? activePlayer.hand.find((c) => c.id === activeCardId)
      : undefined;

  /** ───────────────────────────────
   *  Tipo de targeting de la carta
   *  ─────────────────────────────── */
  const isMedicine = selectedCard?.kind === "medicine";

  const isOrganSteal =
    selectedCard?.kind === "treatment" &&
    (selectedCard as TreatmentCard).effect === "stealOrgan";

  const isOrganSwap =
    selectedCard?.kind === "treatment" &&
    (selectedCard as TreatmentCard).effect === "transplant";

  // Órganos propios clicables: medicinas y transplant
  const canClickMyOrgans = (isMedicine || isOrganSwap) && isMe;

  // Órganos enemigos clicables: stealOrgan y transplant
  const canClickOpponentOrgans =
    (isOrganSteal || isOrganSwap) && !isMe;

  const organTargeting = canClickMyOrgans || canClickOpponentOrgans;


  /** ───────────────────────────────
   *  Target de JUGADOR (virus, etc.)
   *  ─────────────────────────────── */
  let canBeTarget = false;

  if (selectedCard) {
    if (selectedCard.kind === "virus") {
      canBeTarget = !isMe; // nunca tú mismo
    } else if (selectedCard.kind === "treatment") {
      const t = selectedCard as TreatmentCard;

      if (t.effect !== "latexGlove") {
        // latexGlove no necesita elegir jugador
        if (!organTargeting) {
          canBeTarget = !isMe;
        }
      }
    }
  }

  const handleClickPlayer = () => {
    if (!canBeTarget) return;
    onSelectTarget(player.id);
  };

  return (
    <motion.div
      layout
      // Si estamos apuntando a órganos, NO queremos click en el panel completo
      onClick={organTargeting ? undefined : handleClickPlayer}
      className={cn(
        "relative rounded-3xl border border-slate-700/80 bg-slate-900/70",
        "px-12 py-3 flex flex-col gap-2 shadow-lg shadow-black/30",
        (canBeTarget || organTargeting) ?
          "cursor-pointer ring-2 ring-amber-400/70 ring-offset-2 ring-offset-slate-950" : isCurrent && ("shadow-[0_0_20px_#00ffff,0_0_40px_#00ffff,inset_0_0_20px_#00ffff] animate-[neonPulse_2s_ease-in-out_infinite]")
      )}
    >
      {/* Etiqueta de turno */}
      {isCurrent && !compact && (
        <motion.div
          layoutId="turn-indicator"
          className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-emerald-500 text-[10px] font-semibold text-slate-900 shadow"
        >
          Turno
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">
            {player.name}
          </p>

          {!isMe && canBeTarget && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/60">
              Objetivo
            </span>
          )}

          {isMe && isMedicine && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-400/20 text-sky-300 border border-sky-300/60">
              Selecciona un órgano
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 whitespace-nowrap">
          Órganos: {player.organs.length} · Mano: {player.hand.length}
        </p>
      </div>

      {/* ORGANOS */}
      <div
        className={cn(
          "mt-1 flex flex-wrap gap-2",
          compact && "min-h-[3.5rem]"
        )}
      >
        {player.organs.map((slot) => {
          const clickable = organTargeting;

          const handleOrganClick = () => {
            if (!clickable) return;
            // aquí mandamos jugador + órgano concreto
            onSelectOrganTarget(player.id, slot.organ.id);
          };

          return (
            <motion.div
              key={slot.organ.id}
              layout
              className={cn(
                "relative",
                clickable &&
                  "cursor-pointer ring-2 ring-amber-400/70 rounded-xl"
              )}
              // importante: el click va al órgano cuando organTargeting es true
              onClick={clickable ? handleOrganClick : undefined}
            >
              <CardView
                card={slot.organ}
                zone={compact ? "mini" : "board"}
                disabled={!clickable}
              />

              {(slot.viruses.length > 0 ||
                slot.medicines.length > 0) && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 text-[9px]">
                  {slot.viruses.length > 0 && (
                    <span className="px-1 rounded-full bg-rose-600/85 text-white">
                      V{slot.viruses.length}
                    </span>
                  )}
                  {slot.medicines.length > 0 && (
                    <span className="px-1 rounded-full bg-sky-500/85 text-white">
                      M{slot.medicines.length}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {player.organs.length === 0 && (
          <p className="text-[11px] text-slate-500">
            Sin órganos en juego todavía.
          </p>
        )}
      </div>
    </motion.div>
  );
};
