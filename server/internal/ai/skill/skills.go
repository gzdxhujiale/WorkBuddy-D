package skill

import (
	"context"
	"fmt"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
)

// SkillCode is an identifier for registered business skills.
type SkillCode string

const (
	SkillDailyReviewSynthesis  SkillCode = "daily_review_synthesis"
	SkillTaskQuadrantBreakdown SkillCode = "task_quadrant_breakdown"
	SkillProjectStagePlanning  SkillCode = "project_stage_planning"
)

// SkillMetadata describes a skill capability and its metadata.
type SkillMetadata struct {
	Code        SkillCode `json:"code"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
}

// BuiltinSkills returns the list of system-provided skills.
func BuiltinSkills() []SkillMetadata {
	return []SkillMetadata{
		{
			Code:        SkillDailyReviewSynthesis,
			Name:        "每日复盘智能合成",
			Description: "基于当日完成的任务、专注时长和打卡数据，一键提炼深度复盘与明日规划",
			Icon:        "BookCheck",
		},
		{
			Code:        SkillTaskQuadrantBreakdown,
			Name:        "任务四象限智能拆解",
			Description: "输入粗粒度目标或杂乱备忘，依据紧急/重要维度精准拆解为四象限行动项",
			Icon:        "ListTodo",
		},
		{
			Code:        SkillProjectStagePlanning,
			Name:        "项目阶段规划建议",
			Description: "针对新项目或目标，自动拆解里程碑节点、工期估算与交付清单",
			Icon:        "FolderKanban",
		},
	}
}

// BuildSkillPrompt constructs system and user prompt for a specific skill.
func BuildSkillPrompt(code SkillCode, userInput string, dateStr string) ([]*schema.Message, error) {
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	switch code {
	case SkillDailyReviewSynthesis:
		sysPrompt := `你是一位严谨、鼓励成长的个人效能与复盘教练。
当前日期: ` + dateStr + `
你的任务是根据用户的输入（以及调用的当日任务、专注与打卡数据），生成一份结构严密、洞察深刻的每日复盘报告。

报告请严格遵循以下 Markdown 结构：
### 🌟 今日高光与核心成果 (Highlights & Wins)
- 列出今日完成的关键任务与成果

### ⏱️ 深度专注与精力投入 (Focus & Habits)
- 汇总专注时长、番茄钟节奏与习惯坚持情况

### 🎯 待推进与明天规划 (Pending & Next Day Outlook)
- 指出未尽事宜与明天需优先推进的 1~3 个核心目标

### 💡 思考与复盘总结 (Insights & Growth)
- 提炼 1~2 点关于时间分配、阻碍克服或心智认知的总结`

		return []*schema.Message{
			schema.SystemMessage(sysPrompt),
			schema.UserMessage(userInput),
		}, nil

	case SkillTaskQuadrantBreakdown:
		sysPrompt := `你是一位精通艾森豪威尔法则（四象限时间管理法）的高级效能顾问。
用户会提供一个目标、项目想法或随手杂记。请你将其拆解为具体可落地的任务，并按四个象限严格归类：
1. **第一象限 (Q1: 重要且紧急)**：危机、有明确硬性截止日期的核心阻碍
2. **第二象限 (Q2: 重要不紧急)**：长远目标、技能提升、架构设计、健康投资（需重点聚焦）
3. **第三象限 (Q3: 紧急不重要)**：琐碎杂务、突发通知、可委托事务
4. **第四象限 (Q4: 不重要不紧急)**：消耗精力、可考虑删减或延后的活动

请输出清晰的 Markdown 格式，每个象限包含 1~3 个建议任务，标明：任务标题、优先级（high/medium/low）、建议耗时与行动建议。`

		return []*schema.Message{
			schema.SystemMessage(sysPrompt),
			schema.UserMessage(userInput),
		}, nil

	case SkillProjectStagePlanning:
		sysPrompt := `你是一位专业的技术与产品项目规划专家。
用户会描述一个项目的背景、目标与期望交付期。
你的任务是将该项目生命周期系统拆解为 3~5 个顺序递进的阶段（Stage/Milestone）。

每个阶段需明确：
1. **阶段名称**（如：需求调研与方案设计、核心原型研发、系统联调与压测、正式上线与推广）
2. **目标与关键交付物** (Deliverables)
3. **建议工期与前后依赖** (Estimated Duration & Dependencies)
4. **潜在风险与规避策略** (Risks & Mitigation)

请以清晰结构化的 Markdown 呈现，逻辑紧凑，可直接用于项目中心阶段配置。`

		return []*schema.Message{
			schema.SystemMessage(sysPrompt),
			schema.UserMessage(userInput),
		}, nil

	default:
		return nil, fmt.Errorf("unknown skill code: %s", code)
	}
}

// ExecuteSkillNonStreaming executes a skill synchronously with full response.
func ExecuteSkillNonStreaming(ctx context.Context, cm model.ChatModel, code SkillCode, userInput, dateStr string, tools []tool.BaseTool) (*schema.Message, error) {
	messages, err := BuildSkillPrompt(code, userInput, dateStr)
	if err != nil {
		return nil, err
	}

	return cm.Generate(ctx, messages)
}

// ExecuteSkillStreaming executes a skill with streaming tokens output.
func ExecuteSkillStreaming(ctx context.Context, cm model.ChatModel, code SkillCode, userInput, dateStr string, tools []tool.BaseTool) (*schema.StreamReader[*schema.Message], error) {
	messages, err := BuildSkillPrompt(code, userInput, dateStr)
	if err != nil {
		return nil, err
	}

	return cm.Stream(ctx, messages)
}
