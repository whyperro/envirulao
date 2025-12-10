import { useMultiplayerGame } from "@/lib/game/MultiplayerGameContext";
import {
  Card as GameCard,
  OrganType,
  MedicineCard,
  TreatmentCard,
} from "@/lib/game/types";
import { AnimatePresence, motion } from "framer-motion";
import { CardView } from "./card-view";
import { Button } from "./ui/button";

interface HandViewProps {
  selectedCardIds: string[];
  onToggleCard: (id: string) => void;
  onClearSelection: () => void;
}

const cardNeedsTarget = (card: GameCard): boolean => {
  if (card.kind === "virus") return true;
  if (card.kind === "treatment") {
    const treatment = card as TreatmentCard;
    return treatment.effect !== "latexGlove";
  }
  return false;
};

export const HandView: React.FC<HandViewProps> = ({
  selectedCardIds,
  onToggleCard,
  onClearSelection,
}) => {
  const {
    state,
    currentPlayer: turnPlayer,
    playerId,
    playCard,
    nextTurn,
    discardCards,
  } = useMultiplayerGame();

  // Jugador local ("yo")
  const me =
    playerId != null
      ? state.players.find((p) => p.id === playerId) || null
      : null;

  // Si aún no sabemos quién somos, mostramos un fallback
  if (!me || !turnPlayer) {
    return (
      <section className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800/80 p-6 h-full flex items-center justify-center">
        <div className="px-4 py-3 text-sm text-slate-400">
          Conectando a la mesa...
        </div>
      </section>
    );
  }

  const isMyTurn = turnPlayer.id === me.id;

  const hand = me.hand;
  const count = hand.length;

  // Aumentar el ángulo de dispersión para cartas más grandes
  const maxSpread = count > 5 ? 50 : 40; // Más dispersión para más cartas
  const baseRotation = count > 1 ? maxSpread / (count - 1) : 0;
  const startRotation = -maxSpread / 2;

  const selectedCount = selectedCardIds.length;

  // Carta "principal" para mostrar descripción
  const primarySelectedId =
    selectedCardIds.length > 0
      ? selectedCardIds[selectedCardIds.length - 1]
      : null;

  const primarySelected =
    primarySelectedId && hand.find((c) => c.id === primarySelectedId)
      ? hand.find((c) => c.id === primarySelectedId)!
      : null;

  const handleCardClick = (card: GameCard) => {
    if (!isMyTurn) return;

    // 0) Órganos: si ya tengo ese órgano en mesa, no se puede jugar,
    // se usan solo para descarte múltiple.
    if (card.kind === "organ") {
      const alreadyHasOrgan = me.organs.some(
        (slot) => slot.organ.organType === card.organType
      );

      if (alreadyHasOrgan) {
        onToggleCard(card.id);
        return;
      }

      // órgano válido → si hay cartas seleccionadas, estamos en modo descarte
      if (selectedCardIds.length > 0) {
        onToggleCard(card.id);
        return;
      }

      // órgano válido y sin selección → se juega directamente
      onClearSelection();
      playCard(card.id);
      return;
    }
    // 1) Medicinas: solo jugables si hay órgano compatible; si no, solo para descarte
    if (card.kind === "medicine") {
      const medicine = card as MedicineCard;
      const organType = medicine.organType as OrganType | "wild";

      const hasCompatibleOrgan =
        organType === "wild"
          ? me.organs.length > 0
          : me.organs.some((slot) => slot.organ.organType === organType);

      if (!hasCompatibleOrgan) {
        onToggleCard(card.id);
        return;
      }

      onClearSelection();
      playCard(card.id);
      return;
    }

    // 2) Virus / tratamientos que necesitan objetivo → solo selección
    if (cardNeedsTarget(card)) {
      onToggleCard(card.id);
      return;
    }
    if (card.kind === "treatment") {
      // Si ya hay selección, estamos en modo descarte
      if (selectedCardIds.length > 0) {
        onToggleCard(card.id);
        return;
      }

      // Sin selección previa → jugamos la carta.
      onClearSelection();
      playCard(card.id);
      return;
    }
    // 3) Si ya hay selección, estamos en modo descarte múltiple
    if (selectedCardIds.length > 0) {
      onToggleCard(card.id);
      return;
    }

    // 4) Carta simple y sin selección → se juega directamente
    onClearSelection();
    playCard(card.id);
  };

  const handleDiscardSelected = () => {
    if (!isMyTurn) return;
    if (!selectedCount) return;
    discardCards(selectedCardIds);
    onClearSelection();
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    nextTurn();
  };

  const handleDiscardAll = () => {
    if (!hand.length) return;
    const allIds = hand.map((c) => c.id);
    discardCards(allIds);
    onClearSelection();
  };

  // Calcular traslaciones horizontales para evitar superposición
  const cardWidth = 52; // Ancho aproximado en px para cartas XL
  const minSpacing = 16; // Espacio mínimo entre cartas
  const totalWidth = (cardWidth * count) + (minSpacing * Math.max(0, count - 1));
  const containerWidth = 800; // Ancho aproximado del contenedor

  return (
    <section className="h-full bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800/80 p-4 flex flex-col">
      {/* Header */}
      <div className="px-2 pt-1 pb-3 flex items-center justify-between gap-4 mb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-[0.18em]">
            Tu mano
          </h2>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {!isMyTurn
              ? `Es el turno de ${turnPlayer.name}. Espera a que juegue.`
              : selectedCount > 0
              ? "Puedes descartar varias cartas seleccionadas."
              : "Haz clic en una carta para jugarla. O selecciona varias para descartarlas."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Botón de descartar TODAS */}
          {hand.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiscardAll}
              className="text-xs h-8 px-3 bg-white text-black"
            >
              Descartar Todas
            </Button>
          )}
          {selectedCount > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDiscardSelected}
              disabled={!isMyTurn}
              className="text-xs h-8 px-3"
            >
              Descartar ({selectedCount})
            </Button>
          )}
          <Button
            size="sm"
            onClick={handlePass}
            disabled={!isMyTurn}
            variant={isMyTurn ? "default" : "outline"}
            className="text-xs h-8 px-4 bg-black text-white"
          >
            {isMyTurn ? "Pasar turno" : "Espera"}
          </Button>
        </div>
      </div>

      {/* Panel de detalle de la carta seleccionada */}
      <AnimatePresence>
        {primarySelected && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-3 px-4 py-3 rounded-xl border border-slate-700 bg-slate-900/95 text-sm shadow-lg "
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-100 text-base">
                {primarySelected.name}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400 bg-slate-800/50 px-2 py-1 rounded-full">
                {primarySelected.kind}
              </span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {primarySelected.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenedor principal de cartas - MUCHO más alto para cartas grandes */}
      <div className="flex min-h-0 relative flex-col justify-end">
        {/* Mano en abanico - ALTURA AUMENTADA para cartas grandes */}
        <div className="relative h-72 md:h-80 flex items-end justify-center overflow-x-auto px-4 pb-6">
          <AnimatePresence initial={false}>
            {hand.map((card, index) => {
              const isSelected = selectedCardIds.includes(card.id);

              const rotation = isSelected
                ? 0
                : startRotation + baseRotation * index;

              // Elevación más pronunciada para cartas seleccionadas
              const translateY = isSelected ? -30 : Math.abs(rotation) * 0.4;

              // Desplazamiento horizontal para evitar superposición
              const translateX = totalWidth > containerWidth
                ? (index - (count - 1) / 2) * (cardWidth + minSpacing)
                : 0;

              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: 60, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: isSelected ? 1.15 : 1,
                    rotate: rotation,
                    translateY,
                    translateX: translateX,
                  }}
                  exit={{ opacity: 0, y: 60, scale: 0.8 }}
                  transition={{
                    type: "spring",
                    stiffness: 280,
                    damping: 18,
                    delay: index * 0.03
                  }}
                  style={{
                    transformOrigin: "bottom center",
                    zIndex: isSelected ? 100 : index,
                    opacity: isMyTurn ? 1 : 0.6,
                  }}
                  className="bottom-0"
                  whileHover={{
                    scale: isMyTurn ? (isSelected ? 1.18 : 1.08) : 1,
                    translateY: isMyTurn ? (isSelected ? -35 : -15) : 0,
                    rotate: isSelected ? 0 : rotation * 0.8, // Reduce rotación en hover
                    zIndex: 150
                  }}
                >
                  <div
                    className={`transition-all duration-300 ${
                      isSelected
                        ? 'shadow-2xl shadow-blue-500/30 drop-shadow-2xl'
                        : 'shadow-lg shadow-black/40'
                    }`}
                  >
                    <CardView
                      card={card}
                      zone="hand"
                      size="large" // Cartas tamaño extra grande
                      onClick={() => handleCardClick(card)}
                      playable={isMyTurn}
                      selected={isSelected}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {hand.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full w-full">
              <div className="w-24 h-32 rounded-3xl border-2 border-dashed border-slate-700 flex items-center justify-center mb-4">
                <span className="text-slate-600 text-xs">Vacía</span>
              </div>
              <p className="text-sm text-slate-500 mb-2">
                No tienes cartas en la mano
              </p>
              <p className="text-xs text-slate-600">
                {isMyTurn
                  ? "Pasa turno para robar nuevas cartas"
                  : "Cuando sea tu turno, robarás automáticamente"}
              </p>
            </div>
          )}
        </div>

        {/* Información de estado en la parte inferior */}
        <div className="px-4 py-3 border-t border-slate-800/50 bg-slate-900/60 rounded-b-2xl">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                Cartas: <span className="font-bold text-slate-200 text-sm">{hand.length}</span>
              </span>
              <span className="text-slate-400">
                Seleccionadas: <span className={`font-bold ${selectedCount > 0 ? 'text-amber-400 text-sm' : 'text-slate-500'}`}>
                  {selectedCount}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full ${isMyTurn ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                <span className="font-semibold text-xs">
                  {isMyTurn ? 'TU TURNO' : `${turnPlayer.name}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
