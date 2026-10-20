// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ConsecutiveListJoin } from "./ConsecutiveListJoinPlugin";
import { CustomKeymap } from "./CustomKeymapExtensions";

describe("List Robustness & Guard System", () => {
  it("should automatically fuse two contiguous ordered lists into one", () => {
    const editor = new Editor({
      extensions: [StarterKit, ConsecutiveListJoin],
      content: "<ol><li><p>Item 1</p></li></ol><ol><li><p>Item 2</p></li></ol>",
    });

    // 触发更新让 appendTransaction 介入检查
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, "");

    let orderedListCount = 0;
    let listItemCount = 0;

    editor.state.doc.descendants((node) => {
      if (node.type.name === "orderedList") {
        orderedListCount++;
      }
      if (node.type.name === "listItem") {
        listItemCount++;
      }
    });

    expect(orderedListCount).toBe(1);
    expect(listItemCount).toBe(2);

    editor.destroy();
  });

  it("should preserve outer list structure and 2.xxx continuity when deleting intermediate 1.2xxxx", () => {
    const initialHtml = `
      <ol>
        <li>
          <p>1.xxx</p>
          <ol>
            <li><p>1.1xxxx</p></li>
            <li><p>1.2xxxx</p></li>
            <li><p>1.3xxx</p></li>
          </ol>
        </li>
        <li><p>2.xxx</p></li>
      </ol>
    `;

    const editor = new Editor({
      extensions: [StarterKit, ConsecutiveListJoin, CustomKeymap],
      content: initialHtml,
    });

    // 定位目标 1.2xxxx 节点
    let targetPos = -1;
    let targetSize = 0;

    editor.state.doc.descendants((node, pos) => {
      if (
        node.type.name === "listItem" &&
        node.firstChild?.type.name === "paragraph" &&
        node.firstChild.textContent === "1.2xxxx"
      ) {
        targetPos = pos;
        targetSize = node.nodeSize;
        return false;
      }
      return true;
    });

    expect(targetPos).toBeGreaterThan(-1);

    // 删除 1.2xxxx listItem
    editor.view.dispatch(editor.state.tr.delete(targetPos, targetPos + targetSize));

    // 验证顶层结构：保持单一 orderedList，包含 2 个顶级项
    const rootList = editor.state.doc.firstChild;
    expect(rootList?.type.name).toBe("orderedList");
    expect(rootList?.childCount).toBe(2);

    // 检查第二项内容依然是 2.xxx，未被拆分成孤立或者分裂的新列表
    const secondTopItem = rootList?.child(1);
    expect(secondTopItem?.textContent).toBe("2.xxx");

    // 检查子列表：原本有 3 项，现在剩 2 项 (1.1xxxx 与 1.3xxx)
    const firstTopItem = rootList?.child(0);
    const nestedList = firstTopItem?.child(1);
    expect(nestedList?.type.name).toBe("orderedList");
    expect(nestedList?.childCount).toBe(2);
    expect(nestedList?.child(0).textContent).toBe("1.1xxxx");
    expect(nestedList?.child(1).textContent).toBe("1.3xxx");

    editor.destroy();
  });

  it("should fuse severed lists even when an intermediate separator is removed", () => {
    const separatedHtml = `
      <ol><li><p>List Part 1</p></li></ol>
      <p id="temp-sep">Temporary Divider</p>
      <ol><li><p>List Part 2</p></li></ol>
    `;

    const editor = new Editor({
      extensions: [StarterKit, ConsecutiveListJoin],
      content: separatedHtml,
    });

    let dividerPos = -1;
    let dividerSize = 0;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.textContent === "Temporary Divider") {
        dividerPos = pos;
        dividerSize = node.nodeSize;
        return false;
      }
      return true;
    });

    expect(dividerPos).toBeGreaterThan(-1);

    // 删掉中间的临时段落
    editor.view.dispatch(editor.state.tr.delete(dividerPos, dividerPos + dividerSize));

    // 经由 ConsecutiveListJoin 自动缝合，应该重新变成同一个 orderedList
    let olCount = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "orderedList") {
        olCount++;
      }
    });

    expect(olCount).toBe(1);

    editor.destroy();
  });

  it("should outdent/lift nested child item when backspace triggered at leading edge", () => {
    const initialHtml = `
      <ol>
        <li>
          <p>Top Item 1</p>
          <ol>
            <li><p>Nested Item</p></li>
          </ol>
        </li>
      </ol>
    `;

    const editor = new Editor({
      extensions: [StarterKit, ConsecutiveListJoin, CustomKeymap],
      content: initialHtml,
    });

    // 找到 Nested Item 内部段落的起始位置
    let nestedParaPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.textContent === "Nested Item") {
        nestedParaPos = pos + 1; // 进入段落内部 offset 0
        return false;
      }
      return true;
    });

    expect(nestedParaPos).toBeGreaterThan(-1);

    // 将光标设置在 Nested Item 段落最开头 (offset === 0)
    editor.commands.setTextSelection(nestedParaPos);

    // 触发 Backspace 快捷键逻辑
    const handled = editor.commands.keyboardShortcut?.("Backspace");
    expect(handled).toBe(true);

    // 验证提升后的结构：
    // Nested Item 应该被提升为与 Top Item 1 同级的顶层项，而不是拼接到 Top Item 1 末尾！
    const rootList = editor.state.doc.firstChild;
    expect(rootList?.type.name).toBe("orderedList");
    expect(rootList?.childCount).toBe(2);
    expect(rootList?.child(0).firstChild?.textContent).toBe("Top Item 1");
    expect(rootList?.child(1).firstChild?.textContent).toBe("Nested Item");

    editor.destroy();
  });

  it("should cleanly delete intermediate empty list item on Backspace without splitting list", () => {
    // 模拟用户的具体场景：
    // 1. xyz
    //    1.1 我去
    //    1.2 我
    const initialHtml = `
      <ol>
        <li>
          <p>xyz</p>
          <ol>
            <li><p>我去</p></li>
            <li><p>我</p></li>
          </ol>
        </li>
      </ol>
    `;

    const editor = new Editor({
      extensions: [StarterKit, ConsecutiveListJoin, CustomKeymap],
      content: initialHtml,
    });

    // 找到 "我去" 文本末尾
    let targetPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.textContent === "我去") {
        targetPos = pos + node.nodeSize - 1; // "我去" 的行尾
        return false;
      }
      return true;
    });

    expect(targetPos).toBeGreaterThan(-1);

    // 将光标设置在 "我去" 行尾
    editor.commands.setTextSelection(targetPos);

    // 1. 模拟按 Enter：分裂出一个空的同级项（夹在 "我去" 和 "我" 之间）
    editor.commands.splitListItem("listItem");

    // 验证此时子列表有 3 项：'我去'、''（空）、'我'
    const getSubList = () => editor.state.doc.firstChild?.child(0).child(1);
    expect(getSubList()?.childCount).toBe(3);
    expect(getSubList()?.child(0).textContent).toBe("我去");
    expect(getSubList()?.child(1).textContent).toBe("");
    expect(getSubList()?.child(2).textContent).toBe("我");

    // 2. 模拟用户反悔，在当前空项处按下 Backspace
    const event = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true });
    let handled = false;
    editor.view.someProp("handleKeyDown", (f) => {
      if (f(editor.view, event)) {
        handled = true;
        return true;
      }
      return false;
    });
    expect(handled).toBe(true);

    // 验证：中间的空项应该被彻底删除，恢复为 2 项，列表绝不被撕裂！
    expect(getSubList()?.childCount).toBe(2);
    expect(getSubList()?.child(0).textContent).toBe("我去");
    expect(getSubList()?.child(1).textContent).toBe("我");

    // 验证整个文档只有 1 个 orderedList 根节点（内含 1 个嵌套 orderedList）
    let olCount = 0;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "orderedList") olCount++;
    });
    expect(olCount).toBe(2);

    // 验证光标回到了 "我去" 文本所在段落内部末尾
    const current$pos = editor.state.doc.resolve(editor.state.selection.from);
    expect(current$pos.parent.textContent).toBe("我去");
    expect(editor.state.selection.from).toBe(12);

    editor.destroy();

    editor.destroy();
  });

  it("should outdent nested empty list item on Enter", () => {
    // 模拟在嵌套空列表项上按 Enter（例如空 1.2 提升为顶层 2）
    const initialHtml = `
      <ol>
        <li>
          <p>Top 1</p>
          <ol>
            <li><p>Child 1</p></li>
            <li><p></p></li>
          </ol>
        </li>
      </ol>
    `;

    const editor = new Editor({
      extensions: [StarterKit, ConsecutiveListJoin, CustomKeymap],
      content: initialHtml,
    });

    // 找到空列表项内部光标位置
    let emptyItemPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "listItem" && node.textContent === "") {
        emptyItemPos = pos + 2; // 进入 li > p 内部
        return false;
      }
      return true;
    });

    expect(emptyItemPos).toBeGreaterThan(-1);
    editor.commands.setTextSelection(emptyItemPos);

    // 触发 Enter
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    let handled = false;
    editor.view.someProp("handleKeyDown", (f) => {
      if (f(editor.view, event)) {
        handled = true;
        return true;
      }
      return false;
    });
    expect(handled).toBe(true);

    // 此时顶层 orderedList 应该有两个直接子项：Top 1 和提升上来的新空项！
    const rootList = editor.state.doc.firstChild;
    expect(rootList?.type.name).toBe("orderedList");
    expect(rootList?.childCount).toBe(2);
    expect(rootList?.child(0).firstChild?.textContent).toBe("Top 1");
    expect(rootList?.child(1).textContent).toBe("");

    editor.destroy();
  });

  it("should exit list and convert to paragraph on Enter when already at root empty item", () => {
    // 模拟在顶层空列表项按 Enter（退出列表，变为段落）
    const initialHtml = `
      <ol>
        <li><p>Item 1</p></li>
        <li><p></p></li>
      </ol>
    `;

    const editor = new Editor({
      extensions: [StarterKit, ConsecutiveListJoin, CustomKeymap],
      content: initialHtml,
    });

    // 找到空项内部光标
    let emptyPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "listItem" && node.textContent === "") {
        emptyPos = pos + 2;
        return false;
      }
      return true;
    });

    expect(emptyPos).toBeGreaterThan(-1);
    editor.commands.setTextSelection(emptyPos);

    // 触发 Enter
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    let handled = false;
    editor.view.someProp("handleKeyDown", (f) => {
      if (f(editor.view, event)) {
        handled = true;
        return true;
      }
      return false;
    });
    expect(handled).toBe(true);

    // 此时列表应该只剩下 1 项，下方紧跟退出的普通 paragraph
    expect(editor.state.doc.child(0).type.name).toBe("orderedList");
    expect(editor.state.doc.child(0).childCount).toBe(1);
    expect(editor.state.doc.child(0).child(0).textContent).toBe("Item 1");
    expect(editor.state.doc.child(1).type.name).toBe("paragraph");

    editor.destroy();
  });
});
