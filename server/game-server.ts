// server/game-server.ts
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { GameState } from "../lib/game/types";
import { applyAction, GameAction } from "../lib/game/engine";
import { createInitialGame } from "../lib/game/deck";

type RoomId = string;

interface Room {
  id: RoomId;
  state: GameState;
}

const PORT = Number(process.env.GAME_SERVER_PORT || 4000);

// Mapa de salas en memoria
const rooms = new Map<RoomId, Room>();

function getRoom(roomId: RoomId): Room | undefined {
  return rooms.get(roomId);
}

function createRoomWithFirstPlayer(roomId: RoomId, playerName: string): Room {
  // Usamos directamente tu lógica de creación de partida:
  // reparte mazo, manos iniciales, etc, para el primer jugador
  const state = createInitialGame([playerName]);
  const room: Room = { id: roomId, state };
  rooms.set(roomId, room);
  console.log(
    `[room] creada sala "${roomId}" con jugador inicial "${playerName}"`
  );
  return room;
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // en dev/LAN está bien, luego puedes restringir
  },
});

io.on("connection", (socket: Socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  // Unirse a una sala
  socket.on(
    "joinRoom",
    (roomIdRaw: RoomId | null, playerName: string) => {
      // Si front manda null/undefined, usamos sala por defecto
      const roomId: RoomId = roomIdRaw || "default-room";

      console.log(
        `[joinRoom] socket=${socket.id} room=${roomId} name=${playerName}`
      );

      let room = getRoom(roomId);

      if (!room) {
        // Primer jugador de la sala → creamos partida con él
        room = createRoomWithFirstPlayer(roomId, playerName);
      } else {
        // Sala ya existe → añadimos jugador vía engine
        const joinAction: GameAction = {
          type: "JOIN",
          playerName,
        };
        room.state = applyAction(room.state, joinAction);
      }

      socket.join(roomId);

      // Enviar estado actualizado a todos en la sala
      io.to(roomId).emit("stateUpdate", room.state);
    }
  );

  // Acciones de juego
  socket.on("action", (roomIdRaw: RoomId | null, action: GameAction) => {
    const roomId: RoomId = roomIdRaw || "default-room";
    const room = getRoom(roomId);

    if (!room) {
      console.warn(
        `[action] Sala ${roomId} no existe aún. Ignorando acción ${action.type}.`
      );
      return;
    }

    console.log(
      `[action] room=${roomId} type=${action.type}`
    );

    room.state = applyAction(room.state, action);
    io.to(roomId).emit("stateUpdate", room.state);
  });

  socket.on("disconnect", () => {
    console.log(`[socket] desconectado: ${socket.id}`);
    // Aquí podrías hacer limpieza de jugadores/salas si quisieras
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `[server] Game server escuchando en http://localhost:${PORT}`
  );
});
