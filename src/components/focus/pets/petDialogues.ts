export type PetEvent =
  | "focus_start"
  | "focus_pause"
  | "focus_resume"
  | "focus_complete"
  | "focus_stop"
  | "rest_complete"
  | "rest_skip"
  | "poke";

export interface PetDialogueOptions {
  targetName?: string;
  focusMinutes?: number;
  restMinutes?: number;
  species?: "cat" | "dog";
}

const CAT_DIALOGUES: Record<PetEvent, string[]> = {
  focus_start: [
    "喵！我们开始专注啦，我会一直陪着你的~",
    "出发！把干扰都收好，今天也要元气满满哦 (๑•̀ㅂ•́)و✧",
    "开启心流模式！主人认真工作的样子最帅啦~",
    "滴！专注引擎启动，让我们一鼓作气搞定它！",
  ],
  focus_pause: [
    "累了吗喵？稍微歇口气，等下再继续战！",
    "暂停中~ 别走神太久哦，本喵在看着你呢 🐾",
    "喝口水润润嗓子，准备好了随时点我继续~",
  ],
  focus_resume: [
    "继续出发！保持节奏，胜利就在眼前~",
    "重新连接心流！冲冲冲 🚀",
    "喵！元气回归，我们继续专注吧~",
  ],
  focus_complete: [
    "🎉 太棒啦！完成了专注，跟我一起休息一下吧~",
    "大功告成喵！主人超级厉害，快来喝杯水放松放松！",
    "滴！专注目标达成，为你撒花 🎉 享受属于你的休息时间吧~",
  ],
  focus_stop: [
    "辛苦啦喵~ 先休息一会儿，蓄力完毕随时再来！",
    "本次专注已结束，跟我一起深呼吸放松肩颈吧 🌿",
    "收到指令！立刻进入休息充电模式 ☕",
  ],
  rest_complete: [
    "☕ 伸个大大的懒腰~ 休息结束啦，准备开始新的冲刺了吗？",
    "能量充满 100%！主人，我们要继续战斗啦 ٩(ˊᗜˋ*)و",
    "叮咚！电量满格，随时可以开启下一轮专注喵！",
  ],
  rest_skip: [
    "收到！满血复活，立刻冲刺 ⚡",
    "冲劲十足喵！让我们直接开启下一段心流！",
    "随时待命！主人加油，本喵全力支持你~",
  ],
  poke: [
    "喵呜？别戳我啦，快专心工作喵~ (ฅ^•ﻌ•^ฅ)",
    "（蹭蹭）今天也是效率拉满的一天呢！",
    "嗷呜！戳我一下，专注力 +100% 💖",
    "主人加油！我在旁边给你默默加油打气~",
    "呼噜呼噜… 被你戳得好舒服呀 (｡•̀ᴗ-)✧",
  ],
};

const DOG_DIALOGUES: Record<PetEvent, string[]> = {
  focus_start: [
    "汪！我们开始专注啦，狗狗会一直陪着你的~",
    "出发！把干扰都收好，今天也要元气满满哦 (U•ᴥ•U)🐾",
    "开启心流模式！主人认真工作的样子最帅气啦~",
    "汪汪！专注引擎启动，让我们一鼓作气搞定它！",
  ],
  focus_pause: [
    "累了吗汪？稍微歇口气，等下再继续战！",
    "暂停中~ 别走神太久哦，狗狗在旁边守着你呢 🐾",
    "喝口水润润嗓子，准备好了随时点我继续汪~",
  ],
  focus_resume: [
    "（兴奋摇尾巴）继续出发！保持节奏，胜利就在眼前~",
    "重新连接心流！冲冲冲 🚀",
    "汪！元气回归，我们继续专注吧~",
  ],
  focus_complete: [
    "🎉 太棒啦！完成了专注，快跟我一起休息一下吧~",
    "大功告成汪！主人超级厉害，快来喝杯水放松放松！",
    "汪汪！专注目标达成，为你撒花 🎉 享受属于你的休息时间吧~",
  ],
  focus_stop: [
    "辛苦啦汪~ 先休息一会儿，蓄力完毕随时再来！",
    "本次专注已结束，跟我一起伸展身体放松一下吧 🌿",
    "收到指令！立刻进入休息充电模式 ☕",
  ],
  rest_complete: [
    "🐾 摇摇尾巴~ 休息结束啦，准备开始新的冲刺了吗？",
    "能量充满 100%！主人，我们要继续战斗啦 (U・ᴥ・U)و",
    "汪汪！电量满格，随时可以开启下一轮专注！",
  ],
  rest_skip: [
    "收到！满血复活，立刻冲刺 ⚡",
    "冲劲十足汪！让我们直接开启下一段心流！",
    "随时待命！主人加油，狗狗全力支持你~",
  ],
  poke: [
    "汪呜？别戳我啦，快专心工作汪~ (U・ᴥ・U)",
    "（开心地摇尾巴）今天也是效率拉满的一天呢！",
    "嗷呜！戳我一下，专注力 +100% 💖",
    "主人加油！我在旁边给你默默加油打气~",
    "汪汪！蹭蹭手心，被你摸得好开心呀 (｡•̀ᴗ-)✧",
  ],
};

export function getPetDialogue(event: PetEvent, options?: PetDialogueOptions): string {
  const isDog = options?.species === "dog";
  const source = isDog ? DOG_DIALOGUES : CAT_DIALOGUES;
  const list = source[event] || source.poke;
  const randomIndex = Math.floor(Math.random() * list.length);
  let text = list[randomIndex];

  const prefix = isDog ? "汪！" : "喵！";
  if (event === "focus_start" && options?.targetName && options.targetName !== "专注") {
    text = `${prefix}开始专注「${options.targetName}」啦，加油冲鸭！`;
  } else if (event === "focus_complete" && options?.restMinutes) {
    text = `🎉 太棒啦！专注完成，快跟我一起休息 ${options.restMinutes} 分钟吧~`;
  }

  return text;
}
