import * as Y from "yjs";

export type DiffType = "added" | "removed" | "unchanged";

export interface DiffSpan {
  type: DiffType;
  text: string;
}

export type BlockType =
  | "paragraph"
  | "heading"
  | "code_block"
  | "list_item"
  | "blockquote"
  | "generic";

export interface DiffBlock {
  type: BlockType;
  level?: number;
  status: "added" | "removed" | "modified" | "unchanged";
  spans: DiffSpan[];
}

export interface DocumentDiffResult {
  blocks: DiffBlock[];
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

/**
 * Encodes a Uint8Array into a base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a base64 string into a Uint8Array.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Takes a snapshot of a Y.Doc and returns its binary representation.
 */
export function createDocSnapshot(doc: Y.Doc): Uint8Array {
  const snapshot = Y.snapshot(doc);
  return Y.encodeSnapshot(snapshot);
}

/**
 * Takes a snapshot of a Y.Doc and returns its base64 representation.
 */
export function createDocSnapshotBase64(doc: Y.Doc): string {
  return bytesToBase64(createDocSnapshot(doc));
}

/**
 * Restores a read-only Y.Doc from a given snapshot binary.
 */
export function restoreDocFromSnapshot(
  originDoc: Y.Doc,
  snapshotBytes: Uint8Array
): Y.Doc {
  if (originDoc.gc) {
    originDoc.gc = false;
  }
  const snapshot = Y.decodeSnapshot(snapshotBytes);
  return Y.createDocFromSnapshot(originDoc, snapshot);
}

/**
 * Restores a read-only Y.Doc from a given base64 snapshot string.
 */
export function restoreDocFromSnapshotBase64(
  originDoc: Y.Doc,
  base64Snapshot: string
): Y.Doc {
  return restoreDocFromSnapshot(originDoc, base64ToBytes(base64Snapshot));
}

export interface RawBlock {
  type: BlockType;
  level?: number;
  text: string;
}

/**
 * Extract structured blocks from a Y.Doc (inspecting Tiptap's 'default' XML fragment or text).
 */
export function extractBlocksFromYDoc(doc: Y.Doc): RawBlock[] {
  const fragment = doc.getXmlFragment("default");
  const blocks: RawBlock[] = [];

  if (fragment && fragment.length > 0) {
    for (let i = 0; i < fragment.length; i++) {
      const item = fragment.get(i);
      if (item instanceof Y.XmlElement) {
        const nodeName = item.nodeName.toLowerCase();
        let type: BlockType = "paragraph";
        let level: number | undefined;

        if (nodeName === "heading") {
          type = "heading";
          const lvl = item.getAttribute("level");
          level = typeof lvl === "number" ? lvl : lvl ? parseInt(String(lvl), 10) : 1;
        } else if (nodeName === "codeblock" || nodeName === "code_block") {
          type = "code_block";
        } else if (nodeName === "listitem" || nodeName === "list_item") {
          type = "list_item";
        } else if (nodeName === "blockquote") {
          type = "blockquote";
        } else if (nodeName === "bulletlist" || nodeName === "orderedlist") {
          for (let j = 0; j < item.length; j++) {
            const child = item.get(j);
            blocks.push({
              type: "list_item",
              text: child.toString(),
            });
          }
          continue;
        }

        blocks.push({
          type,
          level,
          text: item.toString(),
        });
      } else if (item instanceof Y.XmlText) {
        blocks.push({
          type: "paragraph",
          text: item.toString(),
        });
      }
    }
  }

  // Fallback: check shared text named "content" or lines of text
  if (blocks.length === 0) {
    const rawText = doc.getText("content").toString();
    if (rawText.trim().length > 0) {
      return parseTextToBlocks(rawText);
    }
  }

  return blocks;
}

/**
 * Parses raw text or markdown into blocks.
 */
export function parseTextToBlocks(text: string): RawBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: RawBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push({
        type: "blockquote",
        text: trimmed.slice(2),
      });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      blocks.push({
        type: "list_item",
        text: trimmed.replace(/^[-*+]\s+/, ""),
      });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      blocks.push({
        type: "list_item",
        text: trimmed.replace(/^\d+\.\s+/, ""),
      });
      continue;
    }

    if (trimmed.startsWith("```")) {
      blocks.push({
        type: "code_block",
        text: trimmed,
      });
      continue;
    }

    blocks.push({
      type: "paragraph",
      text: line,
    });
  }

  return blocks;
}

