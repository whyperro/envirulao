"use client";

import { Card as GameCard } from "@/lib/game/types";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type CardZone = "hand" | "board" | "mini";

interface Props {
  card: GameCard;
  onClick?: () => void;
  disabled?: boolean;
  zone?: CardZone;
  selected?: boolean;
  playable?: boolean;
  size?: "default" | "large" | "xl";
}

const kindGradient: Record<GameCard["kind"], string> = {
  organ: "from-emerald-500 via-lime-500 to-emerald-700",
  virus: "from-rose-500 via-red-500 to-rose-700",
  medicine: "from-sky-500 via-cyan-400 to-sky-700",
  treatment: "from-violet-500 via-fuchsia-500 to-violet-700",
};

const zoneSize: Record<CardZone, Record<"default" | "large" | "xl", string>> = {
  hand: {
    default: "w-32 h-44 md:w-36 md:h-52",
    large: "w-40 h-56 md:w-44 md:h-60",
    xl: "w-48 h-64 md:w-52 md:h-72",
  },
  board: {
    default: "w-28 h-40 md:w-32 md:h-44",
    large: "w-36 h-52 md:w-40 md:h-56",
    xl: "w-44 h-60 md:w-48 md:h-66",
  },
  mini: {
    default: "w-20 h-28 md:w-24 md:h-32",
    large: "w-24 h-32 md:w-28 md:h-36",
    xl: "w-28 h-36 md:w-32 md:h-40",
  },
};

const zonePadding: Record<CardZone, Record<"default" | "large" | "xl", string>> = {
  hand: {
    default: "p-2.5",
    large: "p-3",
    xl: "p-4",
  },
  board: {
    default: "p-2",
    large: "p-2.5",
    xl: "p-3",
  },
  mini: {
    default: "p-1.5",
    large: "p-2",
    xl: "p-2.5",
  },
};

const textSize: Record<"default" | "large" | "xl", Record<string, string>> = {
  default: {
    header: "text-[9px]",
    organLabel: "text-[8px]",
    name: "text-xs",
    icon: "text-[11px]",
    description: "text-[9px]",
  },
  large: {
    header: "text-[10px]",
    organLabel: "text-[9px]",
    name: "text-sm",
    icon: "text-xs",
    description: "text-[10px]",
  },
  xl: {
    header: "text-xs",
    organLabel: "text-[10px]",
    name: "text-base",
    icon: "text-sm",
    description: "text-xs",
  },
};

export const CardView: React.FC<Props> = ({
  card,
  onClick,
  disabled,
  zone = "board",
  selected,
  playable,
  size = "default",
}) => {
  const interactive = !!onClick && !disabled;

  const organLabel =
    card.kind === "organ" ||
    card.kind === "virus" ||
    card.kind === "medicine"
      ? card.organType
      : undefined;

  return (
    <motion.button
      whileHover={
        interactive
          ? {
              y: zone === "hand" ? -16 : -6,
              scale: 1.08,
            }
          : {}
      }
      whileTap={interactive ? { scale: 0.96 } : {}}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      onClick={interactive ? onClick : undefined}
      disabled={disabled}
      className={cn(
        "focus:outline-none relative",
        interactive && "cursor-pointer"
      )}
    >
      {/* Glow de jugable */}
      {playable && (
        <motion.div
          layoutId={`glow-${card.id}`}
          className="absolute -inset-1 rounded-3xl bg-emerald-400/40 blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}

      {/* Borde de seleccionada */}
      {selected && (
        <div className="absolute -inset-[3px] rounded-3xl border-2 border-amber-300/90 shadow-[0_0_20px_rgba(252,211,77,0.8)] pointer-events-none" />
      )}

      <Card
        className={cn(
          "relative rounded-3xl border-2 border-white/20 shadow-xl shadow-black/50 overflow-hidden cursor-pointer",
          "bg-gradient-to-br text-white backdrop-blur-sm",
          kindGradient[card.kind],
          zoneSize[zone][size],
          zone === "hand" && "origin-bottom",
          disabled && "opacity-60"
        )}
      >
        {/* Textura mejorada */}
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_0%,white,transparent_50%),radial-gradient(circle_at_80%_100%,white,transparent_50%)]" />

        {/* Efecto de brillo interno */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/5 via-transparent to-transparent" />

        <div
          className={cn(
            "relative z-10 flex flex-col h-full",
            zonePadding[zone][size]
          )}
        >
          {/* Header */}
          <div className={cn(
            "flex items-start justify-between uppercase tracking-[0.18em] opacity-90 font-semibold",
            textSize[size].header
          )}>
            <span>{card.kind}</span>
            {organLabel && (
              <span className={cn(
                "px-2 py-0.5 rounded-full bg-black/30 border border-white/10",
                textSize[size].organLabel
              )}>
                {organLabel}
              </span>
            )}
          </div>

          {/* Nombre */}
          <div className={cn(
            "mt-2 md:mt-3 font-bold leading-tight",
            textSize[size].name
          )}>
            {card.name}
          </div>

          {/* Centro: icono más grande */}
          <div className="mt-4 md:mt-5 flex-1 flex items-center justify-center">
            <div className={cn(
              "rounded-full bg-black/30 border border-white/10 flex items-center justify-center font-bold",
              size === "default" ? "w-10 h-10" :
              size === "large" ? "w-12 h-12" :
              "w-14 h-14"
            )}>
              <span className={textSize[size].icon}>
                {card.kind === "organ"
                  ? "Ó"
                  : card.kind === "virus"
                  ? "V"
                  : card.kind === "medicine"
                  ? "M"
                  : "T"}
              </span>
            </div>
          </div>

          {/* Descripción con más espacio */}
          <div className={cn(
            "mt-3 md:mt-4 leading-snug text-white/95 line-clamp-4",
            textSize[size].description
          )}>
            {card.text}
          </div>

          {/* Indicador de tipo en la parte inferior */}
          <div className="mt-2 flex justify-center">
            <div className={cn(
              "px-2 py-0.5 rounded-full bg-black/20 text-center",
              textSize[size].organLabel
            )}>
              {card.kind === "organ" && "ÓRGANO"}
              {card.kind === "virus" && "VIRUS"}
              {card.kind === "medicine" && "MEDICINA"}
              {card.kind === "treatment" && "TRATAMIENTO"}
            </div>
          </div>
        </div>
      </Card>
    </motion.button>
  );
};
