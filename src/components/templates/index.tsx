import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadTemplates, upsertTemplate, deleteTemplate } from '@/services/listsService';
import type { Template } from '@/types/lists';
import { FileText, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/syncEngine';

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in-0">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">选择笔记模板</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-4">
          {templates.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400 dark:text-slate-500">
              暂无自定义模板，可在笔记编辑器菜单中「保存为模板」
            </div>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => onSelect(tpl)}
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all h-40"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 truncate">
                    <FileText size={16} className="text-indigo-500 shrink-0" />
                    <span>{tpl.name}</span>
                  </div>
                </div>

                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(tpl.id);
                    }}
                    className="self-end p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