/**
 * Tokenizes a string into words, CJK characters, punctuation, and spaces for fine-grained diffing.
 */
export function tokenize(str: string): string[] {
  const matches = str.match(
    /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]|[a-zA-Z0-9_]+|\s+|[^\s\w\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/gu
  );
  return matches || [];
}

/**
 * Computes word-level diff spans between two strings using dynamic programming LCS.
 */
export function computeWordDiff(oldStr: string, newStr: string): DiffSpan[] {
  if (oldStr === newStr) {
    return oldStr ? [{ type: "unchanged", text: oldStr }] : [];
  }
  if (!oldStr) {
    return newStr ? [{ type: "added", text: newStr }] : [];
  }
  if (!newStr) {
    return oldStr ? [{ type: "removed", text: oldStr }] : [];
  }

  const a = tokenize(oldStr);
  const b = tokenize(newStr);
  const m = a.length;
  const n = b.length;

  if (m * n > 250000) {
    return [
      { type: "removed", text: oldStr },
      { type: "added", text: newStr },
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const rawSpans: DiffSpan[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      rawSpans.push({ type: "unchanged", text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawSpans.push({ type: "added", text: b[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawSpans.push({ type: "removed", text: a[i - 1] });
      i--;
    }
  }

  rawSpans.reverse();

  const mergedSpans: DiffSpan[] = [];
  for (const span of rawSpans) {
    if (mergedSpans.length > 0 && mergedSpans[mergedSpans.length - 1].type === span.type) {
      mergedSpans[mergedSpans.length - 1].text += span.text;
    } else {
      mergedSpans.push({ ...span });
    }
  }

  return mergedSpans;
}

/**
 * Computes block-level diffs between two arrays of raw blocks using LCS alignment.
 * Correctly handles line insertions/deletions, preventing cascade index mismatches.
 */
export function computeBlockDiffs(
  oldBlocks: RawBlock[],
  newBlocks: RawBlock[]
): DocumentDiffResult {
  const M = oldBlocks.length;
  const N = newBlocks.length;

  if (M === 0 && N === 0) {
    return { blocks: [], stats: { additions: 0, deletions: 0, unchanged: 0 } };
  }

  if (M === 0) {
    let additions = 0;
    const blocks: DiffBlock[] = newBlocks.map((b) => {
      additions += b.text.length;
      return {
        type: b.type,
        level: b.level,
        status: "added",
        spans: [{ type: "added", text: b.text }],
      };
    });
    return { blocks, stats: { additions, deletions: 0, unchanged: 0 } };
  }

  if (N === 0) {
    let deletions = 0;
    const blocks: DiffBlock[] = oldBlocks.map((b) => {
      deletions += b.text.length;
      return {
        type: b.type,
        level: b.level,
        status: "removed",
        spans: [{ type: "removed", text: b.text }],
      };
    });
    return { blocks, stats: { additions: 0, deletions, unchanged: 0 } };
  }

  // 1. Build Block-level LCS Table
  // Two blocks are identical if their text and type match.
  const dp: number[][] = Array.from({ length: M + 1 }, () => new Array(N + 1).fill(0));

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (
        oldBlocks[i - 1].text === newBlocks[j - 1].text &&
        oldBlocks[i - 1].type === newBlocks[j - 1].type
      ) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 2. Backtrack to find aligned operations
  type BlockOp =
    | { op: "keep"; oldIdx: number; newIdx: number }
    | { op: "delete"; oldIdx: number }
    | { op: "insert"; newIdx: number };

  const rawOps: BlockOp[] = [];
  let i = M;
  let j = N;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      oldBlocks[i - 1].text === newBlocks[j - 1].text &&
      oldBlocks[i - 1].type === newBlocks[j - 1].type
    ) {
      rawOps.push({ op: "keep", oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawOps.push({ op: "insert", newIdx: j - 1 });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawOps.push({ op: "delete", oldIdx: i - 1 });
      i--;
    }
  }

  rawOps.reverse();

  // 3. Cluster and pair adjacent deletes and inserts into "modified" blocks
  const resultBlocks: DiffBlock[] = [];
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  let opIdx = 0;
  while (opIdx < rawOps.length) {
    const curr = rawOps[opIdx];

    if (curr.op === "keep") {
      const b = newBlocks[curr.newIdx];
      unchanged += b.text.length;
      resultBlocks.push({
        type: b.type,
        level: b.level,
        status: "unchanged",
        spans: [{ type: "unchanged", text: b.text }],
      });
      opIdx++;
      continue;
    }

    // Collect contiguous deletes and inserts
    const delIndices: number[] = [];
    const insIndices: number[] = [];

    while (opIdx < rawOps.length && rawOps[opIdx].op !== "keep") {
      const op = rawOps[opIdx];
      if (op.op === "delete") delIndices.push(op.oldIdx);
      else if (op.op === "insert") insIndices.push(op.newIdx);
      opIdx++;
    }

    // Pair matching items
    const pairCount = Math.min(delIndices.length, insIndices.length);

    for (let p = 0; p < pairCount; p++) {
      const oldB = oldBlocks[delIndices[p]];
      const newB = newBlocks[insIndices[p]];

      const spans = computeWordDiff(oldB.text, newB.text);
      for (const span of spans) {
        if (span.type === "added") additions += span.text.length;
        else if (span.type === "removed") deletions += span.text.length;
        else unchanged += span.text.length;
      }

      resultBlocks.push({
        type: newB.type || oldB.type,
        level: newB.level ?? oldB.level,
        status: "modified",
        spans,
      });
    }

    // Leftover deletes
    for (let p = pairCount; p < delIndices.length; p++) {
      const oldB = oldBlocks[delIndices[p]];
      deletions += oldB.text.length;
      resultBlocks.push({
        type: oldB.type,
        level: oldB.level,
        status: "removed",
        spans: [{ type: "removed", text: oldB.text }],
      });
    }

    // Leftover inserts
    for (let p = pairCount; p < insIndices.length; p++) {
      const newB = newBlocks[insIndices[p]];
      additions += newB.text.length;
      resultBlocks.push({
        type: newB.type,
        level: newB.level,
        status: "added",
        spans: [{ type: "added", text: newB.text }],
      });
    }
  }

  return {
    blocks: resultBlocks,
    stats: { additions, deletions, unchanged },
  };
}

/**
 * Computes the diff between two Y.Doc instances.
 */
export function computeYDocDiff(oldDoc: Y.Doc, newDoc: Y.Doc): DocumentDiffResult {
  const oldBlocks = extractBlocksFromYDoc(oldDoc);
  const newBlocks = extractBlocksFromYDoc(newDoc);
  return computeBlockDiffs(oldBlocks, newBlocks);
}

/**
 * Computes the diff between a historical snapshot and the current live Y.Doc.
 */
export function computeSnapshotDiff(
  liveDoc: Y.Doc,
  historicalSnapshotBytes: Uint8Array
): DocumentDiffResult {
  const historicalDoc = restoreDocFromSnapshot(liveDoc, historicalSnapshotBytes);
  return computeYDocDiff(historicalDoc, liveDoc);
}

/**
 * Computes diff directly from raw text strings (e.g. Markdown or JSON).
 */
export function computeRawTextDiff(oldText: string, newText: string): DocumentDiffResult {
  const oldBlocks = parseTextToBlocks(oldText);
  const newBlocks = parseTextToBlocks(newText);
  return computeBlockDiffs(oldBlocks, newBlocks);
}
