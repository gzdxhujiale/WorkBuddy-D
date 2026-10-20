import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export const ConsecutiveListJoinPluginKey = new PluginKey("consecutiveListJoin");

/**
 * 检查 parent 节点的直接子节点中是否存在相邻的同类型列表（orderedList 或 bulletList）
 * contentStartPos 是 parent 内容的起始绝对坐标
 */
function checkChildrenForJoin(parent: ProseMirrorNode, contentStartPos: number, fullDoc: ProseMirrorNode): number | null {
  if (parent.childCount < 2) {
    return null;
  }

  let currentOffset = contentStartPos;
  for (let i = 0; i < parent.childCount - 1; i++) {
    const childA = parent.child(i);
    const childB = parent.child(i + 1);
    const borderPos = currentOffset + childA.nodeSize;

    const isOrdered = childA.type.name === "orderedList" && childB.type.name === "orderedList";
    const isBullet = childA.type.name === "bulletList" && childB.type.name === "bulletList";

    if ((isOrdered || isBullet) && canJoin(fullDoc, borderPos)) {
      return borderPos;
    }

    currentOffset += childA.nodeSize;
  }

  return null;
}

/**
 * 递归或分层在文档中寻找两个紧邻的同类型列表节点（orderedList 或 bulletList）
 * 返回两个节点交界处的文档绝对坐标 pos，若无则返回 null
 */
function findConsecutiveListJoinPos(doc: ProseMirrorNode): number | null {
  // 1. 首先检查根节点 doc 的直接子节点
  let joinPos = checkChildrenForJoin(doc, 0, doc);
  if (joinPos !== null) {
    return joinPos;
  }

  // 2. 递归检查所有内部块级节点（例如 listItem 内部的嵌套子列表）
  doc.descendants((node, pos) => {
    if (joinPos !== null) {
      return false; // 已找到待合并位置，提前终止深入
    }

    if (node.isBlock && node.childCount >= 2) {
      joinPos = checkChildrenForJoin(node, pos + 1, doc);
      if (joinPos !== null) {
        return false;
      }
    }

    return true;
  });

  return joinPos;
}

/**
 * ConsecutiveListJoin 扩展
 * 监听 ProseMirror 事务的 appendTransaction 阶段，并在初始化 onCreate 时自愈历史碎片。
 * 当用户操作（如删除中间项、退格、剪切等）意外导致同级相邻两个独立的列表碎片产生时，
 * 在同一事务周期内毫秒级自动将它们无缝缝合成同一个完整列表，杜绝父级/同级序号归零断裂。
 */
export const ConsecutiveListJoin = Extension.create({
  name: "consecutiveListJoin",

  onCreate() {
    const { state, view } = this.editor;
    let tr = state.tr;
    let modified = false;
    let maxPasses = 10;

    while (maxPasses > 0) {
      const joinPos = findConsecutiveListJoinPos(tr.doc);
      if (joinPos === null) {
        break;
      }
      tr = tr.join(joinPos);
      modified = true;
      maxPasses--;
    }

    if (modified) {
      view.dispatch(tr);
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ConsecutiveListJoinPluginKey,
        appendTransaction(transactions, _oldState, newState) {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) {
            return null;
          }

          let tr = newState.tr;
          let modified = false;
          let maxPasses = 10; // 防御性上限，避免极端情况下的潜在死循环

          while (maxPasses > 0) {
            const joinPos = findConsecutiveListJoinPos(tr.doc);
            if (joinPos === null) {
              break;
            }

            tr = tr.join(joinPos);
            modified = true;
            maxPasses--;
          }

          return modified ? tr : null;
        },
      }),
    ];
  },
});
