import React from "react";
import { PixelPet, PetState } from "../pets/PixelPet";
import { PixelDog } from "../pets/PixelDog";
import { VectorPet } from "../pets/VectorPet";
import type { StyleTheme } from "./types";

export interface FocusPetDisplayProps {
  theme: StyleTheme;
  state: PetState;
  size?: "sm" | "md" | "lg";
  isWalking?: boolean;
  direction?: "left" | "right";
  isPoked?: boolean;
  onPoke?: () => void;
  className?: string;
}

export const FocusPetDisplay: React.FC<FocusPetDisplayProps> = ({
  theme,
  state,
  size = "md",
  isWalking = false,
  direction = "right",
  isPoked = false,
  onPoke,
  className,
}) => {
  if (theme === "pixel" || theme === "pixel-pure") {
    return (
      <PixelPet
        state={state}
        size={size}
        isWalking={isWalking}
        direction={direction}
        isPoked={isPoked}
        onPoke={onPoke}
        className={className}
      />
    );
  }

  if (theme === "pixel-dog" || theme === "pixel-dog-pure") {
    return (
      <PixelDog
        state={state}
        size={size}
        isWalking={isWalking}
        direction={direction}
        isPoked={isPoked}
        onPoke={onPoke}
        className={className}
      />
    );
  }

  if (theme === "vector" || theme === "vector-pure") {
    return (
      <VectorPet
        state={state}
        size={size}
        isWalking={isWalking}
        direction={direction}
        isPoked={isPoked}
        onPoke={onPoke}
        className={className}
      />
    );
  }

  return null;
};
