import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadTemplates, upsertTemplate, deleteTemplate } from '@/services/listsService';
import type { Template } from '@/types/lists';
import { FileText, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/syncEngine';
import { Modal } from '@/components/ui/modal';

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
    const newTpl: Template = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    };
    await upsertTemplate(newTpl);
    queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEY });
  };

  const updateTemplate = async (id: string, updates: Partial<Template>) => {
    const data = queryClient.getQueryData<Template[]>(TEMPLATE_QUERY_KEY) ?? await loadTemplates();
    const target = data.find((t) => t.id === id);
    if (target) {
      await upsertTemplate({ ...target, ...updates });
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEY });
    }
  };

  const deleteTemplateFn = async (id: string) => {
    await deleteTemplate(id);
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
  return (
    <Modal
      visible={true}
      title="选择笔记模板"
      onCancel={onClose}
      footer={null}
      width={640}
    >
      <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[60vh]">
        {templates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            暂无自定义模板，可在笔记编辑器菜单中「保存为模板」
          </div>
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md cursor-pointer transition-all h-36"
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2 truncate">
                  <FileText size={16} className="text-primary shrink-0" />
                  <span>{tpl.name}</span>
                </div>
              </div>

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(tpl.id);
                  }}
                  className="self-end p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
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
