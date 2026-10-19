import React from "react";
import {
  RichTextEditor,
  convertMarkdownToTipTapJson,
  convertTipTapJsonToMarkdown,
  parseContent,
  type RichTextEditorProps,
} from "@/components/editor";

export type ReactjsTiptapEditorProps = RichTextEditorProps;

export const ReactjsTiptapEditor: React.FC<ReactjsTiptapEditorProps> = (props) => {
  return <RichTextEditor {...props} />;
};

export {
  convertMarkdownToTipTapJson,
  convertTipTapJsonToMarkdown,
  parseContent,
};
