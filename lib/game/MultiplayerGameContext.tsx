"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { GameState, PlayerState } from "./types";
import { GameAction } from "./engine";

type FxType = "virus" | "medicine" | "organLost" | null;

interface MultiplayerContextValue {
  state: GameState;
  currentPlayer: PlayerState | null;
  playCard: (
    cardId: string,
    targetPlayerId?: string,
    targetOrganId?: string,
    sourceOrganId?: string
  ) => void;
  discardCards: (cardIds: string[]) => void;
  nextTurn: () => void;
  reset: () => void;
  roomId: string;
  playerId: string | null;
  lastFx: FxType;
  leaveRoom: () => void;
  roomClosed: boolean;
  closeRoom: () => void;
}

const MultiplayerGameContext =
  createContext<MultiplayerContextValue | undefined>(undefined);

export const useMultiplayerGame = () => {
  const ctx = useContext(MultiplayerGameContext);
  if (!ctx) {
    throw new Error(
      "useMultiplayerGame must be used within MultiplayerGameProvider"
    );
  }
  return ctx;
};

interface Props {
  children: React.ReactNode;
  roomId: string;
  playerName: string;
  serverUrl: string;
}

export const MultiplayerGameProvider: React.FC<Props> = ({
  children,
  roomId,
  playerName,
  serverUrl,
}) => {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomClosed, setRoomClosed] = useState(false);

  // FX local para este cliente
  const [lastFx, setLastFx] = useState<FxType>(null);
  const prevStateRef = useRef<GameState | null>(null);
  const fxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Conexión al servidor y suscripción a estado
  useEffect(() => {
    const s = io(serverUrl);
    socketRef.current = s;
    s.on("connect", () => {
      // Unirse a la sala con nuestro nombre
      s.emit("joinRoom", roomId, playerName);
    });

    s.on("stateUpdate", (newState: GameState) => {
      // Detectar FX comparando estado anterior vs nuevo SOLO para este jugador
      const prev = prevStateRef.current;

      if (prev) {
        const mePrev = prev.players.find(
          (p) => p.name === playerName
        );
        const meNow = newState.players.find(
          (p) => p.name === playerName
        );

        if (mePrev && meNow) {
          const countViruses = (pl: PlayerState) =>
            pl.organs.reduce(
              (acc, slot) => acc + slot.viruses.length,
              0
            );
          const countMeds = (pl: PlayerState) =>
            pl.organs.reduce(
              (acc, slot) => acc + slot.medicines.length,
              0
            );

          const prevViruses = countViruses(mePrev);
          const nowViruses = countViruses(meNow);
          const prevMeds = countMeds(mePrev);
          const nowMeds = countMeds(meNow);
          const prevOrgans = mePrev.organs.length;
          const nowOrgans = meNow.organs.length;

          let fx: FxType = null;

          if (nowOrgans < prevOrgans) {
            fx = "organLost";
          } else if (nowViruses > prevViruses) {
            fx = "virus";
          } else if (
            nowMeds > prevMeds ||
            nowViruses < prevViruses
          ) {
            fx = "medicine";
          }

          if (fx) {
            setLastFx(fx);
            if (fxTimeoutRef.current) {
              clearTimeout(fxTimeoutRef.current);
            }
            fxTimeoutRef.current = setTimeout(
              () => setLastFx(null),
              900
            );
          }
        }
      }

      prevStateRef.current = newState;
      setState(newState);

      // Detectar nuestro playerId por nombre la primera vez
      setPlayerId((prev) => {
        if (prev) return prev;
        const me = newState.players.find(
          (p) => p.name === playerName
        );
        return me ? me.id : null;
      });
    });

    s.on("roomClosed", () => {
      setRoomClosed(true);
    });

    return () => {
      if (fxTimeoutRef.current) {
        clearTimeout(fxTimeoutRef.current);
      }
      prevStateRef.current = null;
      s.off("roomClosed");
      s.disconnect();
      socketRef.current = null;
    };
  }, [roomId, playerName, serverUrl]);

  const currentPlayer: PlayerState | null =
    state && state.currentPlayerId
      ? state.players.find((p) => p.id === state.currentPlayerId) ||
        null
      : null;

  const sendAction = (action: GameAction) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("action", roomId, action);
  };

  const leaveRoom = () => {
  const socket = socketRef.current;
  if (!socket) return;
  socket.emit("leaveRoom", roomId);
  socket.disconnect();
};

  const closeRoom = () => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("closeRoom", roomId);
    socket.disconnect();
  };

  const playCard = (
    cardId: string,
    targetPlayerId?: string,
    targetOrganId?: string,
    sourceOrganId?: string
  ) => {
    if (!playerId) return;
    const action: GameAction = {
      type: "PLAY_CARD",
      playerId,
      cardId,
      targetPlayerId,
      targetOrganId,
      sourceOrganId,
    };
    sendAction(action);
  };

  const discardCards = (cardIds: string[]) => {
    if (!playerId || cardIds.length === 0) return;
    const action: GameAction = {
      type: "DISCARD_CARDS",
      playerId,
      cardIds,
    };
    sendAction(action);
  };

  const nextTurn = () => {
    if (!playerId) return;
    const action: GameAction = {
      type: "NEXT_TURN",
      playerId,
    };
    sendAction(action);
  };

  const reset = () => {
    if (!state) return;
    const action: GameAction = {
      type: "RESET",
      playerNames: state.players.map((p) => p.name),
    };
    sendAction(action);
  };

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">
          Conectando a la mesa{" "}
          <span className="font-mono">{roomId}</span>...
        </p>
      </div>
    );
  }

  const value: MultiplayerContextValue = {
    state,
    currentPlayer,
    playCard,
    discardCards,
    nextTurn,
    reset,
    roomId,
    playerId,
    lastFx,
    leaveRoom,
    roomClosed,
    closeRoom,
  };

  return (
    <MultiplayerGameContext.Provider value={value}>
      {children}
    </MultiplayerGameContext.Provider>
  );
};
