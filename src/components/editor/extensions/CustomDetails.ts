import { Details } from "@tiptap/extension-details";
import { DetailsSummary } from "@tiptap/extension-details";
import { DetailsContent } from "@tiptap/extension-details";

export const CustomDetails = Details.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-Alt-d": () => this.editor.commands.setDetails(),
    };
  },
});

export { DetailsSummary, DetailsContent };
