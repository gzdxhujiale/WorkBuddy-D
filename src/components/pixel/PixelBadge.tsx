import React from "react";
import {
  PixelFlame,
  PixelTrophy,
  PixelSword,
  PixelPotion,
  PixelSparkle,
  PixelScroll,
} from "./PixelIcons";

export interface AchievementItem {
  id: string;
  title: string;
  desc: string;
  icon: React.FC<{ size?: number; className?: string }>;
  unlocked: boolean;
  progressText?: string;
}

export interface PixelBadgeProps {
  level?: number;
  streakDays?: number;
  totalDays?: number;
  className?: string;
}

export const getAchievements = (currentStreak: number, totalDays: number): AchievementItem[] => {
  return [
    {
      id: "first_step",
      title: "初出茅庐",
      desc: "完成第 1 次打卡或复盘记录",
      icon: PixelSparkle,
      unlocked: totalDays >= 1,
      progressText: `${Math.min(totalDays, 1)}/1`,
    },
    {
      id: "streak_3",
      title: "萌芽之森",
      desc: "连续打卡达成 3 天",
      icon: PixelPotion,
      unlocked: currentStreak >= 3,
      progressText: `${Math.min(currentStreak, 3)}/3`,
    },
    {
      id: "streak_7",
      title: "恒心之火",
      desc: "连续打卡达成 7 天",
      icon: PixelFlame,
      unlocked: currentStreak >= 7,
      progressText: `${Math.min(currentStreak, 7)}/7`,
    },
    {
      id: "streak_21",
      title: "习惯筑基",
      desc: "连续打卡达成 21 天，形成坚固习惯",
      icon: PixelSword,
      unlocked: currentStreak >= 21,
      progressText: `${Math.min(currentStreak, 21)}/21`,
    },
    {
      id: "total_30",
      title: "复利卷轴",
      desc: "累计记录达到 30 天",
      icon: PixelScroll,
      unlocked: totalDays >= 30,
      progressText: `${Math.min(totalDays, 30)}/30`,
    },
    {
      id: "total_100",
      title: "传奇宗师",
      desc: "累计坚持记录达到 100 天",
      icon: PixelTrophy,
      unlocked: totalDays >= 100,
      progressText: `${Math.min(totalDays, 100)}/100`,
    },
  ];
};

export const getLevelInfo = (totalCheckIns: number) => {
  // Every 5 check-ins = 1 Level up
  const level = Math.min(99, Math.floor(totalCheckIns / 5) + 1);
  const currentLevelExp = (totalCheckIns % 5) * 20; // 0% ~ 80%

  let title = "萌新冒险者";
  if (level >= 20) title = "时间魔导师";
  else if (level >= 15) title = "自律领主";
  else if (level >= 10) title = "传奇勇士";
  else if (level >= 5) title = "恒心骑士";
  else if (level >= 2) title = "熟练学徒";

  return { level, currentLevelExp, title };
};

/**
 * 8-bit Pixel Achievement Hall (成就殿堂折叠卡片)
 */
export const PixelAchievementHall: React.FC<{
  currentStreak: number;
  totalDays: number;
}> = ({ currentStreak, totalDays }) => {
  const achievements = getAchievements(currentStreak, totalDays);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="bg-amber-50/80 dark:bg-amber-950/20 border-2 border-amber-900/60 dark:border-amber-700/60 rounded-xl p-3.5 shadow-[2px_2px_0px_rgba(120,53,15,0.4)] select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-900/20 dark:border-amber-700/30">
        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950 dark:text-amber-200">
          <PixelTrophy size={16} />
          <span>成就殿堂</span>
        </div>
        <span className="text-[11px] font-mono text-amber-800 dark:text-amber-400 font-bold">
          {unlockedCount}/{achievements.length} 已解锁
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {achievements.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`flex flex-col items-center p-2 rounded-lg border transition-all text-center group relative cursor-pointer ${
                item.unlocked
                  ? "bg-amber-100/90 dark:bg-amber-900/40 border-amber-800/60 text-amber-950 dark:text-amber-100 shadow-[1px_1px_0px_rgba(120,53,15,0.6)] hover:scale-105"
                  : "bg-muted/40 border-border/60 text-muted-foreground/50 opacity-60 grayscale hover:opacity-80"
              }`}
              title={`${item.title} - ${item.desc} (${item.progressText})`}
            >
              <div className="mb-1">
                <Icon size={20} />
              </div>
              <div className="text-[11px] font-bold tracking-tight truncate w-full">
                {item.title}
              </div>
              <div className="text-[9px] font-mono opacity-80 mt-0.5">
                {item.unlocked ? "已达成 ✨" : item.progressText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
