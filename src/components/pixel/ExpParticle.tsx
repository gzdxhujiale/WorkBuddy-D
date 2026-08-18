import React, { useEffect, useState } from "react";

export interface ExpParticleItem {
  id: string;
  x: number;
  y: number;
  text: string;
  color?: string;
}

interface ExpParticleContainerProps {
  particles: ExpParticleItem[];
  onFinish?: (id: string) => void;
}

export const ExpParticleContainer: React.FC<ExpParticleContainerProps> = ({
  particles,
  onFinish,
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <ExpFloatingText key={p.id} item={p} onFinish={onFinish} />
      ))}
    </div>
  );
};

const ExpFloatingText: React.FC<{
  item: ExpParticleItem;
  onFinish?: (id: string) => void;
}> = ({ item, onFinish }) => {
  const [opacity, setOpacity] = useState(1);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    // Trigger floating upwards and fading out
    const frame = requestAnimationFrame(() => {
      setTranslateY(-35);
      setOpacity(0);
    });

    const timer = setTimeout(() => {
      if (onFinish) onFinish(item.id);
    }, 900);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [item.id, onFinish]);

  return (
    <div
      style={{
        left: item.x,
        top: item.y,
        transform: `translate(-50%, ${translateY}px) scale(1.1)`,
        opacity,
        transition: "transform 0.85s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 0.85s ease-out",
        fontFamily: "'Courier New', monospace",
        textShadow: "1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000",
      }}
      className={`fixed select-none font-black text-xs md:text-sm tracking-wider ${
        item.color || "text-amber-300"
      }`}
    >
      {item.text}
    </div>
  );
};
