"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("partida-1");

  const handleJoin = () => {
    const trimmedName = name.trim() || "Jugador anónimo";
    const trimmedRoom = roomId.trim() || "partida-1";
    router.push(`/mesa/${encodeURIComponent(trimmedRoom)}?name=${encodeURIComponent(trimmedName)}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/90 px-5 py-6 shadow-xl">
        <h1 className="text-lg font-semibold mb-4">Unirse a una mesa</h1>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Tu nombre
            </label>
            <Input
              placeholder="Andrea"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 border-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              ID de mesa
            </label>
            <Input
              placeholder="partida-1"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="bg-slate-950 border-slate-800"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Todos los jugadores deben escribir el mismo ID para compartir mesa.
            </p>
          </div>
          <Button className="w-full mt-2" onClick={handleJoin}>
            Entrar a la mesa
          </Button>
        </div>
      </div>
    </main>
  );
}
