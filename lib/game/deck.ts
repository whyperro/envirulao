// lib/game/deck.ts
import { Card, GameState, OrganSlot, OrganType, TreatmentEffect } from "./types";

const organTypes: OrganType[] = ["heart", "brain", "bone", "stomach"];

let idCounter = 0;
const cid = () => `c_${idCounter++}`;

const createDeck = (): Card[] => {
  const deck: Card[] = [];

  // Órganos
  organTypes.forEach((organ) => {
    for (let i = 0; i < 5; i++) {
      deck.push({
        id: cid(),
        name: organ.toUpperCase(),
        kind: "organ",
        organType: organ,
        text: "Órgano sano. Consigue 4 diferentes para ganar.",
      });
    }
  });

  // Virus
  organTypes.forEach((organ) => {
    for (let i = 0; i < 4; i++) {
      deck.push({
        id: cid(),
        name: `Virus ${organ}`,
        kind: "virus",
        organType: organ,
        text: "Infecta un órgano del mismo tipo de otro jugador.",
      });
    }
  });

  // Virus comodín (si los tienes)
  deck.push({
    id: cid(),
    name: "Virus comodín",
    kind: "virus",
    organType: "wild",
    text: "Infecta cualquier órgano de otro jugador.",
  });

  // Medicinas
  organTypes.forEach((organ) => {
    for (let i = 0; i < 4; i++) {
      deck.push({
        id: cid(),
        name: `Vacuna ${organ}`,
        kind: "medicine",
        organType: organ,
        text:
          "Cura un virus de tu órgano de este tipo o añade una vacuna. Con 2 vacunas queda inmunizado.",
      });
    }
  });

  deck.push({
    id: cid(),
    name: "Vacuna comodín",
    kind: "medicine",
    organType: "wild",
    text:
      "Cura un virus o vacuna cualquiera de tus órganos.",
  });

  // Tratamientos
  const pushTreatment = (
    name: string,
    effect: TreatmentEffect,
    text: string,
    count: number
  ) => {
    for (let i = 0; i < count; i++) {
      deck.push({
        id: cid(),
        name,
        kind: "treatment",
        effect,
        text,
      });
    }
  };

  pushTreatment(
    "Ladrón de órganos",
    "stealOrgan",
    "Roba un órgano no inmunizado de otro jugador.",
    2
  );

  pushTreatment(
    "Guante de látex",
    "latexGlove",
    "Todos los demás jugadores descartan su mano.",
    2
  );

  pushTreatment(
    "Trasplante",
    "transplant",
    "Intercambia un órgano no inmunizado tuyo con uno de otro jugador.",
    2
  );

  pushTreatment(
    "Contagio",
    "contagion",
    "Pasa todos tus virus a los órganos sanos de otro jugador.",
    2
  );

  pushTreatment(
    "Error médico",
    "medicalError",
    "Intercambia todo tu cuerpo con el de otro jugador.",
    2
  );

  // Barajar
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};

export const createInitialGame = (playerNames: string[]): GameState => {
  let deck = createDeck();

  const players = playerNames.map((name, index) => {
    const hand = deck.slice(0, 3);
    deck = deck.slice(3);
    return {
      id: `p_${index}`,
      name,
      hand,
      organs: [] as OrganSlot[],
    };
  });

  return {
    players,
    currentPlayerId: players[0].id,
    deck,
    discardPile: [],
    phase: "playing",
    log: [`Partida creada con ${playerNames.join(", ")}`],
  };
};
