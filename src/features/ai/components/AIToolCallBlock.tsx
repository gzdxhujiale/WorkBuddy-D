import React, { useState } from "react";
import { Collapse, Tag, Spin } from "@douyinfe/semi-ui";
import {
  IconTerminal,
  IconCheckCircleStroked,
  IconClear,
  IconChevronDown,
  IconChevronRight,
} from "@douyinfe/semi-icons";
import type { ToolCallItem } from "../types";


interface AIToolCallBlockProps {
  toolCalls?: ToolCallItem[];
}

export const AIToolCallBlock: React.FC<AIToolCallBlockProps> = ({ toolCalls = [] }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return null;
  }

  const getStatusBadge = (status: ToolCallItem["status"], durationMs?: number) => {
    switch (status) {
      case "running":
      case "pending":
        return (
          <Tag color="amber" type="light" size="small" className="flex items-center gap-1 font-mono text-[11px]">
            <Spin size="small" />
            执行中
          </Tag>
        );
      case "success":
        return (
          <Tag color="green" type="light" size="small" className="flex items-center gap-1 font-mono text-[11px]">
            <IconCheckCircleStroked size="small" />
            已完成 {durationMs ? `(${durationMs}ms)` : ""}
          </Tag>
        );
      case "error":
        return (
          <Tag color="red" type="light" size="small" className="flex items-center gap-1 font-mono text-[11px]">
            <IconClear size="small" />
            失败
          </Tag>
        );
      default:
        return null;
    }
  };

  return (
    <div className="my-2 space-y-2">
      {toolCalls.map((tc, idx) => {
        const itemKey = tc.id || `tool-${idx}`;
        const isExpanded = activeKeys.includes(itemKey);

        return (
          <div
            key={itemKey}
            className="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 overflow-hidden shadow-2xs"
          >
            <Collapse
              activeKey={activeKeys}
              onChange={(keys) => {
                const arr = Array.isArray(keys) ? keys : [keys];
                setActiveKeys(arr.filter((k): k is string => typeof k === "string"));
              }}
              style={{ border: "none", background: "transparent" }}
            >
              <Collapse.Panel
                itemKey={itemKey}
                header={
                  <div className="flex items-center justify-between w-full py-1 text-xs select-none">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                        <IconTerminal size="small" />
                      </div>
                      <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                        {tc.name}
                      </span>
                      {getStatusBadge(tc.status, tc.duration_ms)}
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 text-[11px]">
                      <span>{isExpanded ? "收起" : "入参与回包"}</span>
                      {isExpanded ? (
                        <IconChevronDown size="small" />
                      ) : (
                        <IconChevronRight size="small" />
                      )}
                    </div>
                  </div>
                }
                showArrow={false}
                style={{ border: "none" }}
              >
                <div className="px-3 pb-3 pt-1 border-t border-gray-200/50 dark:border-gray-800/80 space-y-2 text-xs font-mono">
                  {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                    <div>
                      <div className="text-[11px] text-gray-400 mb-0.5">调用参数:</div>
                      <pre className="p-2 rounded bg-gray-100 dark:bg-gray-950/70 text-gray-700 dark:text-gray-300 text-[11px] overflow-x-auto max-h-36">
                        {JSON.stringify(tc.arguments, null, 2)}
                      </pre>
                    </div>
                  )}
                  {tc.result && (
                    <div>
                      <div className="text-[11px] text-gray-400 mb-0.5">执行回包:</div>
                      <pre className="p-2 rounded bg-gray-100 dark:bg-gray-950/70 text-gray-700 dark:text-gray-300 text-[11px] overflow-x-auto max-h-36">
                        {typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>
        );
      })}
    </div>
  );
};
