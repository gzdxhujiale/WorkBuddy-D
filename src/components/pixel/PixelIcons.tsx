import React from "react";

interface PixelIconProps {
  size?: number;
  className?: string;
}

/**
 * 8-bit Pixel Flame (连续打卡火焰)
 */
export const PixelFlame: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    {/* Dark Orange Outer Flame */}
    <rect x="7" y="1" width="2" height="2" fill="#EA580C" />
    <rect x="6" y="3" width="4" height="2" fill="#EA580C" />
    <rect x="4" y="5" width="8" height="2" fill="#EA580C" />
    <rect x="3" y="7" width="10" height="4" fill="#EA580C" />
    <rect x="4" y="11" width="8" height="3" fill="#EA580C" />
    <rect x="5" y="14" width="6" height="2" fill="#C2410C" />

    {/* Bright Orange/Yellow Core */}
    <rect x="7" y="5" width="2" height="2" fill="#FBBF24" />
    <rect x="6" y="7" width="4" height="4" fill="#FBBF24" />
    <rect x="7" y="11" width="2" height="2" fill="#FDE68A" />
  </svg>
);

/**
 * 8-bit Pixel Trophy (黄金奖杯)
 */
export const PixelTrophy: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    {/* Cup Top */}
    <rect x="4" y="2" width="8" height="2" fill="#F59E0B" />
    <rect x="3" y="4" width="10" height="3" fill="#FBBF24" />
    <rect x="4" y="7" width="8" height="2" fill="#F59E0B" />
    <rect x="6" y="9" width="4" height="2" fill="#D97706" />

    {/* Cup Highlight */}
    <rect x="5" y="4" width="2" height="3" fill="#FEF3C7" />

    {/* Handles */}
    <rect x="2" y="4" width="1" height="3" fill="#D97706" />
    <rect x="13" y="4" width="1" height="3" fill="#D97706" />

    {/* Base Stem & Base */}
    <rect x="7" y="11" width="2" height="2" fill="#92400E" />
    <rect x="4" y="13" width="8" height="2" fill="#78350F" />
    <rect x="6" y="13" width="4" height="1" fill="#FBBF24" />
  </svg>
);

/**
 * 8-bit Pixel Sword (恒心圣剑)
 */
export const PixelSword: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    {/* Tip & Blade */}
    <rect x="13" y="2" width="1" height="1" fill="#94A3B8" />
    <rect x="11" y="3" width="2" height="2" fill="#E2E8F0" />
    <rect x="9" y="5" width="2" height="2" fill="#E2E8F0" />
    <rect x="7" y="7" width="2" height="2" fill="#CBD5E1" />
    <rect x="6" y="8" width="1" height="1" fill="#94A3B8" />

    {/* Guard */}
    <rect x="4" y="8" width="2" height="2" fill="#F59E0B" />
    <rect x="7" y="11" width="2" height="2" fill="#F59E0B" />
    <rect x="5" y="9" width="3" height="3" fill="#D97706" />

    {/* Hilt & Pommel */}
    <rect x="3" y="11" width="2" height="2" fill="#78350F" />
    <rect x="1" y="13" width="2" height="2" fill="#F59E0B" />
  </svg>
);

/**
 * 8-bit Pixel Potion (魔力药水)
 */
export const PixelPotion: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    {/* Cork */}
    <rect x="7" y="2" width="2" height="2" fill="#92400E" />
    {/* Neck */}
    <rect x="6" y="4" width="4" height="2" fill="#94A3B8" />
    {/* Bottle Body */}
    <rect x="4" y="6" width="8" height="2" fill="#64748B" />
    <rect x="3" y="8" width="10" height="5" fill="#10B981" />
    <rect x="4" y="13" width="8" height="2" fill="#047857" />

    {/* Bubble Highlight */}
    <rect x="5" y="9" width="2" height="2" fill="#A7F3D0" />
    <rect x="9" y="11" width="1" height="1" fill="#ECFDF5" />
  </svg>
);

/**
 * 8-bit Pixel Coin (经验金币)
 */
export const PixelCoin: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    {/* Outer Edge */}
    <rect x="5" y="2" width="6" height="1" fill="#78350F" />
    <rect x="3" y="3" width="2" height="2" fill="#78350F" />
    <rect x="11" y="3" width="2" height="2" fill="#78350F" />
    <rect x="2" y="5" width="1" height="6" fill="#78350F" />
    <rect x="13" y="5" width="1" height="6" fill="#78350F" />
    <rect x="3" y="11" width="2" height="2" fill="#78350F" />
    <rect x="11" y="11" width="2" height="2" fill="#78350F" />
    <rect x="5" y="13" width="6" height="1" fill="#78350F" />

    {/* Gold Fill */}
    <rect x="4" y="4" width="8" height="8" fill="#FBBF24" />
    <rect x="5" y="3" width="6" height="1" fill="#FDE68A" />
    <rect x="3" y="5" width="1" height="6" fill="#FDE68A" />

    {/* Embossed $ / Center bar */}
    <rect x="7" y="5" width="2" height="6" fill="#D97706" />
    <rect x="6" y="6" width="1" height="1" fill="#D97706" />
    <rect x="9" y="9" width="1" height="1" fill="#D97706" />
  </svg>
);

/**
 * 8-bit Pixel Sparkle (闪光星)
 */
