// lib/game/engine.ts
import {
  GameState,
  PlayerState,
  Card,
  OrganCard,
  VirusCard,
  MedicineCard,
  TreatmentCard,
  OrganSlot,
  OrganType,
} from "./types";
import { createInitialGame } from "./deck";


function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function recycleDeck(
  deck: Card[],
  discardPile: Card[]
): { deck: Card[]; discardPile: Card[] } {
  if (deck.length === 0 && discardPile.length > 0) {
    const newDeck = shuffle(discardPile);
    return { deck: newDeck, discardPile: [] };
  }
  return { deck, discardPile };
}

export type GameAction =
  | { type: "JOIN"; playerName: string }
  | { type: "START" }
  | {
      type: "PLAY_CARD";
      playerId: string;
      cardId: string;
      targetPlayerId?: string;
      targetOrganId?: string;
      sourceOrganId?: string;
    }
  | { type: "DISCARD_CARDS"; playerId: string; cardIds: string[] }
  | { type: "NEXT_TURN"; playerId: string }
  | { type: "RESET"; playerNames: string[] };


  function appendLog(state: GameState, message: string): string[] {
  return [...state.log, message];
}


export function createInitialState(playerNames: string[]): GameState {
  return createInitialGame(playerNames);
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "JOIN": {
      // Por ahora: añadimos jugador si no existe aún por nombre
      const exists = state.players.some(
        (p) => p.name.toLowerCase() === action.playerName.toLowerCase()
      );
      if (exists) return state;

      const newId = `p${state.players.length + 1}`;
      const newPlayer: PlayerState = {
        id: newId,
        name: action.playerName,
        hand: [],
        organs: [],
      };

      return {
        ...state,
        players: [...state.players, newPlayer],
      };
    }

    case "START": {
      // Si más adelante quieres “repartir” aquí, puedes rehacer el mazo
      return state;
    }

    case "PLAY_CARD": {
      return playCardEngine(
        state,
        action.playerId,
        action.cardId,
        action.targetPlayerId,
        action.targetOrganId,
        action.sourceOrganId,
      );
    }


    case "DISCARD_CARDS": {
      return discardCardsEngine(state, action.playerId, action.cardIds);
    }

    case "NEXT_TURN": {
      return nextTurnEngine(state, action.playerId);
    }

    case "RESET": {
      return createInitialGame(action.playerNames);
    }

    default:
      return state;
  }
}

/* ---------- Implementación de reglas puras ---------- */

function hasOrganType(organs: OrganSlot[], type: OrganType): boolean {
  return organs.some((slot) => slot.organ.organType === type);
}

