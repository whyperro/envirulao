"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MultiplayerGameProvider } from "@/lib/game/MultiplayerGameContext";
import { GameBoard } from "@/components/game-board";

export default function MesaClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();

  const playerName = useMemo(() => {
    const fromQuery = searchParams.get("name");
    if (fromQuery && fromQuery.trim().length > 0) {
      return fromQuery.trim();
    }
    return `Jugador Invitado`;
  }, [searchParams]);

  const serverUrl =
    process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:4000";

  return (
    <MultiplayerGameProvider
      roomId={roomId}
      playerName={playerName}
      serverUrl={serverUrl}
    >
      <GameBoard />
    </MultiplayerGameProvider>
  );
}