export const PixelSparkle: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    <rect x="7" y="1" width="2" height="4" fill="#F59E0B" />
    <rect x="7" y="11" width="2" height="4" fill="#F59E0B" />
    <rect x="1" y="7" width="4" height="2" fill="#F59E0B" />
    <rect x="11" y="7" width="4" height="2" fill="#F59E0B" />
    <rect x="5" y="5" width="6" height="6" fill="#FBBF24" />
    <rect x="6" y="6" width="4" height="4" fill="#FEF3C7" />
  </svg>
);

/**
 * 8-bit Pixel Scroll (复盘卷轴)
 */
export const PixelScroll: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    {/* Roll Ends */}
    <rect x="3" y="2" width="10" height="2" fill="#D97706" />
    <rect x="3" y="12" width="10" height="2" fill="#D97706" />
    {/* Parchment Body */}
    <rect x="4" y="4" width="8" height="8" fill="#FEF3C7" />
    {/* Written Text Lines */}
    <rect x="6" y="5" width="4" height="1" fill="#92400E" />
    <rect x="6" y="7" width="4" height="1" fill="#92400E" />
    <rect x="6" y="9" width="3" height="1" fill="#92400E" />
    {/* Roll edge shadow */}
    <rect x="12" y="3" width="1" height="10" fill="#B45309" />
  </svg>
);

/**
 * 8-bit Pixel Hourglass (时间沙漏)
 */
export const PixelHourglass: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    {/* Wood Frames */}
    <rect x="3" y="2" width="10" height="2" fill="#78350F" />
    <rect x="3" y="12" width="10" height="2" fill="#78350F" />
    {/* Glass Top */}
    <rect x="4" y="4" width="8" height="1" fill="#93C5FD" />
    <rect x="5" y="5" width="6" height="2" fill="#FBBF24" />
    <rect x="6" y="7" width="4" height="1" fill="#FBBF24" />
    {/* Center neck */}
    <rect x="7" y="8" width="2" height="1" fill="#F59E0B" />
    {/* Glass Bottom & Sand */}
    <rect x="6" y="9" width="4" height="1" fill="#93C5FD" />
    <rect x="5" y="10" width="6" height="2" fill="#FBBF24" />
    <rect x="4" y="11" width="8" height="1" fill="#F59E0B" />
  </svg>
);

/**
 * 8-bit Pixel Heart (生命爱心)
 */
export const PixelHeart: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    <rect x="3" y="3" width="4" height="2" fill="#EF4444" />
    <rect x="9" y="3" width="4" height="2" fill="#EF4444" />
    <rect x="2" y="5" width="12" height="4" fill="#EF4444" />
    <rect x="3" y="9" width="10" height="2" fill="#EF4444" />
    <rect x="4" y="11" width="8" height="2" fill="#DC2626" />
    <rect x="6" y="13" width="4" height="1" fill="#B91C1C" />
    <rect x="7" y="14" width="2" height="1" fill="#7F1D1D" />
    {/* Highlight */}
    <rect x="4" y="4" width="2" height="2" fill="#FCA5A5" />
  </svg>
);

/**
 * 8-bit Pixel Dumbbell (身体锻炼)
 */
export const PixelDumbbell: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    <rect x="2" y="5" width="2" height="6" fill="#475569" />
    <rect x="4" y="6" width="1" height="4" fill="#64748B" />
    <rect x="5" y="7" width="6" height="2" fill="#94A3B8" />
    <rect x="11" y="6" width="1" height="4" fill="#64748B" />
    <rect x="12" y="5" width="2" height="6" fill="#475569" />
  </svg>
);

/**
 * 8-bit Pixel Book (智力阅读)
 */
export const PixelBook: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    <rect x="3" y="3" width="10" height="2" fill="#2563EB" />
    <rect x="2" y="5" width="12" height="7" fill="#3B82F6" />
    <rect x="4" y="6" width="8" height="5" fill="#FEF3C7" />
    <rect x="3" y="12" width="10" height="2" fill="#1D4ED8" />
    <rect x="7" y="6" width="1" height="5" fill="#94A3B8" />
  </svg>
);

/**
 * 8-bit Pixel Lotus / Spirit (精神冥想)
 */
export const PixelLotus: React.FC<PixelIconProps> = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    <rect x="7" y="2" width="2" height="4" fill="#EC4899" />
    <rect x="6" y="6" width="4" height="4" fill="#F472B6" />
    <rect x="4" y="8" width="8" height="4" fill="#F472B6" />
    <rect x="3" y="11" width="10" height="2" fill="#DB2777" />
    <rect x="5" y="13" width="6" height="1" fill="#10B981" />
  </svg>
);

/**
 * 8-bit Pixel Slime Avatar (绿色像素史莱姆)
 */
export const PixelSlime: React.FC<PixelIconProps> = ({ size = 24, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    shapeRendering="crispEdges"
  >
    <rect x="7" y="2" width="2" height="2" fill="#10B981" />
    <rect x="5" y="4" width="6" height="2" fill="#10B981" />
    <rect x="3" y="6" width="10" height="6" fill="#34D399" />
    <rect x="4" y="12" width="8" height="2" fill="#059669" />

    {/* Eyes */}
    <rect x="5" y="7" width="2" height="2" fill="#064E3B" />
    <rect x="9" y="7" width="2" height="2" fill="#064E3B" />
    <rect x="5" y="7" width="1" height="1" fill="#FFFFFF" />
    <rect x="9" y="7" width="1" height="1" fill="#FFFFFF" />

    {/* Cheeks */}
    <rect x="4" y="9" width="1" height="1" fill="#F472B6" />
    <rect x="11" y="9" width="1" height="1" fill="#F472B6" />
  </svg>
);