function playCardEngine(
  state: GameState,
  playerId: string,
  cardId: string,
  targetPlayerId?: string,
  targetOrganId?: string,
  sourceOrganId?: string,
): GameState {
  if (state.phase !== "playing") return state;
  if (state.currentPlayerId !== playerId) return state;

  const currentIndex = state.players.findIndex(
    (p) => p.id === state.currentPlayerId
  );
  if (currentIndex === -1) return state;

    const players = [...state.players];
    let { deck, discardPile } = recycleDeck(
      [...state.deck],
      [...state.discardPile]
    );


  const currentPlayer: PlayerState = {
    ...players[currentIndex],
    hand: [...players[currentIndex].hand],
    organs: [...players[currentIndex].organs],
  };

  const hand = [...currentPlayer.hand];
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return state;

  const [card] = hand.splice(cardIndex, 1);

  const findOrganSlotIndex = (
    organs: OrganSlot[],
    organType?: OrganType
  ): number => {
    if (!organType) return -1;
    return organs.findIndex((slot) => slot.organ.organType === organType);
  };

  const resolveTargetIndex = (): number => {
    if (targetPlayerId) {
      const idx = players.findIndex((p) => p.id === targetPlayerId);
      if (idx !== -1) return idx;
    }
    const otherIndex = players.findIndex((_, idx) => idx !== currentIndex);
    if (otherIndex !== -1) return otherIndex;
    return currentIndex;
  };

  // ---------- ÓRGANOS ----------
  if (card.kind === "organ") {
    const organCard = card as OrganCard;

    const existingIndex = currentPlayer.organs.findIndex(
      (slot) => slot.organ.organType === organCard.organType
    );

    if (existingIndex !== -1) {
      discardPile.push(organCard);
    } else {
      const newSlot: OrganSlot = {
        organ: organCard,
        viruses: [],
        medicines: [],
      };
      currentPlayer.organs = [...currentPlayer.organs, newSlot];
    }
  }

  // ---------- VIRUS ----------
  else if (card.kind === "virus") {
    const virusCard = card as VirusCard;
    const targetIndex = resolveTargetIndex();
    const targetPlayer: PlayerState = {
      ...players[targetIndex],
      organs: [...players[targetIndex].organs],
    };

    const targetOrganType =
      virusCard.organType === "wild" ? undefined : virusCard.organType;

    let slotIndex = -1;
    if (targetOrganType) {
      slotIndex = findOrganSlotIndex(targetPlayer.organs, targetOrganType);
    } else {
      slotIndex = targetPlayer.organs.length > 0 ? 0 : -1;
    }

    if (slotIndex === -1) {
      discardPile.push(virusCard);
    } else {
      const slot = {
        ...targetPlayer.organs[slotIndex],
        viruses: [...targetPlayer.organs[slotIndex].viruses],
        medicines: [...targetPlayer.organs[slotIndex].medicines],
      };

      if (slot.medicines.length >= 2) {
        // inmunizado
        discardPile.push(virusCard);
      } else {
        slot.viruses.push(virusCard);

        if (slot.viruses.length >= 1 && slot.medicines.length >= 1) {
          const removedVirus = slot.viruses.pop();
          const removedMed = slot.medicines.pop();
          if (removedVirus) discardPile.push(removedVirus);
          if (removedMed) discardPile.push(removedMed);
          targetPlayer.organs[slotIndex] = slot;
        } else if (
          slot.viruses.length >= 2 &&
          slot.medicines.length === 0
        ) {
          discardPile.push(slot.organ, ...slot.viruses);
          targetPlayer.organs.splice(slotIndex, 1);
        } else {
          targetPlayer.organs[slotIndex] = slot;
        }
      }

      players[targetIndex] = targetPlayer;
    }
  }

  // ---------- MEDICINAS (solo sobre uno mismo) ----------
  else if (card.kind === "medicine") {
    const medicineCard = card as MedicineCard;

    const targetOrganType =
      medicineCard.organType === "wild" ? undefined : medicineCard.organType;

    let slotIndex = -1;
    if (targetOrganType) {
      slotIndex = findOrganSlotIndex(currentPlayer.organs, targetOrganType);
    } else {
      slotIndex = currentPlayer.organs.length > 0 ? 0 : -1;
    }

    // Sin órgano compatible → jugada inválida, no consumimos carta ni turno
    if (slotIndex === -1) {
      return state;
    }

    const slot = {
      ...currentPlayer.organs[slotIndex],
      viruses: [...currentPlayer.organs[slotIndex].viruses],
      medicines: [...currentPlayer.organs[slotIndex].medicines],
    };

    if (slot.viruses.length > 0) {
      const removedVirus = slot.viruses.pop();
      if (removedVirus) discardPile.push(removedVirus);
      discardPile.push(medicineCard);
      currentPlayer.organs[slotIndex] = slot;
    } else {
      slot.medicines.push(medicineCard);
      currentPlayer.organs[slotIndex] = slot;
    }
  }

  // ---------- TRATAMIENTOS ----------
  else if (card.kind === "treatment") {
    const treatment = card as TreatmentCard;
    const targetIndex = resolveTargetIndex();
    const isSoloGame = players.length === 1;

    switch (treatment.effect) {
      case "stealOrgan": {
        if (isSoloGame || targetIndex === currentIndex) {
          // No tiene sentido robarse a uno mismo o en solitario
          discardPile.push(treatment);
          break;
        }

        const targetPlayer: PlayerState = {
          ...players[targetIndex],
          organs: [...players[targetIndex].organs],
        };

        // Si tienes soporte para targetOrganId, úsalo.
        // Si no, se queda con el primer órgano no inmunizado, como antes.
        let stealIndex = -1;

        if (typeof targetOrganId === "string") {
          stealIndex = targetPlayer.organs.findIndex(
            (slot) => slot.organ.id === targetOrganId
          );
        } else {
          stealIndex = targetPlayer.organs.findIndex(
            (slot) => slot.medicines.length < 2
          );
        }

        if (stealIndex === -1) {
          // No hay órgano robable
          discardPile.push(treatment);
          players[targetIndex] = targetPlayer;
          break;
        }

        const candidate = targetPlayer.organs[stealIndex];

        // 1) No se pueden robar órganos inmunizados
        if (candidate.medicines.length >= 2) {
          discardPile.push(treatment);
          players[targetIndex] = targetPlayer;
          break;
        }

        // 2) Regla: no puedes terminar con dos órganos del mismo tipo
        const alreadyHasSameType = currentPlayer.organs.some(
          (slot) => slot.organ.organType === candidate.organ.organType
        );

        if (alreadyHasSameType) {
          // La jugada no es válida: se descarta la carta y ya
          discardPile.push(treatment);
          players[targetIndex] = targetPlayer;
          break;
        }

        // 3) Robar de verdad
        const [stolen] = targetPlayer.organs.splice(stealIndex, 1);
        currentPlayer.organs = [...currentPlayer.organs, stolen];

        players[targetIndex] = targetPlayer;
        discardPile.push(treatment);
        break;
      }


      case "latexGlove": {
        players.forEach((p, idx) => {
          if (idx === currentIndex) return;
          if (!p.hand.length) return;

          discardPile.push(...p.hand);
          players[idx] = { ...p, hand: [] };
        });
        discardPile.push(treatment);
        break;
      }

      case "transplant": {
        if (isSoloGame || targetIndex === currentIndex) {
          discardPile.push(treatment);
          break;
        }

        const targetPlayer: PlayerState = {
          ...players[targetIndex],
          organs: [...players[targetIndex].organs],
        };

        // 1) TU órgano (sourceOrganId si viene, si no, fallback a tu lógica anterior)
        let selfIndex = -1;

        if (sourceOrganId) {
          selfIndex = currentPlayer.organs.findIndex(
            (slot) => slot.organ.id === sourceOrganId
          );

          // No permitir trasplantar órganos inmunizados
          if (
            selfIndex !== -1 &&
            currentPlayer.organs[selfIndex].medicines.length >= 2
          ) {
            selfIndex = -1;
          }
        } else {
          // fallback: primer órgano no inmunizado, como tenías antes
          selfIndex = currentPlayer.organs.findIndex(
            (slot) => slot.medicines.length < 2
          );
        }

        // 2) Órgano del rival (targetOrganId si viene)
        let otherIndex = -1;

        if (targetOrganId) {
          otherIndex = targetPlayer.organs.findIndex(
            (slot) => slot.organ.id === targetOrganId
          );

          // tampoco permitir trasplantar órganos inmunizados
          if (
            otherIndex !== -1 &&
            targetPlayer.organs[otherIndex].medicines.length >= 2
          ) {
            otherIndex = -1;
          }
        } else {
          // fallback: primer órgano no inmunizado
          otherIndex = targetPlayer.organs.findIndex(
            (slot) => slot.medicines.length < 2
          );
        }

        if (selfIndex === -1 || otherIndex === -1) {
          // No hay combinación válida
          discardPile.push(treatment);
          players[targetIndex] = targetPlayer;
          break;
        }

        const selfSlot = currentPlayer.organs[selfIndex];
        const otherSlot = targetPlayer.organs[otherIndex];

        const selfType = selfSlot.organ.organType;
        const otherType = otherSlot.organ.organType;

        // 3) Comprobar que nadie acaba con órganos duplicados

        const makesDupForCurrent = currentPlayer.organs
          .filter((_, idx) => idx !== selfIndex) // quito el que intercambias
          .some((slot) => slot.organ.organType === otherType);

        const makesDupForTarget = targetPlayer.organs
          .filter((_, idx) => idx !== otherIndex)
          .some((slot) => slot.organ.organType === selfType);

        if (makesDupForCurrent || makesDupForTarget) {
          // violaría la regla de no repetidos
          discardPile.push(treatment);
          players[targetIndex] = targetPlayer;
          break;
        }

        // 4) Intercambio real
        currentPlayer.organs[selfIndex] = otherSlot;
        targetPlayer.organs[otherIndex] = selfSlot;

        players[targetIndex] = targetPlayer;
        discardPile.push(treatment);
        break;
      }

      case "contagion": {
        if (isSoloGame || targetIndex === currentIndex) {
          discardPile.push(treatment);
          break;
        }

        const targetPlayer: PlayerState = {
          ...players[targetIndex],
          organs: [...players[targetIndex].organs],
        };

        const virusesToMove: VirusCard[] = [];

        currentPlayer.organs = currentPlayer.organs.map((slot) => {
          if (!slot.viruses.length) return slot;

          const newSlot: OrganSlot = {
            ...slot,
            viruses: [...slot.viruses],
            medicines: [...slot.medicines],
          };

          while (newSlot.viruses.length) {
            const v = newSlot.viruses.pop() as VirusCard;
            virusesToMove.push(v);
          }

          return { ...newSlot, viruses: [] };
        });

        virusesToMove.forEach((virus) => {
          const targetOrganType =
            virus.organType === "wild" ? undefined : virus.organType;

          const idx = targetPlayer.organs.findIndex((slot) => {
            const sameOrgan =
              !targetOrganType ||
              slot.organ.organType === targetOrganType;
            const isFree =
              slot.viruses.length === 0 && slot.medicines.length === 0;
            return sameOrgan && isFree;
          });

          if (idx === -1) {
            discardPile.push(virus);
            return;
          }

          const slot = {
            ...targetPlayer.organs[idx],
            viruses: [...targetPlayer.organs[idx].viruses],
          };
          slot.viruses.push(virus);
          targetPlayer.organs[idx] = slot;
        });

        players[targetIndex] = targetPlayer;
        discardPile.push(treatment);
        break;
      }

      case "medicalError": {
        if (isSoloGame || targetIndex === currentIndex) {
          discardPile.push(treatment);
          break;
        }

        const targetPlayer: PlayerState = {
          ...players[targetIndex],
          organs: [...players[targetIndex].organs],
        };

        const tempOrgans = targetPlayer.organs;
        targetPlayer.organs = currentPlayer.organs;
        currentPlayer.organs = tempOrgans;

        players[targetIndex] = targetPlayer;
        discardPile.push(treatment);
        break;
      }

      default: {
        discardPile.push(treatment);
        break;
      }
    }
  }

  // Actualizar jugador actual
   players[currentIndex] = {
    ...currentPlayer,
    hand,
  };

  // Victoria: 4 órganos sanos (sin virus). Inmunizados cuentan como sanos.
  const healthyOrgans = currentPlayer.organs.filter(
    (slot) => slot.viruses.length === 0
  ).length;

  let winnerId = state.winnerId;
  if (healthyOrgans >= 4) {
    winnerId = currentPlayer.id;
  }

  if (winnerId) {
    return {
      ...state,
      players,
      discardPile,
      deck,
      winnerId,
      phase: "finished",
    };
  }

  // Fin de turno: rellenar mano del jugador actual hasta 3
  const updatedCurrent = { ...players[currentIndex] };
  if (deck.length === 0 && discardPile.length > 0) {
  const recycled = recycleDeck(deck, discardPile);
  deck = recycled.deck;
  discardPile = recycled.discardPile;
}
  while (updatedCurrent.hand.length < 3 && deck.length > 0) {
    const c = deck.shift()!;
    updatedCurrent.hand = [...updatedCurrent.hand, c];
  }
  players[currentIndex] = updatedCurrent;

  // Turno al siguiente
  const nextIndex = (currentIndex + 1) % players.length;
  const nextPlayer = { ...players[nextIndex] };
  while (nextPlayer.hand.length < 3 && deck.length > 0) {
    const c = deck.shift()!;
    nextPlayer.hand = [...nextPlayer.hand, c];
  }
  players[nextIndex] = nextPlayer;
  const logMessage = `${currentPlayer.name} juega ${card.name}`;
  const log = appendLog(state, logMessage);

  return {
    ...state,
    players,
    discardPile,
    deck,
    winnerId,
    phase: "playing",
    currentPlayerId: players[nextIndex].id,
    log
  };
}

