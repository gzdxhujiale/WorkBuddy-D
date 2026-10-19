import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

export const lowlight = createLowlight(common);

export const CustomCodeBlockLowlight = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: "plaintext",
});
