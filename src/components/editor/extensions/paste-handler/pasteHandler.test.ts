// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { transformPastedHTML, PasteHandler } from "./index";

describe("PasteHandler extension and transformers", () => {
  it("exports a valid Tiptap extension", () => {
    expect(PasteHandler).toBeDefined();
    expect(PasteHandler.name).toBe("pasteHandler");
  });

  it("cleans up mso tags and o:p tags from Word HTML", () => {
    const rawWordHtml = `<p class="MsoNormal" style="color:black;"><o:p>Hello Word</o:p></p>`;
    const cleaned = transformPastedHTML(rawWordHtml);
    expect(cleaned).not.toContain("<o:p>");
    expect(cleaned).toContain("Hello Word");
  });

  it("converts background-color spans to mark tags for Tiptap Highlight", () => {
    const rawSpanHtml = `<p><span style="background-color: yellow;">Highlighted text</span></p>`;
    const cleaned = transformPastedHTML(rawSpanHtml);
    expect(cleaned).toContain("<mark");
    expect(cleaned).toContain("Highlighted text");
  });

  it("transforms aria headings to semantic headings", () => {
    const rawAriaHtml = `<p role="heading" aria-level="2">Section Title</p>`;
    const cleaned = transformPastedHTML(rawAriaHtml);
    expect(cleaned).toContain("<h2");
    expect(cleaned).toContain("Section Title");
  });
});
