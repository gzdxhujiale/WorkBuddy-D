import { z } from "zod";

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, "项目名称不能为空"),
    description: z.string().optional().default(""),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    ownerName: z.string().optional().default(""),
    priority: z.enum(["low", "medium", "high", "urgent"] as const).default("medium"),
    tags: z.array(z.string()).default([]),
    templateId: z.string().optional().default(""),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "结束日期不能早于开始日期",
      path: ["endDate"],
    }
  );

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const templateFormSchema = z.object({
  name: z.string().trim().min(1, "请填写模板名称"),
  description: z.string().optional().default(""),
  stages: z
    .array(
      z.object({
        key: z.string(),
        name: z.string().trim().min(1, "阶段名称不能为空"),
        defaultAssigneeName: z.string().optional().default(""),
      })
    )
    .min(1, "请至少保留一个阶段"),
  tasks: z
    .array(
      z.object({
        stageKey: z.string(),
        title: z.string().default(""),
        assigneeName: z.string().optional().default(""),
        priority: z.enum(["low", "medium", "high", "urgent"] as const).default("medium"),
        description: z.string().optional().default(""),
        quadrant: z.string().default("Q2"),
      })
    )
    .default([]),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;
