import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadTemplates, upsertTemplate, deleteTemplate } from '@/services/knowledgeService';
import type { KnowledgeTemplate } from '@/types/knowledge';
import { FileText, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/syncEngine';
import { Modal } from '@/components/ui/modal';

import { useAppThemeStyle } from '@/hooks/useAppThemeStyle';
import { PixelScroll } from '@/components/pixel/PixelIcons';
import { cn } from '@/lib/utils';

export function useTemplateData(enabled = true) {
  const { userId } = useAuth();
  const queryKey = queryKeys.templates(userId);
  return useQuery({
    queryKey,
    queryFn: () => loadTemplates(),
    enabled,
  });
}

export function useTemplateActions() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const TEMPLATE_QUERY_KEY = queryKeys.templates(userId);

  const addTemplate = async (name: string, content: string | Record<string, unknown>) => {
    const newTpl: KnowledgeTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    };
    await upsertTemplate(newTpl);
    queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEY });
  };

  const updateTemplate = async (id: string, updates: Partial<KnowledgeTemplate>) => {
    const data = queryClient.getQueryData<KnowledgeTemplate[]>(TEMPLATE_QUERY_KEY) ?? await loadTemplates();
    const target = data.find((t) => t.id === id);
    if (target) {
      await upsertTemplate({ ...target, ...updates });
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEY });
    }
  };

  const deleteTemplateFn = async (id: string) => {
    const data = queryClient.getQueryData<KnowledgeTemplate[]>(TEMPLATE_QUERY_KEY) ?? await loadTemplates();
    const target = data.find((template) => template.id === id);
    if (!target) return;
    await deleteTemplate(target);
    queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEY });
  };

  return { addTemplate, updateTemplate, deleteTemplate: deleteTemplateFn };
}

interface TemplateModalProps {
  templates: any[];
  onSelect: (template: any) => void;
  onClose: () => void;
  onEdit?: (id: string, name: string, content: string) => void;
  onDelete?: (id: string) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  templates,
  onSelect,
  onClose,
  onDelete,
}) => {
  const { isPixelTheme } = useAppThemeStyle();

  return (
    <Modal
      visible={true}
      title={isPixelTheme ? "📜 挑选知识卷轴模板" : "选择笔记模板"}
      onCancel={onClose}
      footer={null}
      width={640}
    >
      <div className={cn("overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[60vh]", isPixelTheme && "font-mono")}>
        {templates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            {isPixelTheme
              ? "暂无自定义卷轴模板，可在笔记编辑器右上角「保存为模板」"
              : "暂无自定义模板，可在笔记编辑器菜单中「保存为模板」"}
          </div>
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className={cn(
                "group relative flex flex-col justify-between p-4 cursor-pointer transition-all h-36 select-none",
                isPixelTheme
                  ? "rounded-xs border-2 border-border/90 bg-card hover:bg-amber-50/80 dark:hover:bg-amber-950/40 shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[4px_4px_0px_rgba(217,119,6,0.3)] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono"
                  : "rounded-xl border border-border bg-card hover:border-primary hover:shadow-md"
              )}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2 truncate">
                  {isPixelTheme ? (
                    <PixelScroll size={16} className="shrink-0" />
                  ) : (
                    <FileText size={16} className="text-primary shrink-0" />
                  )}
                  <span className={isPixelTheme ? "font-mono font-bold" : ""}>{tpl.name}</span>
                </div>
              </div>

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(tpl.id);
                  }}
                  className={cn(
                    "self-end p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer",
                    isPixelTheme ? "rounded-xs" : "rounded-md"
                  )}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
