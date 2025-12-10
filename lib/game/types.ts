export type OrganType = "heart" | "brain" | "bone" | "stomach";

export type CardKind = "organ" | "virus" | "medicine" | "treatment";

export interface CardBase {
  id: string;
  name: string;
  kind: CardKind;
  text: string; // 👈 descripción corta de la carta
}

export interface OrganCard extends CardBase {
  kind: "organ";
  organType: OrganType;
}

export interface VirusCard extends CardBase {
  kind: "virus";
  organType: OrganType | "wild";
}

export interface MedicineCard extends CardBase {
  kind: "medicine";
  organType: OrganType | "wild";
}

// 👇 nuevo tipo para dejar claros los tratamientos
export type TreatmentEffect =
  | "stealOrgan"    // Ladrón de órganos
  | "latexGlove"    // Guante de látex
  | "transplant"    // Trasplante
  | "contagion"     // Contagio
  | "medicalError"; // Error médico

export interface TreatmentCard extends CardBase {
  kind: "treatment";
  effect: TreatmentEffect;
}

export type Card = OrganCard | VirusCard | MedicineCard | TreatmentCard;

// Cada “slot” de órgano con su estado
export interface OrganSlot {
  organ: OrganCard;
  viruses: VirusCard[];
  medicines: MedicineCard[];
}

export interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  organs: OrganSlot[];
}

export interface GameState {
  players: PlayerState[];
  currentPlayerId: string;
  deck: Card[];
  discardPile: Card[];
  winnerId?: string;
  phase: "playing" | "finished";
  log: string[];
}
