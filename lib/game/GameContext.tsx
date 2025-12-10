"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

import {
  GameState,
  PlayerState,
  Card,
  OrganCard,
  VirusCard,
  MedicineCard,
  OrganSlot,
  TreatmentCard,
  OrganType,
} from "./types";
import { createInitialGame } from "./deck";

interface GameContextValue {
  state: GameState;
  currentPlayer: PlayerState;
  playCard: (cardId: string, targetPlayerId?: string) => void;
  nextTurn: () => void;
  reset: () => void;
  discardCard: (cardId: string) => void;
  discardCards: (cardIds: string[]) => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
};

interface Props {
  children: React.ReactNode;
}

export const GameProvider: React.FC<Props> = ({ children }) => {
  const [state, setState] = useState<GameState>(() =>
    createInitialGame(["Jugador 1", "Jugador 2"])
  );

  const currentPlayer =
    state.players.find((p) => p.id === state.currentPlayerId) ||
    state.players[0];

  const playCard = (cardId: string, targetPlayerId?: string) => {
    setState((prev) => {
      if (prev.phase !== "playing") return prev;

      const currentIndex = prev.players.findIndex(
        (p) => p.id === prev.currentPlayerId
      );
      if (currentIndex === -1) return prev;

      const players = [...prev.players];
      const deck = [...prev.deck];
      const discardPile = [...prev.discardPile];

      const currentPlayer: PlayerState = {
        ...players[currentIndex],
        hand: [...players[currentIndex].hand],
        organs: [...players[currentIndex].organs],
      };

      const hand = [...currentPlayer.hand];
      const cardIndex = hand.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return prev;

      const [card] = hand.splice(cardIndex, 1);

      const findOrganSlotIndex = (
        organs: OrganSlot[],
        organType?: OrganType
      ): number => {
        if (!organType) return -1;
        return organs.findIndex(
          (slot) => slot.organ.organType === organType
        );
      };

      const resolveTargetIndex = (): number => {
        if (targetPlayerId) {
          const idx = players.findIndex((p) => p.id === targetPlayerId);
          if (idx !== -1) return idx;
        }
        const otherIndex = players.findIndex(
          (_, idx) => idx !== currentIndex
        );
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
          // Ya tiene ese órgano → carta al descarte
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
          virusCard.organType === "wild"
            ? undefined
            : virusCard.organType;

        let slotIndex = -1;
        if (targetOrganType) {
          slotIndex = findOrganSlotIndex(
            targetPlayer.organs,
            targetOrganType
          );
        } else {
          slotIndex =
            targetPlayer.organs.length > 0 ? 0 : -1;
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
          medicineCard.organType === "wild"
            ? undefined
            : medicineCard.organType;

        let slotIndex = -1;
        if (targetOrganType) {
          slotIndex = findOrganSlotIndex(
            currentPlayer.organs,
            targetOrganType
          );
        } else {
          slotIndex =
            currentPlayer.organs.length > 0 ? 0 : -1;
        }

        // Si no hay órgano compatible, jugada inválida: no consumimos carta ni turno
        if (slotIndex === -1) {
          return prev;
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
              discardPile.push(treatment);
              break;
            }

            const targetPlayer: PlayerState = {
              ...players[targetIndex],
              organs: [...players[targetIndex].organs],
            };

            const stealIndex = targetPlayer.organs.findIndex(
              (slot) => slot.medicines.length < 2
            );

            if (stealIndex === -1) {
              discardPile.push(treatment);
              break;
            }

            const [stolen] = targetPlayer.organs.splice(stealIndex, 1);
            currentPlayer.organs = [
              ...currentPlayer.organs,
              stolen,
            ];

            players[targetIndex] = targetPlayer;
            discardPile.push(treatment);
            break;
          }

          case "latexGlove": {
            // Todos menos el jugador actual descartan su mano
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

            const selfIndex = currentPlayer.organs.findIndex(
              (slot) => slot.medicines.length < 2
            );
            const otherIndex = targetPlayer.organs.findIndex(
              (slot) => slot.medicines.length < 2
            );

            if (selfIndex === -1 || otherIndex === -1) {
              discardPile.push(treatment);
              players[targetIndex] = targetPlayer;
              break;
            }

            const selfSlot = currentPlayer.organs[selfIndex];
            const otherSlot = targetPlayer.organs[otherIndex];

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
                virus.organType === "wild"
                  ? undefined
                  : virus.organType;

              const idx = targetPlayer.organs.findIndex((slot) => {
                const sameOrgan =
                  !targetOrganType ||
                  slot.organ.organType === targetOrganType;
                const isFree =
                  slot.viruses.length === 0 &&
                  slot.medicines.length === 0;
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

      // Actualizar jugador actual con su mano y órganos
      players[currentIndex] = {
        ...currentPlayer,
        hand,
      };

      // Condición de victoria
      let winnerId = prev.winnerId;
      if (currentPlayer.organs.length >= 4) {
        winnerId = currentPlayer.id;
      }

      if (winnerId) {
        return {
          ...prev,
          players,
          discardPile,
          deck,
          winnerId,
          phase: "finished",
        };
      }

      // 🔥 Fin de turno: rellenar mano del jugador actual hasta 3
      const updatedCurrent = { ...players[currentIndex] };
      while (updatedCurrent.hand.length < 3 && deck.length > 0) {
        const c = deck.shift()!;
        updatedCurrent.hand = [...updatedCurrent.hand, c];
      }
      players[currentIndex] = updatedCurrent;

      // Turno pasa al siguiente jugador
      const nextIndex = (currentIndex + 1) % players.length;

      // Rellenar mano del siguiente jugador hasta 3
      const nextPlayer = { ...players[nextIndex] };
      while (nextPlayer.hand.length < 3 && deck.length > 0) {
        const c = deck.shift()!;
        nextPlayer.hand = [...nextPlayer.hand, c];
      }
      players[nextIndex] = nextPlayer;

      return {
        ...prev,
        players,
        discardPile,
        deck,
        winnerId,
        phase: "playing",
        currentPlayerId: players[nextIndex].id,
      };
    });
  };

  const nextTurn = () => {
    // Pasar sin jugar carta: rellena mano actual y del siguiente, y pasa turno
    setState((prev) => {
      if (prev.phase !== "playing") return prev;

      const currentIndex = prev.players.findIndex(
        (p) => p.id === prev.currentPlayerId
      );
      if (currentIndex === -1) return prev;

      const players = [...prev.players];
      const deck = [...prev.deck];

      // Rellenar mano del jugador actual hasta 3
      const current = { ...players[currentIndex] };
      while (current.hand.length < 3 && deck.length > 0) {
        const c = deck.shift()!;
        current.hand = [...current.hand, c];
      }
      players[currentIndex] = current;

      // Siguiente jugador
      const nextIndex = (currentIndex + 1) % players.length;

      // Rellenar mano del siguiente hasta 3
      const nextPlayer = { ...players[nextIndex] };
      while (nextPlayer.hand.length < 3 && deck.length > 0) {
        const c = deck.shift()!;
        nextPlayer.hand = [...nextPlayer.hand, c];
      }
      players[nextIndex] = nextPlayer;

      return {
        ...prev,
        players,
        deck,
        currentPlayerId: players[nextIndex].id,
      };
    });
  };

  const reset = () => {
    setState(createInitialGame(["Jugador 1", "Jugador 2"]));
  };

  const discardCards = (cardIds: string[]) => {
    setState((prev) => {
      if (prev.phase !== "playing") return prev;

      const currentIndex = prev.players.findIndex(
        (p) => p.id === prev.currentPlayerId
      );
      if (currentIndex === -1) return prev;

      const players = [...prev.players];
      const deck = [...prev.deck];
      let discardPile = [...prev.discardPile];

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

      if (!toDiscard.length) return prev;

      player.hand = remainingHand;
      discardPile = [...discardPile, ...toDiscard];

      // Rellenar mano del jugador actual hasta 3
      while (player.hand.length < 3 && deck.length > 0) {
        const c = deck.shift()!;
        player.hand = [...player.hand, c];
      }
      players[currentIndex] = player;

      // Turno pasa al siguiente
      const nextIndex = (currentIndex + 1) % players.length;

      // Rellenar mano del siguiente hasta 3
      const nextPlayer = { ...players[nextIndex] };
      while (nextPlayer.hand.length < 3 && deck.length > 0) {
        const c = deck.shift()!;
        nextPlayer.hand = [...nextPlayer.hand, c];
      }
      players[nextIndex] = nextPlayer;

      return {
        ...prev,
        players,
        deck,
        discardPile,
        currentPlayerId: players[nextIndex].id,
      };
    });
  };

  const discardCard = (cardId: string) => {
    discardCards([cardId]);
  };

  const value: GameContextValue = useMemo(
    () => ({
      state,
      currentPlayer,
      playCard,
      nextTurn,
      reset,
      discardCard,
      discardCards,
    }),
    [state, currentPlayer]
  );

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
