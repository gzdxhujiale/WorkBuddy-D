// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { compressImage, readFileAsDataURL } from "./imageCompressor";

describe("imageCompressor utility", () => {
  it("passes SVG files through directly without rasterization", async () => {
    const svgContent = `<svg><circle r="10"/></svg>`;
    const svgFile = new File([svgContent], "diagram.svg", { type: "image/svg+xml" });

    const result = await compressImage(svgFile);
    expect(result.originalSize).toBe(svgFile.size);
    expect(result.compressedSize).toBe(svgFile.size);
    expect(result.dataUrl).toContain("data:image/svg+xml");
  });

  it("reads arbitrary blob as data URL", async () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    const dataUrl = await readFileAsDataURL(blob);
    expect(dataUrl).toContain("data:text/plain;base64,");
  });
});