function discardCardsEngine(
  state: GameState,
  playerId: string,
  cardIds: string[]
): GameState {
  if (state.phase !== "playing") return state;
  if (state.currentPlayerId !== playerId) return state;

  const currentIndex = state.players.findIndex(
    (p) => p.id === state.currentPlayerId
  );
  if (currentIndex === -1) return state;

  const players = [...state.players];
  let { deck, discardPile } = recycleDeck(
    [...state.deck],
    [...state.discardPile]
  );

  const player = { ...players[currentIndex] };
  const ids = new Set(cardIds);

  const remainingHand: Card[] = [];
  const toDiscard: Card[] = [];

  for (const c of player.hand) {
    if (ids.has(c.id)) {
      toDiscard.push(c);
    } else {
      remainingHand.push(c);
    }
  }

  if (!toDiscard.length) return state;

  player.hand = remainingHand;
  discardPile = [...discardPile, ...toDiscard];

  // Rellenar mano del jugador actual hasta 3
  if (deck.length === 0 && discardPile.length > 0) {
  const recycled = recycleDeck(deck, discardPile);
  deck = recycled.deck;
  discardPile = recycled.discardPile;
}
  while (player.hand.length < 3 && deck.length > 0) {
    const c = deck.shift()!;
    player.hand = [...player.hand, c];
  }
  players[currentIndex] = player;

  // Turno pasa al siguiente
  const nextIndex = (currentIndex + 1) % players.length;
  const nextPlayer = { ...players[nextIndex] };
  while (nextPlayer.hand.length < 3 && deck.length > 0) {
    const c = deck.shift()!;
    nextPlayer.hand = [...nextPlayer.hand, c];
  }
  players[nextIndex] = nextPlayer;

  const logMessage = `${player.name} descarta ${toDiscard.length} carta(s)`;
  const log = appendLog(state, logMessage);

return {
  ...state,
  players,
  deck,
  discardPile,
  currentPlayerId: players[nextIndex].id,
  log,
};

}

