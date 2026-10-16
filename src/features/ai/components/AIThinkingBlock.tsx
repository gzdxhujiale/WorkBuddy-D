import React, { useState, useEffect, useRef } from "react";
import { Toast } from "@douyinfe/semi-ui";
import { IconChevronRight, IconChevronDown, IconCopy } from "@douyinfe/semi-icons";

interface AIThinkingBlockProps {
  content?: string;
  isGenerating?: boolean;
  durationMs?: number;
}

export const AIThinkingBlock: React.FC<AIThinkingBlockProps> = ({
  content = "",
  isGenerating = false,
  durationMs,
}) => {
  // During active generation, default to expanded; when finished, default to collapsed
  const [isExpanded, setIsExpanded] = useState<boolean>(isGenerating);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(() =>
    typeof durationMs === "number" && durationMs > 0
      ? Math.max(1, Math.round(durationMs / 1000))
      : null
  );
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Live seconds timer during generation
  useEffect(() => {
    if (isGenerating) {
      setIsExpanded(true);
      startTimeRef.current = Date.now() - (durationMs || 0);
      setElapsedSeconds(
        typeof durationMs === "number" && durationMs > 0
          ? Math.max(1, Math.round(durationMs / 1000))
          : 1
      );
      timerRef.current = setInterval(() => {
        const secs = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setElapsedSeconds(secs);
      }, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (typeof durationMs === "number" && durationMs > 0) {
        setElapsedSeconds(Math.max(1, Math.round(durationMs / 1000)));
      } else if (!durationMs) {
        setElapsedSeconds(null);
      }
      // When thinking finishes, automatically collapse into single line
      setIsExpanded(false);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isGenerating, durationMs]);

  if (!content.trim() && !isGenerating) {
    return null;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content).then(() => {
      Toast.success("思考过程已复制");
    });
  };

  return (
    <div className="my-2 select-text transition-all">
      {/* Header Toggle Line */}
      <div className="flex items-center gap-2 group">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-normal transition-colors cursor-pointer select-none py-0.5"
        >
          {isGenerating ? (
            <>
              <span>Thinking{elapsedSeconds ? ` for ${elapsedSeconds}s` : "..."}</span>
              <IconChevronDown size="small" className="text-gray-400 group-hover:text-gray-600 transition-transform" />
            </>
          ) : (
            <>
              <span>{elapsedSeconds ? `Thought for ${elapsedSeconds}s` : "Thought"}</span>
              {isExpanded ? (
                <IconChevronDown size="small" className="text-gray-400 group-hover:text-gray-600 transition-transform" />
              ) : (
                <IconChevronRight size="small" className="text-gray-400 group-hover:text-gray-600 transition-transform" />
              )}
            </>
          )}
        </button>

        {/* Copy button when expanded */}
        {isExpanded && content.trim() && (
          <button
            type="button"
            onClick={handleCopy}
            title="复制思考过程"
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity p-0.5"
          >
            <IconCopy size="small" />
          </button>
        )}
      </div>

      {/* Expanded Thinking Body (Inline & Subtle) */}
      {isExpanded && (
        <div className="mt-1.5 pl-2.5 border-l-2 border-gray-200 dark:border-gray-800 text-xs leading-relaxed text-gray-600/90 dark:text-gray-400/90 whitespace-pre-wrap break-words font-sans max-h-96 overflow-y-auto">
          {content || (
            <span className="italic text-gray-400 animate-pulse">正在整理推理链路...</span>
          )}
        </div>
      )}
    </div>
  );
};
