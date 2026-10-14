import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type PetState =
  | "ready"
  | "working"
  | "paused"
  | "resting"
  | "celebrating"
  | "stretching"
  | "knocking";

interface PixelPetProps {
  state: PetState;
  size?: "sm" | "md" | "lg";
  isWalking?: boolean;
  direction?: "left" | "right";
  isPoked?: boolean;
  onPoke?: () => void;
  className?: string;
}

export const PixelPet: React.FC<PixelPetProps> = ({
  state,
  size = "md",
  isWalking = false,
  direction = "right",
  isPoked: propIsPoked,
  onPoke,
  className,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [internalPoked, setInternalPoked] = useState(false);
  const isPoked = propIsPoked !== undefined ? propIsPoked : internalPoked;
  const [frame, setFrame] = useState(0);
  const [walkFrame, setWalkFrame] = useState(0);
  const [celebrateTick, setCelebrateTick] = useState(0);

  // Animation frame toggle (working / resting / knocking loop)
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
    }, state === "knocking" ? 180 : 380);
    return () => clearInterval(timer);
  }, [state]);

  // Fast celebrating bounce animation
  useEffect(() => {
    if (state !== "celebrating") {
      setCelebrateTick(0);
      return;
    }
    const timer = setInterval(() => {
      setCelebrateTick((t) => (t + 1) % 4);
    }, 180);
    return () => clearInterval(timer);
  }, [state]);

  // Rapid walking frame toggle when dragging
  useEffect(() => {
    if (!isWalking) {
      setWalkFrame(0);
      return;
    }
    const timer = setInterval(() => {
      setWalkFrame((f) => (f + 1) % 4);
    }, 120);
    return () => clearInterval(timer);
  }, [isWalking]);

  // Idle blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWalking) return;
    if (propIsPoked === undefined) {
      setInternalPoked(true);
      setTimeout(() => setInternalPoked(false), 600);
    }
    onPoke?.();
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "size-10";
      case "lg":
        return "size-20";
      case "md":
      default:
        return "size-12";
    }
  };

  // Only flip when actively walking to the right.
  const isFlipped = isWalking && direction === "right";

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative select-none cursor-pointer flex items-center justify-center transition-transform duration-150",
        isPoked && "scale-110 -translate-y-1",
        isWalking && (walkFrame % 2 === 0 ? "-translate-y-0.5" : "translate-y-0.5"),
        state === "celebrating" && (celebrateTick % 2 === 0 ? "-translate-y-1.5 scale-105" : "translate-y-0"),
        state === "knocking" && (frame === 0 ? "-translate-y-0.5" : "translate-y-0.5"),
        className
      )}
      style={{
        transform: `${isFlipped ? "scaleX(-1)" : "scaleX(1)"} ${
          isPoked ? "scale(1.1) translateY(-4px)" : ""
        }`,
      }}
      title="点击可戳一戳互动"
    >
      {/* Floating EXP and Confetti during celebration */}
      {state === "celebrating" && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 animate-bounce">
          <span className="text-[10px] font-black text-amber-500 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-nowrap bg-amber-100/90 dark:bg-amber-950/90 px-1 py-0.5 rounded border border-amber-600 shadow-xs">
            +EXP ✨
          </span>
        </div>
      )}

      {/* 8-bit Pixel SVG Cat */}
      <svg
        viewBox="0 0 32 32"
        className={cn(
          "shrink-0 drop-shadow-[1px_2px_0px_rgba(0,0,0,0.15)] overflow-visible",
          getSizeClasses()
        )}
        style={{ shapeRendering: "crispEdges" }}
      >
        {/* Background shadow under paws */}
        <rect
          x="7"
          y="27"
          width="18"
          height="2"
          fill="#D97706"
          opacity={isWalking ? 0.2 : 0.3}
        />

        {/* Tail */}
        {isWalking ? (
          walkFrame % 2 === 0 ? (
            <>
              <rect x="23" y="18" width="3" height="3" fill="#D97706" />
              <rect x="26" y="15" width="3" height="3" fill="#D97706" />
              <rect x="26" y="12" width="3" height="3" fill="#B45309" />
            </>
          ) : (
            <>
              <rect x="23" y="21" width="3" height="3" fill="#D97706" />
              <rect x="25" y="19" width="3" height="3" fill="#D97706" />
              <rect x="25" y="16" width="3" height="3" fill="#B45309" />
            </>
          )
        ) : state === "stretching" ? (
          // Tail pointing straight up in stretch
          <>
            <rect x="23" y="14" width="3" height="4" fill="#D97706" />
            <rect x="24" y="9" width="3" height="5" fill="#D97706" />
            <rect x="25" y="6" width="2" height="3" fill="#B45309" />
          </>
        ) : state === "celebrating" ? (
          celebrateTick % 2 === 0 ? (
            <>
              <rect x="23" y="15" width="3" height="4" fill="#D97706" />
              <rect x="25" y="11" width="3" height="4" fill="#D97706" />
              <rect x="27" y="8" width="3" height="3" fill="#B45309" />
            </>
          ) : (
            <>
              <rect x="23" y="17" width="3" height="3" fill="#D97706" />
              <rect x="26" y="14" width="3" height="3" fill="#D97706" />
              <rect x="27" y="11" width="3" height="3" fill="#B45309" />
            </>
          )
        ) : frame === 0 ? (
          <>
            <rect x="23" y="19" width="3" height="3" fill="#D97706" />
            <rect x="25" y="16" width="3" height="3" fill="#D97706" />
            <rect x="25" y="13" width="3" height="3" fill="#B45309" />
          </>
        ) : (
          <>
            <rect x="23" y="20" width="3" height="3" fill="#D97706" />
            <rect x="26" y="18" width="3" height="3" fill="#D97706" />
            <rect x="26" y="15" width="3" height="3" fill="#B45309" />
          </>
        )}

        {/* Cat Body Outline & Fill */}
        {state === "stretching" ? (
          // Arched back body during stretch
          <>
            <rect x="7" y="18" width="18" height="8" fill="#F59E0B" />
            <rect x="15" y="14" width="9" height="6" fill="#F59E0B" />
            <rect x="9" y="22" width="10" height="4" fill="#FEF3C7" />
          </>
        ) : (
          <>
            <rect x="8" y="14" width="16" height="12" fill="#F59E0B" />
            <rect x="10" y="26" width="12" height="2" fill="#D97706" />
            <rect x="12" y="18" width="8" height="7" fill="#FEF3C7" />
          </>
        )}

        {/* Ears */}
        <rect x="8" y="5" width="3" height="4" fill="#D97706" />
        <rect x="9" y="6" width="2" height="3" fill="#FDE68A" />
        <rect x="21" y="5" width="3" height="4" fill="#D97706" />
        <rect x="21" y="6" width="2" height="3" fill="#FDE68A" />

        {/* Head Base */}
        <rect x="8" y="8" width="16" height="10" fill="#F59E0B" />
        <rect x="11" y="7" width="10" height="2" fill="#D97706" />
        {/* Forehead Stripes */}
        <rect x="15" y="8" width="2" height="3" fill="#B45309" />
        <rect x="12" y="9" width="2" height="2" fill="#B45309" />
        <rect x="18" y="9" width="2" height="2" fill="#B45309" />

        {/* Eyes & Expressions */}
        {state === "celebrating" ? (
          // Starry / Super Happy Eyes ^o^
          <>
            <rect x="10" y="11" width="3" height="1" fill="#78350F" />
            <rect x="11" y="10" width="1" height="1" fill="#78350F" />
            <rect x="19" y="11" width="3" height="1" fill="#78350F" />
            <rect x="20" y="10" width="1" height="1" fill="#78350F" />
            {/* Sparkles near cheeks */}
            <rect x="6" y="10" width="1" height="1" fill="#F59E0B" />
            <rect x="25" y="10" width="1" height="1" fill="#F59E0B" />
          </>
        ) : state === "stretching" ? (
          // Relaxed stretching eyes ^^
          <>
            <rect x="10" y="12" width="3" height="1" fill="#78350F" />
            <rect x="19" y="12" width="3" height="1" fill="#78350F" />
          </>
        ) : state === "knocking" ? (
          // Focused wide alert eyes
          <>
            <rect x="10" y="10" width="3" height="3" fill="#78350F" />
            <rect x="11" y="10" width="1" height="1" fill="#FFFFFF" />
            <rect x="19" y="10" width="3" height="3" fill="#78350F" />
            <rect x="20" y="10" width="1" height="1" fill="#FFFFFF" />
          </>
        ) : isWalking ? (
          <>
            <rect x="11" y="11" width="3" height="3" fill="#78350F" />
            <rect x="13" y="11" width="1" height="1" fill="#FFFFFF" />
            <rect x="20" y="11" width="3" height="3" fill="#78350F" />
            <rect x="22" y="11" width="1" height="1" fill="#FFFFFF" />
          </>
        ) : state === "resting" ? (
          <>
            <rect x="10" y="11" width="3" height="1" fill="#78350F" />
            <rect x="19" y="11" width="3" height="1" fill="#78350F" />
          </>
        ) : isBlinking ? (
          <>
            <rect x="10" y="12" width="3" height="1" fill="#78350F" />
            <rect x="19" y="12" width="3" height="1" fill="#78350F" />
          </>
        ) : (
          <>
            <rect x="10" y="11" width="3" height="3" fill="#78350F" />
            <rect x="11" y="11" width="1" height="1" fill="#FFFFFF" />
            <rect x="19" y="11" width="3" height="3" fill="#78350F" />
            <rect x="20" y="11" width="1" height="1" fill="#FFFFFF" />
          </>
        )}

        {/* Nose & Mouth */}
        <rect x="15" y="14" width="2" height="1" fill="#F43F5E" />
        <rect x="14" y="15" width="4" height="1" fill="#78350F" />

        {/* Cheeks */}
        <rect x="9" y="14" width="2" height="1" fill="#FDA4AF" />
        <rect x="21" y="14" width="2" height="1" fill="#FDA4AF" />

        {/* Paws */}
        {state === "celebrating" ? (
          // Paws raised high in victory!
          <>
            <rect x="6" y="12" width="3" height="4" fill="#FEF3C7" />
            <rect x="23" y="12" width="3" height="4" fill="#FEF3C7" />
            {/* Bottom feet */}
            <rect x="10" y="25" width="3" height="3" fill="#FEF3C7" />
            <rect x="19" y="25" width="3" height="3" fill="#FEF3C7" />
          </>
        ) : state === "stretching" ? (
          // Front paws stretched far forward
          <>
            <rect x="4" y="25" width="5" height="3" fill="#FEF3C7" />
            <rect x="19" y="24" width="4" height="4" fill="#FEF3C7" />
          </>
        ) : state === "knocking" ? (
          // Alternating table tapping with impact waves!
          <>
            {frame === 0 ? (
              <>
                <rect x="9" y="26" width="4" height="3" fill="#FEF3C7" />
                <rect x="19" y="22" width="4" height="3" fill="#FEF3C7" />
                {/* Left impact wave */}
                <rect x="6" y="27" width="2" height="1" fill="#F59E0B" />
                <rect x="7" y="28" width="1" height="1" fill="#F59E0B" />
              </>
            ) : (
              <>
                <rect x="9" y="22" width="4" height="3" fill="#FEF3C7" />
                <rect x="19" y="26" width="4" height="3" fill="#FEF3C7" />
                {/* Right impact wave */}
                <rect x="24" y="27" width="2" height="1" fill="#F59E0B" />
                <rect x="24" y="28" width="1" height="1" fill="#F59E0B" />
              </>
            )}
          </>
        ) : isWalking ? (
          walkFrame === 0 ? (
            <>
              <rect x="8" y="25" width="3" height="3" fill="#FEF3C7" />
              <rect x="16" y="23" width="3" height="3" fill="#FEF3C7" />
              <rect x="12" y="24" width="2" height="2" fill="#D97706" />
              <rect x="21" y="25" width="3" height="3" fill="#FEF3C7" />
            </>
          ) : walkFrame === 1 ? (
            <>
              <rect x="9" y="24" width="3" height="3" fill="#FEF3C7" />
              <rect x="17" y="24" width="3" height="3" fill="#FEF3C7" />
              <rect x="13" y="25" width="2" height="2" fill="#D97706" />
              <rect x="20" y="24" width="3" height="3" fill="#FEF3C7" />
            </>
          ) : walkFrame === 2 ? (
            <>
              <rect x="10" y="23" width="3" height="3" fill="#FEF3C7" />
              <rect x="18" y="25" width="3" height="3" fill="#FEF3C7" />
              <rect x="14" y="24" width="2" height="2" fill="#D97706" />
              <rect x="19" y="23" width="3" height="3" fill="#FEF3C7" />
            </>
          ) : (
            <>
              <rect x="9" y="24" width="3" height="3" fill="#FEF3C7" />
              <rect x="17" y="24" width="3" height="3" fill="#FEF3C7" />
              <rect x="13" y="23" width="2" height="2" fill="#D97706" />
              <rect x="20" y="24" width="3" height="3" fill="#FEF3C7" />
            </>
          )
        ) : state === "working" ? (
          <>
            <rect x="11" y="21" width="10" height="5" fill="#334155" />
            <rect x="12" y="22" width="8" height="3" fill="#38BDF8" />
            {frame === 0 ? (
              <>
                <rect x="10" y="21" width="3" height="2" fill="#FEF3C7" />
                <rect x="19" y="23" width="3" height="2" fill="#FEF3C7" />
              </>
            ) : (
              <>
                <rect x="10" y="23" width="3" height="2" fill="#FEF3C7" />
                <rect x="19" y="21" width="3" height="2" fill="#FEF3C7" />
              </>
            )}
          </>
        ) : state === "resting" ? (
          <>
            <rect x="10" y="24" width="4" height="2" fill="#FEF3C7" />
            <rect x="18" y="24" width="4" height="2" fill="#FEF3C7" />
            {frame === 0 ? (
              <text x="24" y="9" fontSize="6" fill="#38BDF8" fontWeight="bold" fontFamily="monospace">
                Z
              </text>
            ) : (
              <text x="25" y="7" fontSize="8" fill="#38BDF8" fontWeight="bold" fontFamily="monospace">
                z
              </text>
            )}
          </>
        ) : (
          <>
            <rect x="10" y="24" width="3" height="3" fill="#FEF3C7" />
            <rect x="19" y="24" width="3" height="3" fill="#FEF3C7" />
          </>
        )}

        {/* Poked / Heart reaction */}
        {isPoked && (
          <path
            d="M 14 3 L 16 1 L 18 3 L 16 5 Z"
            fill="#EF4444"
            className="animate-bounce"
          />
        )}
      </svg>
    </div>
  );
};
