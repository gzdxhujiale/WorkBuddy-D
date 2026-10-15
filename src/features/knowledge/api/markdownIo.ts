import type { Note } from "../types";

export type ImportedMarkdownFile = { title: string; content: string };

export function extractTitleFromMarkdown(filename: string, content: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match && h1Match[1]?.trim()) {
    return h1Match[1].trim();
  }
  const cleanName = filename.replace(/\.[^/.]+$/, "").trim();
  return cleanName || "未命名笔记";
}

export async function pickMarkdownFile(): Promise<ImportedMarkdownFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.txt";

    let resolved = false;
    const safeResolve = (val: ImportedMarkdownFile | null) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    input.oncancel = () => {
      safeResolve(null);
    };

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const title = extractTitleFromMarkdown(file.name, text);
          safeResolve({ title, content: text });
        } catch {
          safeResolve(null);
        }
      } else {
        safeResolve(null);
      }
    };

    input.click();
  });
}

export async function saveMarkdownFile(defaultName: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", defaultName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function pickMultipleMarkdownFiles(): Promise<ImportedMarkdownFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.txt";
    input.multiple = true;

    let resolved = false;
    const safeResolve = (val: ImportedMarkdownFile[]) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    input.oncancel = () => {
      safeResolve([]);
    };

    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length === 0) {
        safeResolve([]);
        return;
      }
      const results: ImportedMarkdownFile[] = [];
      for (const file of files) {
        try {
          const text = await file.text();
          const title = extractTitleFromMarkdown(file.name, text);
          results.push({ title, content: text });
        } catch {
          // Skip unreadable file
        }
      }
      safeResolve(results);
    };

    input.click();
  });
}

export async function saveMultipleMarkdownFiles(files: Array<{ title: string; content: string }>): Promise<void> {
  for (const file of files) {
    await saveMarkdownFile(file.title ? file.title + ".md" : "未命名笔记.md", file.content);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function exportNotesToMarkdown(
  notes: Note[],
  selectedNoteIds: string[],
  convertJsonToMd: (content: string) => string,
  loadNoteFn?: (id: string) => Promise<Note | null>,
): Promise<number> {
  const notesToExport = await Promise.all(
    notes
      .filter((n) => selectedNoteIds.includes(n.id))
      .map(async (note) => (note.contentLoaded ? note : loadNoteFn ? await loadNoteFn(note.id) : note)),
  );
  const completeNotes = notesToExport.filter((note): note is Note => Boolean(note));
  if (completeNotes.length === 0) return 0;
  const files = completeNotes.map((n) => ({ title: n.title, content: convertJsonToMd(n.content ?? "") }));
  await saveMultipleMarkdownFiles(files);
  return files.length;
}
