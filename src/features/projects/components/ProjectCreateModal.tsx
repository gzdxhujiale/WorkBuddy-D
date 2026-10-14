import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderKanban } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-picker";
import { InputTag } from "@/components/ui/input-tag";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { PixelShield } from "@/components/pixel/PixelIcons";
import { createProjectId } from "@/lib/entityIds";
import { cn } from "@/lib/utils";
import type { Priority, Project, ProjectTemplate } from "../types";
import {
  projectFormSchema,
  type ProjectFormValues,
} from "../schemas/projectSchemas";

export interface ProjectCreateModalProps {
  open: boolean;
  templates: ProjectTemplate[];
  onOpenChange: (open: boolean) => void;
  onCreate: (project: Project, templateId?: string) => Promise<void>;
}

export function ProjectCreateModal({
  open,
  templates,
  onOpenChange,
  onCreate,
}: ProjectCreateModalProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema) as any,
    defaultValues: {
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      ownerName: "",
      priority: "medium",
      tags: [],
      templateId: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        description: "",
        startDate: "",
        endDate: "",
        ownerName: "",
        priority: "medium",
        tags: [],
        templateId: "",
      });
      setSubmitError("");
    }
  }, [open, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    setSubmitError("");
    try {
      const now = Date.now();
      const newProject: Project = {
        id: createProjectId(),
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        status: "not_started",
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        priority: values.priority,
        tags: values.tags.map((t: string) => t.trim()).filter(Boolean),
        ownerName: values.ownerName?.trim() || undefined,
        createdAt: now,
        updatedAt: 0,
      };

      await onCreate(newProject, values.templateId || undefined);
      onOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : isPixelTheme
          ? "发起冒险项目失败"
          : "创建项目失败"
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2">
          {isPixelTheme ? (
            <PixelShield size={18} className="text-amber-500 shrink-0" />
          ) : (
            <FolderKanban size={18} className="text-primary shrink-0" />
          )}
          <span
            className={
              isPixelTheme
                ? "font-mono font-bold text-amber-950 dark:text-amber-100"
                : ""
            }
          >
            {isPixelTheme ? "⚔️ 发起冒险项目" : "新建项目"}
          </span>
        </div>
      }
      onCancel={() => onOpenChange(false)}
      onOk={() => void handleSubmit()}
      okText={
        isPixelTheme
          ? saving
            ? "刻印中…"
            : "⚔️ 发起冒险"
          : saving
          ? "创建中…"
          : "创建项目"
      }
      cancelText={isPixelTheme ? "放弃" : "取消"}
      okDisabled={saving}
      width={560}
    >
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className={cn(
            "flex flex-col gap-3.5 py-1 text-foreground",
            isPixelTheme && "font-mono"
          )}
        >
          <p className="text-xs text-muted-foreground -mt-1 mb-1">
            {isPixelTheme
              ? "📜 项目从未启动状态出发；选用公会模板将自动生成阶段与相关委托任务。"
              : "项目从未开始启动；选用模板会生成阶段和同一批任务中心任务。"}
          </p>

          {/* Project Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs font-semibold text-muted-foreground">
                    {isPixelTheme ? "冒险项目代号 / 名称" : "项目名称"}
                  </FormLabel>
                  <span className="text-destructive">*</span>
                </div>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    placeholder={
                      isPixelTheme ? "例如：巨龙遗迹远征计划" : "输入项目名称"
                    }
                    className="h-9.5"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground">
                  {isPixelTheme ? "冒险委托简述" : "项目说明"}
                </FormLabel>
                <FormControl>
                  <textarea
                    rows={2}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder={
                      isPixelTheme
                        ? "描述本次冒险项目的背景、目标与通关要求..."
                        : "输入项目描述或背景说明..."
                    }
                    className={cn(
                      "w-full px-3 py-2 text-sm outline-none transition-colors resize-none",
                      isPixelTheme
                        ? "rounded-xs border-2 border-border bg-muted/60 hover:bg-muted focus:border-amber-600 focus:bg-background font-mono shadow-[1px_1px_0px_#000]"
                        : "rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
                    )}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date Range */}
          <FormItem>
            <FormLabel className="text-xs font-semibold text-muted-foreground">
              {isPixelTheme ? "冒险历程周期" : "项目周期"}
            </FormLabel>
            <FormControl>
              <DateRangePicker
                value={
                  form.watch("startDate") || form.watch("endDate")
                    ? [form.watch("startDate"), form.watch("endDate")]
                    : undefined
                }
                placeholder={
                  isPixelTheme
                    ? ["启程之日", "凯旋之日"]
                    : ["开始日期", "结束日期"]
                }
                onChange={(dateStrings) => {
                  const [start, end] = dateStrings;
                  form.setValue("startDate", start || "");
                  form.setValue("endDate", end || "");
                }}
                className="w-full"
              />
            </FormControl>
            {form.formState.errors.endDate && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.endDate.message}
              </p>
            )}
          </FormItem>

          {/* Owner & Priority (2 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-muted-foreground">
                    {isPixelTheme ? "冒险队长 / 领队" : "负责人"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={
                        isPixelTheme ? "例如：勇者艾伦" : "例如：李明"
                      }
                      className="h-9.5"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-muted-foreground">
                    {isPixelTheme ? "危险等级" : "优先级"}
                  </FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onChange={(val) => field.onChange(val as Priority)}
                      className="w-full"
                    >
                      <Select.Option value="urgent">
                        {isPixelTheme ? "🔥 史诗 (紧急)" : "紧急优先级"}
                      </Select.Option>
                      <Select.Option value="high">
                        {isPixelTheme ? "🔴 困难 (高)" : "高优先级"}
                      </Select.Option>
                      <Select.Option value="medium">
                        {isPixelTheme ? "🟡 普通 (中)" : "中优先级"}
                      </Select.Option>
                      <Select.Option value="low">
                        {isPixelTheme ? "🟢 简易 (低)" : "低优先级"}
                      </Select.Option>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Tags */}
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground">
                  {isPixelTheme ? "契约标签" : "项目标签"}
                </FormLabel>
                <FormControl>
                  <InputTag
                    value={field.value}
                    onChange={(val) => field.onChange(val as string[])}
                    placeholder="输入标签后按回车添加..."
                    className="w-full min-h-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Template */}
          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground">
                  {isPixelTheme ? "套用公会战术蓝图" : "套用模板"}
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? ""}
                    onChange={(val) => field.onChange(String(val || ""))}
                    className="w-full"
                    placeholder={
                      isPixelTheme ? "📜 从空白冒险开始" : "从空白项目开始"
                    }
                  >
                    <Select.Option value="">
                      {isPixelTheme ? "📜 从空白冒险开始" : "从空白项目开始"}
                    </Select.Option>
                    {templates.map((template) => (
                      <Select.Option value={template.id} key={template.id}>
                        {template.name}
                      </Select.Option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit Error */}
          {submitError && (
            <p className="text-xs text-destructive mt-1 font-mono" role="alert">
              ⚠️ {submitError}
            </p>
          )}
        </form>
      </Form>
    </Modal>
  );
}
