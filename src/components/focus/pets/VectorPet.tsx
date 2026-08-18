import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { PetState } from "./PixelPet";

interface VectorPetProps {
  state: PetState;
  size?: "sm" | "md" | "lg";
  isWalking?: boolean;
  direction?: "left" | "right";
  onPoke?: () => void;
  className?: string;
}

export const VectorPet: React.FC<VectorPetProps> = ({
  state,
  size = "md",
  isWalking = false,
  direction = "right",
  onPoke,
  className,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isPoked, setIsPoked] = useState(false);
  const [pawFrame, setPawFrame] = useState(0);
  const [walkFrame, setWalkFrame] = useState(0);
  const [celebrateTick, setCelebrateTick] = useState(0);

  // Keyboard tapping / Knocking paw animation
  useEffect(() => {
    if (state !== "working" && state !== "knocking") return;
    const timer = setInterval(() => {
      setPawFrame((f) => (f + 1) % 2);
    }, state === "knocking" ? 180 : 250);
    return () => clearInterval(timer);
  }, [state]);

  // Celebrating jump tick
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

  // Fast walking trot animation during drag
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

  // Periodic blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPoked(true);
    setTimeout(() => setIsPoked(false), 500);
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
        isPoked && "scale-115 -translate-y-1.5",
        isWalking && (walkFrame % 2 === 0 ? "-translate-y-1" : "translate-y-0.5"),
        state === "celebrating" && (celebrateTick % 2 === 0 ? "-translate-y-2 scale-105" : "translate-y-0"),
        state === "knocking" && (pawFrame === 0 ? "-translate-y-0.5" : "translate-y-0.5"),
        className
      )}
      style={{
        transform: `${isFlipped ? "scaleX(-1)" : "scaleX(1)"} ${
          isPoked ? "scale(1.15) translateY(-6px)" : ""
        }`,
      }}
      title="点击可戳一戳互动"
    >
      {/* Floating EXP and Confetti during celebration */}
      {state === "celebrating" && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 animate-bounce">
          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 font-sans drop-shadow-xs whitespace-nowrap bg-amber-50/95 dark:bg-amber-950/95 px-1.5 py-0.5 rounded-full border border-amber-400 shadow-sm flex items-center gap-0.5">
            🎉 +EXP ✨
          </span>
        </div>
      )}

      <svg
        viewBox="0 0 48 48"
        className={cn(
          "shrink-0 drop-shadow-md overflow-visible",
          getSizeClasses()
        )}
      >
        <defs>
          <linearGradient id="shibaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="coffeeCup" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>

        {/* Confetti particles during celebration */}
        {state === "celebrating" && (
          <g className="animate-pulse">
            <circle cx="8" cy="12" r="1.5" fill="#F43F5E" />
            <circle cx="40" cy="10" r="1.5" fill="#38BDF8" />
            <polygon points="6,24 8,22 9,25" fill="#FACC15" />
            <polygon points="38,22 41,20 40,24" fill="#10B981" />
          </g>
        )}

        {/* Tail */}
        <path
          d="M 36 28 C 42 24, 43 17, 39 15 C 37 17, 36 21, 34 24 Z"
          fill="#FB923C"
          className={cn(
            "origin-[34px_24px] transition-transform duration-200",
            state === "celebrating"
              ? celebrateTick % 2 === 0
                ? "rotate-24 scale-110"
                : "-rotate-12 scale-95"
              : isWalking
              ? walkFrame % 2 === 0
                ? "rotate-12 scale-105"
                : "-rotate-6 scale-95"
              : state === "stretching"
              ? "rotate-18 scale-105"
              : state === "working"
              ? "animate-pulse"
              : "animate-bounce"
          )}
        />

        {/* Main Body */}
        {state === "stretching" ? (
          <ellipse cx="24" cy="32" rx="15" ry="9" fill="url(#shibaGradient)" />
        ) : (
          <ellipse cx="24" cy="30" rx="14" ry="12" fill="url(#shibaGradient)" />
        )}

        {/* White Belly */}
        <ellipse cx="24" cy="32" rx="9" ry="8" fill="#FFF7ED" />

        {/* Ears */}
        <polygon
          points="12,18 16,6 23,14"
          fill="#EA580C"
          className={cn(
            state === "celebrating" ? "-translate-y-1" : "",
            isWalking && walkFrame % 2 === 0 ? "-translate-y-0.5" : ""
          )}
        />
        <polygon points="14,16 17,9 21,14" fill="#FED7AA" />

        <polygon
          points="36,18 32,6 25,14"
          fill="#EA580C"
          className={cn(
            state === "celebrating" ? "-translate-y-1" : "",
            isWalking && walkFrame % 2 === 1 ? "-translate-y-0.5" : ""
          )}
        />
        <polygon points="34,16 31,9 27,14" fill="#FED7AA" />

        {/* Head */}
        <circle cx="24" cy="20" r="13" fill="url(#shibaGradient)" />

        {/* White Face Mask */}
        <path
          d="M 16 22 C 16 16, 21 16, 24 19 C 27 16, 32 16, 32 22 C 32 28, 28 31, 24 31 C 20 31, 16 28, 16 22 Z"
          fill="#FFF7ED"
        />

        {/* Cheeks blush */}
        <circle cx="16" cy="24" r="2.2" fill="#FDA4AF" opacity="0.8" />
        <circle cx="32" cy="24" r="2.2" fill="#FDA4AF" opacity="0.8" />

        {/* Eyes */}
        {state === "celebrating" ? (
          // Happy smiling eyes ^^
          <>
            <path d="M 18 20 Q 20 17 22 20" stroke="#431407" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M 26 20 Q 28 17 30 20" stroke="#431407" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </>
        ) : state === "stretching" ? (
          <>
            <path d="M 18 21 Q 20 19 22 21" stroke="#7C2D12" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M 26 21 Q 28 19 30 21" stroke="#7C2D12" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        ) : state === "knocking" ? (
          <>
            <circle cx="20" cy="19.5" r="2.5" fill="#431407" />
            <circle cx="19.2" cy="18.8" r="0.9" fill="#FFFFFF" />
            <circle cx="28" cy="19.5" r="2.5" fill="#431407" />
            <circle cx="27.2" cy="18.8" r="0.9" fill="#FFFFFF" />
          </>
        ) : isWalking ? (
          <>
            <circle cx="20" cy="19.5" r="2.4" fill="#431407" />
            <circle cx="19.2" cy="18.8" r="0.9" fill="#FFFFFF" />
            <circle cx="28" cy="19.5" r="2.4" fill="#431407" />
            <circle cx="27.2" cy="18.8" r="0.9" fill="#FFFFFF" />
          </>
        ) : state === "resting" ? (
          <>
            <path d="M 18 20 Q 20 18 22 20" stroke="#7C2D12" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M 26 20 Q 28 18 30 20" stroke="#7C2D12" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        ) : isBlinking ? (
          <>
            <line x1="18" y1="20" x2="22" y2="20" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" />
            <line x1="26" y1="20" x2="30" y2="20" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="20" cy="20" r="2.2" fill="#431407" />
            <circle cx="19.3" cy="19.2" r="0.8" fill="#FFFFFF" />
            <circle cx="28" cy="20" r="2.2" fill="#431407" />
            <circle cx="27.3" cy="19.2" r="0.8" fill="#FFFFFF" />
          </>
        )}

        {/* Nose & Mouth */}
        <polygon points="23,23 25,23 24,24.5" fill="#431407" />
        <path
          d={state === "celebrating" || isWalking ? "M 22 24.5 Q 24 27.5 26 24.5" : "M 22.5 25 Q 24 26.5 25.5 25"}
          stroke="#7C2D12"
          strokeWidth="1.2"
          fill={state === "celebrating" || isWalking ? "#F43F5E" : "none"}
          strokeLinecap="round"
        />

        {/* Dynamic Paws */}
        {state === "celebrating" ? (
          // Paws raised high in victory!
          <g>
            <ellipse cx="14" cy="22" rx="3" ry="2.2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
            <ellipse cx="34" cy="22" rx="3" ry="2.2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
            <ellipse cx="20" cy="38" rx="3.5" ry="2.5" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
            <ellipse cx="28" cy="38" rx="3.5" ry="2.5" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
          </g>
        ) : state === "stretching" ? (
          // Front paws stretched forward
          <g>
            <ellipse cx="12" cy="37" rx="4.5" ry="2.2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
            <ellipse cx="32" cy="37" rx="3.5" ry="2.5" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
          </g>
        ) : state === "knocking" ? (
          // Alternating table knocking with sound ripples
          <g>
            <ellipse
              cx="18"
              cy={pawFrame === 0 ? 37 : 33}
              rx="3.5"
              ry="2.5"
              fill="#FFF7ED"
              stroke="#EA580C"
              strokeWidth="0.8"
            />
            <ellipse
              cx="30"
              cy={pawFrame === 0 ? 33 : 37}
              rx="3.5"
              ry="2.5"
              fill="#FFF7ED"
              stroke="#EA580C"
              strokeWidth="0.8"
            />
            {/* Impact ripples */}
            {pawFrame === 0 ? (
              <circle cx="18" cy="39" r="2" stroke="#FB923C" strokeWidth="0.8" fill="none" className="animate-ping" />
            ) : (
              <circle cx="30" cy="39" r="2" stroke="#FB923C" strokeWidth="0.8" fill="none" className="animate-ping" />
            )}
          </g>
        ) : isWalking ? (
          <g>
            {walkFrame === 0 ? (
              <>
                <ellipse cx="16" cy="38" rx="3.5" ry="2.2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <ellipse cx="32" cy="35" rx="3" ry="2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <circle cx="21" cy="36" r="2" fill="#FED7AA" />
                <circle cx="27" cy="38" r="2" fill="#FED7AA" />
              </>
            ) : walkFrame === 1 ? (
              <>
                <ellipse cx="18" cy="36.5" rx="3.2" ry="2.1" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <ellipse cx="30" cy="36.5" rx="3.2" ry="2.1" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <circle cx="22" cy="37" r="2" fill="#FED7AA" />
                <circle cx="26" cy="37" r="2" fill="#FED7AA" />
              </>
            ) : walkFrame === 2 ? (
              <>
                <ellipse cx="16" cy="35" rx="3" ry="2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <ellipse cx="32" cy="38" rx="3.5" ry="2.2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <circle cx="21" cy="38" r="2" fill="#FED7AA" />
                <circle cx="27" cy="36" r="2" fill="#FED7AA" />
              </>
            ) : (
              <>
                <ellipse cx="18" cy="36.5" rx="3.2" ry="2.1" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <ellipse cx="30" cy="36.5" rx="3.2" ry="2.1" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
                <circle cx="22" cy="37" r="2" fill="#FED7AA" />
                <circle cx="26" cy="37" r="2" fill="#FED7AA" />
              </>
            )}
          </g>
        ) : state === "working" ? (
          <g className="animate-in fade-in duration-200">
            <rect x="14" y="32" width="20" height="9" rx="1.5" fill="#334155" />
            <rect x="16" y="33.5" width="16" height="6.5" rx="1" fill="#38BDF8" className="animate-pulse" />
            <circle cx={pawFrame === 0 ? 17 : 19} cy="32" r="2.5" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
            <circle cx={pawFrame === 0 ? 31 : 29} cy="32" r="2.5" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
          </g>
        ) : state === "resting" ? (
          <g className="animate-in fade-in duration-200">
            <rect x="20" y="30" width="8" height="7" rx="1.5" fill="url(#coffeeCup)" />
            <path d="M 28 32 C 30 32, 30 35, 28 35" stroke="#0284C7" strokeWidth="1.5" fill="none" />
            <path
              d="M 22 28 Q 23 26 22 24 M 26 28 Q 25 26 26 24"
              stroke="#94A3B8"
              strokeWidth="1"
              strokeLinecap="round"
              fill="none"
              className="animate-pulse opacity-80"
            />
          </g>
        ) : (
          <g>
            <ellipse cx="18" cy="36" rx="3.5" ry="2.5" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
            <ellipse cx="30" cy="36" rx="3.5" ry="2.5" fill="#FFF7ED" stroke="#EA580C" strokeWidth="0.8" />
          </g>
        )}

        {/* Poked Heart Animation */}
        {isPoked && (
          <path
            d="M 24 6 C 22 3, 19 4, 19 7 C 19 10, 24 13, 24 13 C 24 13, 29 10, 29 7 C 29 4, 26 3, 24 6 Z"
            fill="#F43F5E"
            className="animate-bounce origin-center"
          />
        )}
      </svg>
    </div>
  );
};
