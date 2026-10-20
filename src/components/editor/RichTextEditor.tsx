import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";
import type { RichTextEditorProps, NoteWikilinkItem } from "./types";
import { parseContent } from "./markdown/markdownService";
import { createMinimalExtensions } from "./presets/minimal";
import { createCompactExtensions } from "./presets/compact";
import { createFullExtensions } from "./presets/full";
import {
  SlashCommandExtension,
  SlashCommandList,
  defaultSlashCommands,
  type SlashCommandItem,
  type SlashCommandListRef,
} from "./menus/SlashCommandPalette";
import {
  WikilinkSuggestionList,
  type WikilinkSuggestionListRef,
} from "./menus/WikilinkSuggestionList";
import { EditorBubbleMenu } from "./menus/BubbleMenu";
import { ImageBubbleMenu } from "./menus/ImageBubbleMenu";
import { CompactToolbar } from "./toolbars/CompactToolbar";
import { FullToolbar } from "./toolbars/FullToolbar";

export function RichTextEditor({
  content,
  onChange,
  preset = "full",
  placeholder = "写下内容，或输入 / 使用命令...",
  className,
  editable = true,
  showToolbar = true,
  hideHighlight = false,
  hideCallout = false,
  autofocus,
  onNavigateNote,
  notesForWikilinks = [],
  footerLeft,
  collabExtensions = [],
}: RichTextEditorProps) {
  const { isPixelTheme } = useAppThemeStyle();

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notesForWikilinksRef = useRef(notesForWikilinks);
  notesForWikilinksRef.current = notesForWikilinks;

  const onNavigateNoteRef = useRef(onNavigateNote);
  onNavigateNoteRef.current = onNavigateNote;

  const isUpdatingFromEditorRef = useRef(false);
  const lastContentRef = useRef(content);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Suggestion state for Slash Commands
  const [slashState, setSlashState] = useState<{
    isOpen: boolean;
    items: SlashCommandItem[];
    command: (item: SlashCommandItem) => void;
    rect: DOMRect | null;
  }>({
    isOpen: false,
    items: [],
    command: () => {},
    rect: null,
  });
  const slashListRef = useRef<SlashCommandListRef>(null);

  // Suggestion state for Wikilinks
  const [wikilinkState, setWikilinkState] = useState<{
    isOpen: boolean;
    items: NoteWikilinkItem[];
    command: (item: NoteWikilinkItem) => void;
    rect: DOMRect | null;
  }>({
    isOpen: false,
    items: [],
    command: () => {},
    rect: null,
  });
  const wikilinkListRef = useRef<WikilinkSuggestionListRef>(null);

  const extensions = useMemo(() => {
    const slashExt = SlashCommandExtension.configure({
      suggestion: {
        char: "/",
        items: ({ query }) => {
          if (!query) return defaultSlashCommands;
          const q = query.toLowerCase();
          return defaultSlashCommands.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q)
          );
        },
        render: () => ({
          onStart: (props) => {
            setSlashState({
              isOpen: true,
              items: props.items,
              command: props.command,
              rect: props.clientRect?.() || null,
            });
          },
          onUpdate: (props) => {
            setSlashState((prev) => ({
              ...prev,
              isOpen: true,
              items: props.items,
              command: props.command,
              rect: props.clientRect?.() || null,
            }));
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              setSlashState((prev) => ({ ...prev, isOpen: false }));
              return true;
            }
            return slashListRef.current?.onKeyDown(props) || false;
          },
          onExit: () => {
            setSlashState({
              isOpen: false,
              items: [],
              command: () => {},
              rect: null,
            });
          },
        }),
      },
    });

    let baseExtensions: any[] = [];
    if (preset === "minimal") {
      baseExtensions = createMinimalExtensions(placeholder);
    } else if (preset === "compact") {
      baseExtensions = [...createCompactExtensions(placeholder), slashExt];
    } else {
      // full preset
      baseExtensions = [
        ...createFullExtensions({
          placeholder,
          getNotesForWikilinks: () => notesForWikilinksRef.current,
          onNavigateNote: (noteId) => onNavigateNoteRef.current?.(noteId),
          renderWikilinkPopup: () => ({
            onStart: (props: any) => {
              setWikilinkState({
                isOpen: true,
                items: props.items,
                command: props.command,
                rect: props.clientRect?.() || null,
              });
            },
            onUpdate: (props: any) => {
              setWikilinkState((prev) => ({
                ...prev,
                isOpen: true,
                items: props.items,
                command: props.command,
                rect: props.clientRect?.() || null,
              }));
            },
            onKeyDown: (props: any) => {
              if (props.event.key === "Escape") {
                setWikilinkState((prev) => ({ ...prev, isOpen: false }));
                return true;
              }
              return wikilinkListRef.current?.onKeyDown(props) || false;
            },
            onExit: () => {
              setWikilinkState({
                isOpen: false,
                items: [],
                command: () => {},
                rect: null,
              });
            },
          }),
        }),
        slashExt,
      ];
    }

    return collabExtensions && collabExtensions.length > 0
      ? [...baseExtensions, ...collabExtensions]
      : baseExtensions;
  }, [preset, placeholder, collabExtensions]);

  const editor = useEditor(
    {
      immediatelyRender: true,
      editable,
      autofocus: autofocus ?? false,
      extensions,
      content: collabExtensions && collabExtensions.length > 0 ? undefined : parseContent(content),
      onUpdate: ({ editor: currentEditor }) => {
        // Debounce serialization to 150ms to eliminate per-keystroke full-tree lag
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          if (!currentEditor || currentEditor.isDestroyed) return;
          const jsonStr = JSON.stringify(currentEditor.getJSON());
          if (jsonStr === lastContentRef.current) return;
          lastContentRef.current = jsonStr;
          isUpdatingFromEditorRef.current = true;
          onChangeRef.current(jsonStr);
          queueMicrotask(() => {
            isUpdatingFromEditorRef.current = false;
          });
        }, 150);
      },
      editorProps: {
        attributes: {
          spellcheck: "true",
        },
      },
    },
    [preset]
  );

  // Flush debounced changes on unmount ONLY if there is an active pending timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        if (editor && !editor.isDestroyed) {
          const jsonStr = JSON.stringify(editor.getJSON());
          if (jsonStr !== lastContentRef.current) {
            lastContentRef.current = jsonStr;
            onChangeRef.current(jsonStr);
          }
        }
      }
    };
  }, [editor]);

  // Synchronize editable state
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Synchronize incoming content changes from outside
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (collabExtensions && collabExtensions.length > 0) return;
    if (isUpdatingFromEditorRef.current) return;
    if (content === lastContentRef.current) return;

    lastContentRef.current = content;

    const nextContent = parseContent(content);
    if (typeof nextContent === "string") {
      if (editor.getHTML() !== nextContent) {
        const { from, to } = editor.state.selection;
        const isFocused = editor.isFocused;
        editor.commands.setContent(nextContent, { emitUpdate: false });
        if (isFocused) {
          const maxPos = editor.state.doc.content.size;
          editor.commands.setTextSelection({
            from: Math.min(from, maxPos),
            to: Math.min(to, maxPos),
          });
        }
      }
      return;
    }

    try {
      const nextDoc = editor.schema.nodeFromJSON(nextContent);
      if (editor.state.doc.eq(nextDoc)) {
        return;
      }
    } catch {
      const currentJson = JSON.stringify(editor.getJSON());
      if (currentJson === JSON.stringify(nextContent)) {
        return;
      }
    }

    const { from, to } = editor.state.selection;
    const isFocused = editor.isFocused;
    editor.commands.setContent(nextContent, { emitUpdate: false });
    if (isFocused) {
      const maxPos = editor.state.doc.content.size;
      editor.commands.setTextSelection({
        from: Math.min(from, maxPos),
        to: Math.min(to, maxPos),
      });
    }
  }, [content, editor]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-type="wikilink"]');
    if (target) {
      const noteId = target.getAttribute("data-note-id");
      if (noteId && onNavigateNote) {
        e.preventDefault();
        onNavigateNote(noteId);
        return;
      }
    }

    const imgTarget = (e.target as HTMLElement).closest("img");
    if (imgTarget && editor && !editor.isDestroyed) {
      try {
        const pos = editor.view.posAtDOM(imgTarget, 0);
        if (typeof pos === "number" && pos >= 0) {
          const $pos = editor.state.doc.resolve(pos);
          for (let d = $pos.depth; d >= 0; d--) {
            const node = $pos.node(d);
            if (node.type.name === "image") {
              const nodePos = $pos.before(d);
              editor.view.dispatch(
                editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, nodePos))
              );
              return;
            }
          }
          const nodeAtPos = editor.state.doc.nodeAt(pos);
          if (nodeAtPos && nodeAtPos.type.name === "image") {
            editor.view.dispatch(
              editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos))
            );
          }
        }
      } catch {
        // Safe fallback
      }
    }
  };

  if (!editor) {
    return <div className="flex min-h-0 flex-1 bg-card" />;
  }

  const characterCount = editor.storage.characterCount?.characters?.() ?? null;

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-card text-foreground selection:bg-[#bfdbfe] selection:text-slate-900 dark:selection:bg-blue-900/80 dark:selection:text-blue-100",
        isPixelTheme &&
          "font-mono selection:bg-[#d97706] selection:text-white dark:selection:bg-[#d97706]",
        className
      )}
    >
      {showToolbar && preset === "compact" && (
        <CompactToolbar editor={editor} isPixelTheme={isPixelTheme} />
      )}

      {showToolbar && preset === "full" && (
        <FullToolbar
          editor={editor}
          isPixelTheme={isPixelTheme}
          hideHighlight={hideHighlight}
          hideCallout={hideCallout}
        />
      )}

      {preset !== "minimal" && (
        <>
          <EditorBubbleMenu editor={editor} isPixelTheme={isPixelTheme} />
          <ImageBubbleMenu editor={editor} isPixelTheme={isPixelTheme} />
        </>
      )}

      {/* Editor Content Scroll Container */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto relative">
        <EditorContent
          editor={editor}
          className={cn(
            "flex min-h-full min-w-0 flex-1 flex-col",
            "[&_.ProseMirror]:min-h-full [&_.ProseMirror]:w-full [&_.ProseMirror]:box-border [&_.ProseMirror]:bg-card [&_.ProseMirror]:pt-3.5 [&_.ProseMirror]:px-5 [&_.ProseMirror]:pb-12 [&_.ProseMirror]:outline-none",
            "[&_.ProseMirror_p]:mt-0 [&_.ProseMirror_p]:mb-1.5 [&_.ProseMirror_p]:text-sm [&_.ProseMirror_p]:leading-relaxed",
            "[&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-3 [&_.ProseMirror_h1]:mb-1.5",
            "[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-2.5 [&_.ProseMirror_h2]:mb-1.5",
            "[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:mb-1",
            "[&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:rounded-r-md [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-primary/50 [&_.ProseMirror_blockquote]:bg-muted/40 [&_.ProseMirror_blockquote]:px-4 [&_.ProseMirror_blockquote]:py-2 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-muted-foreground",
            "[&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-border [&_.ProseMirror_pre]:bg-muted/80 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-xs",
            "[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre_code]:text-inherit",
            "[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-xs [&_.ProseMirror_code]:font-medium",
            "[&_.ProseMirror_mark]:bg-amber-200/80 [&_.ProseMirror_mark]:rounded-xs [&_.ProseMirror_mark]:px-0.5 dark:[&_.ProseMirror_mark]:bg-amber-900/60 dark:[&_.ProseMirror_mark]:text-amber-100",
            "[&_.ProseMirror_table]:my-3 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-border",
            "[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-muted/60 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:text-xs",
            "[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:text-xs",
            "[&_.ProseMirror_details]:my-3 [&_.ProseMirror_details]:rounded-lg [&_.ProseMirror_details]:border [&_.ProseMirror_details]:border-border [&_.ProseMirror_details]:bg-muted/20 [&_.ProseMirror_details]:p-2.5",
            "[&_.ProseMirror_summary]:cursor-pointer [&_.ProseMirror_summary]:font-medium [&_.ProseMirror_summary]:select-none [&_.ProseMirror_summary]:rounded [&_.ProseMirror_summary]:px-2 [&_.ProseMirror_summary]:py-1 [&_.ProseMirror_summary]:hover:bg-muted/60",
            "[&_.ProseMirror_div[data-type='details-content']]:mt-2 [&_.ProseMirror_div[data-type='details-content']]:border-t [&_.ProseMirror_div[data-type='details-content']]:border-border/50 [&_.ProseMirror_div[data-type='details-content']]:pt-2 [&_.ProseMirror_div[data-type='details-content']]:pl-3",
            "[&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']]:pl-1",
            "[&_.ProseMirror_li.tiptap-task-item]:flex [&_.ProseMirror_li.tiptap-task-item]:flex-row [&_.ProseMirror_li.tiptap-task-item]:items-start [&_.ProseMirror_li.tiptap-task-item]:gap-2",
            "[&_.ProseMirror_li[data-checked]]:flex [&_.ProseMirror_li[data-checked]]:flex-row [&_.ProseMirror_li[data-checked]]:items-start [&_.ProseMirror_li[data-checked]]:gap-2",
            "[&_.ProseMirror_li[data-checked]>label]:select-none [&_.ProseMirror_li[data-checked]>label]:mt-0.5 [&_.ProseMirror_li[data-checked]>label]:shrink-0",
            "[&_.ProseMirror_li[data-checked]>div]:min-w-0 [&_.ProseMirror_li[data-checked]>div]:flex-1 [&_.ProseMirror_li[data-checked]>div>p]:m-0",
            "[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_.is-editor-empty:first-child::before]:opacity-65 [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            isPixelTheme &&
              "[&_.ProseMirror]:font-mono [&_.ProseMirror_pre]:border-2 [&_.ProseMirror_pre]:border-border/90 [&_.ProseMirror_pre]:rounded-xs [&_.ProseMirror_details]:border-2 [&_.ProseMirror_details]:border-border/90 [&_.ProseMirror_details]:rounded-xs [&_.ProseMirror_table]:border-2 [&_.ProseMirror_table]:border-border/90"
          )}
        />
      </div>

      {/* Slash Command Suggestion Popup */}
      {slashState.isOpen && slashState.rect && (
        <div
          style={{
            position: "fixed",
            left: Math.max(8, Math.min(slashState.rect.left, window.innerWidth - 320)),
            top: Math.min(slashState.rect.bottom + 6, window.innerHeight - 300),
            zIndex: 60,
          }}
        >
          <SlashCommandList
            ref={slashListRef}
            items={slashState.items}
            command={(item) => {
              slashState.command(item);
              setSlashState({
                isOpen: false,
                items: [],
                command: () => {},
                rect: null,
              });
            }}
            isPixelTheme={isPixelTheme}
          />
        </div>
      )}

      {/* Wikilink Suggestion Popup */}
      {wikilinkState.isOpen && wikilinkState.rect && (
        <div
          style={{
            position: "fixed",
            left: Math.max(8, Math.min(wikilinkState.rect.left, window.innerWidth - 320)),
            top: Math.min(wikilinkState.rect.bottom + 6, window.innerHeight - 260),
            zIndex: 60,
          }}
        >
          <WikilinkSuggestionList
            ref={wikilinkListRef}
            items={wikilinkState.items}
            command={(item) => {
              wikilinkState.command(item);
              setWikilinkState({
                isOpen: false,
                items: [],
                command: () => {},
                rect: null,
              });
            }}
            isPixelTheme={isPixelTheme}
          />
        </div>
      )}

      {/* Unified Status & Word Count Footer */}
      {(footerLeft || (preset === "full" && characterCount !== null)) && (
        <footer
          className={cn(
            "flex h-7.5 shrink-0 items-center justify-between px-3 text-xs text-muted-foreground select-none border-t border-border/60 bg-muted/20",
            isPixelTheme && "font-mono border-t-2 border-border/80 bg-amber-50/40 dark:bg-amber-950/40"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {footerLeft}
          </div>
          {characterCount !== null && (
            <div
              className={cn(
                "shrink-0 text-[11px] text-muted-foreground/75",
                isPixelTheme && "font-mono font-bold"
              )}
            >
              {characterCount} 字
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
