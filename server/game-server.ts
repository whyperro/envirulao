// server/game-server.ts
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { GameState, PlayerState } from "../lib/game/types";
import { applyAction, GameAction } from "../lib/game/engine";
import { createInitialGame } from "../lib/game/deck";

type RoomId = string;

interface Room {
  id: RoomId;
  state: GameState;
}

// Info de qué jugador está asociado a cada socket
interface PlayerSocketInfo {
  roomId: RoomId;
  playerId: string;
}

const PORT = Number(process.env.GAME_SERVER_PORT || 4000);

// Mapa de salas en memoria
const rooms = new Map<RoomId, Room>();

// Mapa socket.id -> info de jugador
const socketPlayers = new Map<string, PlayerSocketInfo>();

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

/**
 * Elimina al jugador asociado a este socket de su sala,
 * emite el nuevo estado, y borra la sala si se queda vacía.
 */
function handlePlayerLeave(socket: Socket) {
  const info = socketPlayers.get(socket.id);
  if (!info) {
    return;
  }

  const { roomId, playerId } = info;
  const room = getRoom(roomId);

  socketPlayers.delete(socket.id);
  socket.leave(roomId);

  if (!room) {
    return;
  }

  const prevPlayers = room.state.players;
  const remainingPlayers = prevPlayers.filter((p) => p.id !== playerId);

  if (remainingPlayers.length === 0) {
    console.log(`[room] Sala "${roomId}" queda vacía, se elimina.`);
    rooms.delete(roomId);
    return;
  }

  // Si el que se fue era el jugador en turno, pasamos el turno al primero
  let currentPlayerId = room.state.currentPlayerId;
  if (currentPlayerId === playerId) {
    currentPlayerId = remainingPlayers[0].id;
  }

  room.state = {
    ...room.state,
    players: remainingPlayers,
    currentPlayerId,
  };

  console.log(
    `[room] Jugador ${playerId} salió de la sala "${roomId}". Jugadores restantes: ${remainingPlayers.length}`
  );

  // Mandar nuevo estado a los que siguen dentro
  io.to(roomId).emit("stateUpdate", room.state);
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket: Socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  // Unirse a una sala
  socket.on("joinRoom", (roomIdRaw: RoomId | null, playerName: string) => {
    const roomId: RoomId = roomIdRaw || "default-room";

    console.log(
      `[joinRoom] socket=${socket.id} room=${roomId} name=${playerName}`
    );

    let room = getRoom(roomId);

    if (!room) {
      // Primer jugador de la sala
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

    // Buscar el PlayerState que corresponde a este jugador por nombre
    const joinedPlayer: PlayerState | undefined = room.state.players.find(
      (p) => p.name === playerName
    );

    if (joinedPlayer) {
      socketPlayers.set(socket.id, {
        roomId,
        playerId: joinedPlayer.id,
      });
      console.log(
        `[joinRoom] socket=${socket.id} asociado a playerId=${joinedPlayer.id} en sala "${roomId}"`
      );
    } else {
      console.warn(
        `[joinRoom] No se encontró PlayerState para name="${playerName}" en sala "${roomId}"`
      );
    }

    // Enviar estado actualizado a todos en la sala
    io.to(roomId).emit("stateUpdate", room.state);
  });

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

    console.log(`[action] room=${roomId} type=${action.type}`);

    room.state = applyAction(room.state, action);
    io.to(roomId).emit("stateUpdate", room.state);
  });

  /**
   * Salir voluntariamente de la mesa (botón "Salir")
   */
  socket.on("leaveRoom", () => {
    console.log(`[leaveRoom] socket=${socket.id}`);
    handlePlayerLeave(socket);
    // El cliente ya hace socket.disconnect(), pero si no lo hiciera:
    // socket.disconnect();
  });

  /**
   * Cerrar la mesa completamente (botón "Cerrar mesa")
   * Emite "roomClosed" a todos y elimina la sala.
   */
  socket.on("closeRoom", () => {
    const info = socketPlayers.get(socket.id);
    if (!info) {
      console.warn(
        `[closeRoom] socket=${socket.id} no tiene info de sala/jugador`
      );
      return;
    }

    const { roomId } = info;
    const room = getRoom(roomId);

    if (!room) {
      console.warn(
        `[closeRoom] Sala ${roomId} no existe. Ignorando cierre.`
      );
      return;
    }

    console.log(`[closeRoom] Sala "${roomId}" cerrada por socket=${socket.id}`);

    // Avisar a todos los clientes de esa sala
    io.to(roomId).emit("roomClosed");

    // Limpiar mapping de todos los sockets de esa sala
    const clients = io.sockets.adapter.rooms.get(roomId);
    if (clients) {
      for (const clientId of clients) {
        socketPlayers.delete(clientId);
        const clientSocket = io.sockets.sockets.get(clientId);
        clientSocket?.leave(roomId);
      }
    }

    rooms.delete(roomId);
  });

  // Desconexión (cerrar pestaña, refrescar, etc.)
  socket.on("disconnect", () => {
    console.log(`[socket] desconectado: ${socket.id}`);
    // Lo tratamos como un "leaveRoom" implícito
    handlePlayerLeave(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `[server] Game server escuchando en http://localhost:${PORT}`
  );
});
