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

// En Render te dan PORT, en local puedes usar GAME_SERVER_PORT o 4000
const PORT = Number(process.env.PORT || process.env.GAME_SERVER_PORT || 4000);

// Mapa de salas en memoria
const rooms = new Map<RoomId, Room>();

function getRoom(roomId: RoomId): Room | undefined {
  return rooms.get(roomId);
}

function createRoomWithFirstPlayer(roomId: RoomId, playerName: string): Room {
  const state = createInitialGame([playerName]);
  const room: Room = { id: roomId, state };
  rooms.set(roomId, room);
  console.log(
    `[room] creada sala "${roomId}" con jugador inicial "${playerName}"`
  );
  return room;
}

const httpServer = createServer();

const allowedOrigins =
  process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ??
  ["http://localhost:3000"];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  // Unirse a una sala
  socket.on(
    "joinRoom",
    (roomIdRaw: RoomId | null, playerName: string) => {
      const roomId: RoomId = roomIdRaw || "default-room";

      console.log(
        `[joinRoom] socket=${socket.id} room=${roomId} name=${playerName}`
      );

      let room = getRoom(roomId);

      if (!room) {
        room = createRoomWithFirstPlayer(roomId, playerName);
      } else {
        const joinAction: GameAction = {
          type: "JOIN",
          playerName,
        };
        room.state = applyAction(room.state, joinAction);
      }

      socket.join(roomId);
      io.to(roomId).emit("stateUpdate", room.state);
    }
  );

  // Acciones de juego
  socket.on(
    "action",
    (roomIdRaw: RoomId | null, action: GameAction) => {
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
    }
  );

  socket.on("disconnect", () => {
    console.log(`[socket] desconectado: ${socket.id}`);
    // Aquí podrías limpiar salas/jugadores si lo necesitas
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `[server] Game server escuchando en puerto ${PORT}`
  );
});
