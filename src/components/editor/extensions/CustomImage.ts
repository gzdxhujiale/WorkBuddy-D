import Image from "@tiptap/extension-image";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      {
        ...HTMLAttributes,
        class:
          "max-w-full h-auto rounded-lg border border-border/80 my-3 transition-transform select-none object-contain max-h-[600px]",
        loading: "lazy",
      },
    ];
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("imagePasteAndDropHandler"),
        props: {
          handlePaste: (_view, event) => {
            const items = Array.from(event.clipboardData?.items || []);
            const imageItem = items.find((item) => item.type.startsWith("image/"));
            if (!imageItem) return false;

            const file = imageItem.getAsFile();
            if (!file) return false;

            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              if (src && !editor.isDestroyed) {
                editor
                  .chain()
                  .focus()
                  .setImage({
                    src,
                    alt: file.name || "Pasted image",
                  })
                  .run();
              }
            };
            reader.readAsDataURL(file);
            return true;
          },
          handleDrop: (view, event) => {
            const files = Array.from(event.dataTransfer?.files || []);
            const imageFile = files.find((file) => file.type.startsWith("image/"));
            if (!imageFile) return false;

            event.preventDefault();
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!coordinates) return false;

            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              if (src && !editor.isDestroyed) {
                editor
                  .chain()
                  .focus()
                  .setTextSelection(coordinates.pos)
                  .setImage({
                    src,
                    alt: imageFile.name || "Dropped image",
                  })
                  .run();
              }
            };
            reader.readAsDataURL(imageFile);
            return true;
          },
        },
      }),
    ];
  },
});