function nextTurnEngine(state: GameState, playerId: string): GameState {
  if (state.phase !== "playing") return state;
  if (state.currentPlayerId !== playerId) return state;

  const currentIndex = state.players.findIndex(
    (p) => p.id === state.currentPlayerId
  );
  if (currentIndex === -1) return state;

  const players = [...state.players];
  let { deck, discardPile } = recycleDeck(
    [...state.deck],
    [...state.discardPile]
  );

  // Rellenar mano del jugador actual hasta 3
  const current = { ...players[currentIndex] };
  if (deck.length === 0 && discardPile.length > 0) {
  const recycled = recycleDeck(deck, discardPile);
  deck = recycled.deck;
  discardPile = recycled.discardPile;
}
  while (current.hand.length < 3 && deck.length > 0) {
    const c = deck.shift()!;
    current.hand = [...current.hand, c];
  }
  players[currentIndex] = current;

  // Siguiente jugador
  const nextIndex = (currentIndex + 1) % players.length;
  const nextPlayer = { ...players[nextIndex] };
  while (nextPlayer.hand.length < 3 && deck.length > 0) {
    const c = deck.shift()!;
    nextPlayer.hand = [...nextPlayer.hand, c];
  }
  players[nextIndex] = nextPlayer;

  return {
    ...state,
    players,
    deck,
    currentPlayerId: players[nextIndex].id,
  };
}
