import { Extension } from "@tiptap/core";
import { joinBackward } from "@tiptap/pm/commands";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export const CustomKeymap = Extension.create({
  name: "customKeymap",

  addKeyboardShortcuts() {
    const handleSink = () => {
      if (this.editor.can().sinkListItem("listItem")) {
        return this.editor.chain().focus().sinkListItem("listItem").run();
      }
      if (this.editor.can().sinkListItem("taskItem")) {
        return this.editor.chain().focus().sinkListItem("taskItem").run();
      }
      return false;
    };

    const handleLift = () => {
      if (this.editor.can().liftListItem("listItem")) {
        return this.editor.chain().focus().liftListItem("listItem").run();
      }
      if (this.editor.can().liftListItem("taskItem")) {
        return this.editor.chain().focus().liftListItem("taskItem").run();
      }
      return false;
    };

    const handleSmartBackspace = (): boolean => {
      const { state, dispatch } = this.editor.view;
      const { selection } = state;
      const { $from, empty } = selection;

      // 选区非折叠状态，让默认按键处理选区删除
      if (!empty) {
        return false;
      }

      // 查找当前光标是否处于 listItem 或 taskItem 内部
      let listItemDepth = -1;
      let listItemNode: ProseMirrorNode | null = null;
      for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d);
        if (n.type.name === "listItem" || n.type.name === "taskItem") {
          listItemDepth = d;
          listItemNode = n;
          break;
        }
      }

      if (listItemDepth === -1 || !listItemNode) {
        return false;
      }

      // 仅在当前列表项的首个文本块最开头（offset === 0）处进行智能拦截
      const isLeadingEdge = $from.parentOffset === 0 && $from.index(listItemDepth) === 0;
      if (!isLeadingEdge) {
        return false;
      }

      // 检查当前列表项是否为空项（无文本且无子列表）
      const isEmpty =
        listItemNode.childCount === 1 &&
        listItemNode.firstChild?.isTextblock &&
        listItemNode.firstChild.content.size === 0;

      // 判断是否处于嵌套子列表层级（上方还有父级 listItem/taskItem）
      let hasParentListItem = false;
      for (let d = listItemDepth - 1; d > 0; d--) {
        const ancestor = $from.node(d);
        if (ancestor.type.name === "listItem" || ancestor.type.name === "taskItem") {
          hasParentListItem = true;
          break;
        }
      }

      const itemType = listItemNode.type.name;
      const parentListNode = $from.node(listItemDepth - 1);
      const indexInParent = $from.index(listItemDepth - 1);
      const totalChildren = parentListNode.childCount;

      const hasPrevSibling = indexInParent > 0;
      const hasNextSibling = indexInParent < totalChildren - 1;

      // =========================================================================
      // 分支 1：当前列表项是【空项】（用户刚按回车生成、或内容已删空的空白项）
      // =========================================================================
      if (isEmpty) {
        // 1.1 若前面有兄弟列表项（无论是夹在列表中间还是位于列表末尾）：
        // 用户按退格的绝对意图是“撤销/删除该空项并回到上一项末尾”，绝不能撕裂或提升列表！
        if (hasPrevSibling) {
          const itemStart = $from.before(listItemDepth);
          const itemEnd = $from.after(listItemDepth);

          // 计算前一个兄弟项在当前文档中的绝对范围
          const parentStart = $from.start(listItemDepth - 1);
          let prevSiblingStart = parentStart;
          for (let i = 0; i < indexInParent - 1; i++) {
            prevSiblingStart += parentListNode.child(i).nodeSize;
          }
          const prevSiblingNode = parentListNode.child(indexInParent - 1);

          // 寻找前一个兄弟项内部最后一个文本块的末尾光标位置
          let lastTextblockOffset = 1;
          prevSiblingNode.nodesBetween(0, prevSiblingNode.content.size, (node, pos) => {
            if (node.isTextblock) {
              lastTextblockOffset = pos + 1 + node.content.size;
            }
          });
          const targetCursorPos = prevSiblingStart + 1 + lastTextblockOffset;

          return this.editor
            .chain()
            .focus()
            .deleteRange({ from: itemStart, to: itemEnd })
            .setTextSelection(targetCursorPos)
            .run();
        }

        // 1.2 若前面没有兄弟项（首项），但后面还有兄弟项：直接删除当前项并将光标移至后续项开头
        if (hasNextSibling) {
          const itemStart = $from.before(listItemDepth);
          const itemEnd = $from.after(listItemDepth);
          return this.editor
            .chain()
            .focus()
            .deleteRange({ from: itemStart, to: itemEnd })
            .setTextSelection(itemStart + 1)
            .run();
        }

        // 1.3 既无前兄弟也无后兄弟（当前列表里仅有这唯一的孤立空项）：
        if (hasParentListItem) {
          if (this.editor.can().liftListItem(itemType)) {
            return this.editor.chain().focus().liftListItem(itemType).run();
          }
        }

        if (this.editor.can().liftListItem(itemType)) {
          return this.editor.chain().focus().liftListItem(itemType).run();
        }
        return this.editor.commands.setParagraph();
      }

      // =========================================================================
      // 分支 2：当前列表项【非空】（有文本或子列表），且光标位于该项文本行首
      // =========================================================================
      // 2.1 处于嵌套子列表（Level > 1）：行首按 Backspace 优先单步 Outdent 提升层级，绝不粗暴拼接到上一行
      if (hasParentListItem) {
        if (this.editor.can().liftListItem(itemType)) {
          return this.editor.chain().focus().liftListItem(itemType).run();
        }
      }

      // 2.2 处于根级列表（Level 1）非空项行首：尝试与前一文档块执行安全合并
      if (joinBackward(state, dispatch)) {
        return true;
      }

      return false;
    };

    const handleSmartEnter = (): boolean => {
      const { state } = this.editor.view;
      const { selection } = state;
      const { $from, empty } = selection;

      if (!empty) {
        return false;
      }

      // 查找当前光标是否处于 listItem 或 taskItem 内部
      let listItemDepth = -1;
      let listItemNode: ProseMirrorNode | null = null;
      for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d);
        if (n.type.name === "listItem" || n.type.name === "taskItem") {
          listItemDepth = d;
          listItemNode = n;
          break;
        }
      }

      if (listItemDepth === -1 || !listItemNode) {
        return false;
      }

      // 检查当前列表项是否为空项
      const isEmpty =
        listItemNode.childCount === 1 &&
        listItemNode.firstChild?.isTextblock &&
        listItemNode.firstChild.content.size === 0;

      // 如果不是空项，放行让 Tiptap 原生 splitListItem 执行正常的分裂创建下一项
      if (!isEmpty) {
        return false;
      }

      const itemType = listItemNode.type.name;

      // 当前列表项是空项：
      // 判断是否处于嵌套子列表层级（Level > 1）
      let hasParentListItem = false;
      for (let d = listItemDepth - 1; d > 0; d--) {
        const ancestor = $from.node(d);
        if (ancestor.type.name === "listItem" || ancestor.type.name === "taskItem") {
          hasParentListItem = true;
          break;
        }
      }

      // 1. 如果处于嵌套子列表（Level > 1）：按 Enter 单步 Outdent 提升层级（例如空 1.2 提升为 2）
      if (hasParentListItem) {
        if (this.editor.can().liftListItem(itemType)) {
          return this.editor.chain().focus().liftListItem(itemType).run();
        }
      }

      // 2. 如果处于顶层列表（Level 1）：按 Enter 退出列表变为普通段落
      if (this.editor.can().liftListItem(itemType)) {
        return this.editor.chain().focus().liftListItem(itemType).run();
      }
      return this.editor.commands.setParagraph();
    };

    return {
      "Mod-1": () => this.editor.commands.toggleHeading({ level: 1 }),
      "Mod-2": () => this.editor.commands.toggleHeading({ level: 2 }),
      "Mod-3": () => this.editor.commands.toggleHeading({ level: 3 }),
      "Mod-4": () => this.editor.commands.toggleHeading({ level: 4 }),
      "Mod-5": () => this.editor.commands.toggleHeading({ level: 5 }),
      "Mod-6": () => this.editor.commands.toggleHeading({ level: 6 }),
      "Mod-0": () => this.editor.commands.setParagraph(),
      "Mod-7": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-8": () => this.editor.commands.toggleBulletList(),
      "Mod-8": () => this.editor.commands.toggleOrderedList(),
      "Mod-Shift-7": () => this.editor.commands.toggleOrderedList(),
      "Mod-9": () => this.editor.commands.toggleTaskList(),
      "Mod-Shift-9": () => this.editor.commands.toggleTaskList(),

      // Standard desktop indentation shortcuts
      "Mod-]": handleSink,
      "Mod-[": handleLift,

      // Smart Backspace Guard (Outdent non-empty item / Delete intermediate empty item)
      Backspace: handleSmartBackspace,

      // Smart Enter (Exit/Outdent empty list items gracefully)
      Enter: handleSmartEnter,

      // Tab handling with list sink & paragraph escape defense
      Tab: () => {
        if (handleSink()) {
          return true;
        }
        // Let table extension handle Tab navigation inside tables
        if (this.editor.isActive("table")) {
          return false;
        }
        // Prevent webview focus escape and insert 2 spaces
        return this.editor.commands.insertContent("  ");
      },

      "Shift-Tab": () => {
        if (handleLift()) {
          return true;
        }
        // Let table extension handle Shift-Tab navigation inside tables
        if (this.editor.isActive("table")) {
          return false;
        }
        // Prevent webview focus escape
        return true;
      },
    };
  },
});
