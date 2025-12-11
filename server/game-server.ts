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

// Render usa PORT, local puedes usar GAME_SERVER_PORT
const PORT = Number(process.env.PORT || process.env.GAME_SERVER_PORT || 4000);

// Mapa de salas en memoria
const rooms = new Map<RoomId, Room>();

function getRoom(roomId: RoomId): Room | undefined {
  return rooms.get(roomId);
}

function deleteRoomIfEmpty(io: Server, roomId: RoomId) {
  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (!socketsInRoom || socketsInRoom.size === 0) {
    rooms.delete(roomId);
    console.log(`[room] sala "${roomId}" eliminada (sin jugadores)`);
  }
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
        // Primer jugador de la sala
        room = createRoomWithFirstPlayer(roomId, playerName);
      } else {
        // Añadimos jugador vía engine
        const joinAction: GameAction = {
          type: "JOIN",
          playerName,
        };
        room.state = applyAction(room.state, joinAction);
      }

      socket.join(roomId);
      // Opcional: guardar en socket para facilitar logs/limpieza
      socket.data.roomId = roomId;
      socket.data.playerName = playerName;

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

      console.log(`[action] room=${roomId} type=${action.type}`);

      room.state = applyAction(room.state, action);
      io.to(roomId).emit("stateUpdate", room.state);
    }
  );

  // Salir voluntariamente de la sala
  socket.on("leaveRoom", (roomIdRaw: RoomId | null) => {
    const roomId: RoomId =
      roomIdRaw || (socket.data.roomId as RoomId) || "default-room";

    console.log(
      `[leaveRoom] socket=${socket.id} abandona room=${roomId}`
    );

    socket.leave(roomId);
    deleteRoomIfEmpty(io, roomId);
  });

  // Cerrar sala: echa a todos y limpia memoria
  socket.on("closeRoom", (roomIdRaw: RoomId | null) => {
    const roomId: RoomId =
      roomIdRaw || (socket.data.roomId as RoomId) || "default-room";

    if (!rooms.has(roomId)) {
      console.warn(`[closeRoom] sala ${roomId} no existe`);
      return;
    }

    console.log(
      `[closeRoom] sala "${roomId}" cerrada por socket=${socket.id}`
    );

    // Avisamos al front (por si quiere mostrar mensaje)
    io.to(roomId).emit("roomClosed");

    // Sacamos a todos los sockets de la sala y los desconectamos
    io.in(roomId).disconnectSockets(true);

    // Eliminamos sala del mapa
    rooms.delete(roomId);
  });

  socket.on("disconnect", () => {
    console.log(`[socket] desconectado: ${socket.id}`);
    const roomId = socket.data.roomId as RoomId | undefined;
    if (roomId) {
      deleteRoomIfEmpty(io, roomId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `[server] Game server escuchando en puerto ${PORT}`
  );
});
