import Image from "@tiptap/extension-image";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import { uploadMediaAsset } from "@/services/mediaService";

export interface CustomImageAttributes {
  src: string;
  alt?: string | null;
  title?: string | null;
  width?: string;
  align?: "left" | "center" | "right";
  isLoading?: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customImage: {
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        width?: string;
        align?: "left" | "center" | "right";
        isLoading?: boolean;
      }) => ReturnType;
      updateImageAttributes: (attributes: {
        width?: string;
        align?: "left" | "center" | "right";
      }) => ReturnType;
    };
  }
}

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
      width: {
        default: "100%",
        parseHTML: (element) => {
          return (
            element.getAttribute("data-width") ||
            (element.closest("figure") as HTMLElement | null)?.style.width ||
            element.getAttribute("width") ||
            "100%"
          );
        },
        renderHTML: (attributes) => ({
          "data-width": attributes.width || "100%",
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => {
          return (
            element.getAttribute("data-align") ||
            (element.closest("figure") as HTMLElement | null)?.getAttribute("data-align") ||
            "center"
          );
        },
        renderHTML: (attributes) => ({
          "data-align": attributes.align || "center",
        }),
      },
      isLoading: {
        default: false,
        renderHTML: (attributes) => ({
          "data-loading": attributes.isLoading ? "true" : undefined,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-image-container] img",
        getAttrs: (element) => {
          const img = element as HTMLImageElement;
          const figure = img.closest("figure");
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            align: figure?.getAttribute("data-align") || "center",
            width: figure?.getAttribute("data-width") || figure?.style.width || "100%",
          };
        },
      },
      {
        tag: "figure[data-image-container]",
        getAttrs: (element) => {
          const figure = element as HTMLElement;
          const img = figure.querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            align: figure.getAttribute("data-align") || "center",
            width: figure.getAttribute("data-width") || figure.style.width || "100%",
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (element) => {
          const img = element as HTMLImageElement;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            width: img.getAttribute("data-width") || img.getAttribute("width") || img.style.width || "100%",
            align: (img.getAttribute("data-align") as any) || "center",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = node?.attrs?.width || HTMLAttributes["data-width"] || "100%";
    const align = node?.attrs?.align || HTMLAttributes["data-align"] || "center";
    const isLoading = node?.attrs?.isLoading || HTMLAttributes["data-loading"] === "true";

    let marginStyle = "margin-left: auto; margin-right: auto;";
    if (align === "left") {
      marginStyle = "margin-left: 0; margin-right: auto;";
    } else if (align === "right") {
      marginStyle = "margin-left: auto; margin-right: 0;";
    }

    return [
      "figure",
      {
        class: "my-3 block select-none cursor-pointer group/image transition-all max-w-full",
        "data-image-container": "true",
        "data-align": align,
        "data-width": width,
        style: `width: ${width}; max-width: 100%; ${marginStyle}`,
      },
      [
        "div",
        {
          class: "relative w-full overflow-hidden rounded-lg border border-border/80 transition-all",
          "data-image-wrapper": "true",
        },
        [
          "img",
          {
            src: node?.attrs?.src || HTMLAttributes.src,
            alt: node?.attrs?.alt || HTMLAttributes.alt || "",
            title: node?.attrs?.title || HTMLAttributes.title || "",
            class: `w-full h-auto object-contain block max-h-[600px] transition-opacity ${
              isLoading ? "opacity-35 blur-xs animate-pulse" : "opacity-100"
            }`,
            loading: "lazy",
          },
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
      updateImageAttributes:
        (attributes) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes);
        },
    };
  },

  addProseMirrorPlugins() {
    const editor: Editor = this.editor;

    async function handleUploadAndInsert(files: File[]) {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (editor.isDestroyed) return;

        try {
          const uploadResult = await uploadMediaAsset(file);

          if (!editor.isDestroyed && uploadResult.src) {
            editor
              .chain()
              .focus()
              .setImage({
                src: uploadResult.src,
                alt: uploadResult.alt,
                width: "100%",
                align: "center",
                isLoading: false,
              })
              .run();
          }
        } catch (err) {
          console.error("[CustomImage] Failed to insert image:", err);
        }
      }
    }

    return [
      new Plugin({
        key: new PluginKey("imageSelectionHandler"),
        props: {
          handleClickOn: (view, _pos, node, nodePos) => {
            if (node.type.name === "image") {
              view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
              return true;
            }
            return false;
          },
        },
      }),
      new Plugin({
        key: new PluginKey("imagePasteAndDropHandler"),
        props: {
          handlePaste: (_view, event) => {
            const items = Array.from(event.clipboardData?.items || []);
            const imageItems = items.filter((item) => item.type.startsWith("image/"));
            if (imageItems.length === 0) return false;

            const files: File[] = [];
            for (const item of imageItems) {
              const file = item.getAsFile();
              if (file) files.push(file);
            }

            if (files.length === 0) return false;

            event.preventDefault();
            void handleUploadAndInsert(files);
            return true;
          },

          handleDrop: (view, event) => {
            const files = Array.from(event.dataTransfer?.files || []).filter((f) =>
              f.type.startsWith("image/")
            );
            if (files.length === 0) return false;

            event.preventDefault();
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (coordinates) {
              editor.commands.setTextSelection(coordinates.pos);
            }

            void handleUploadAndInsert(files);
            return true;
          },
        },
      }),
    ];
  },
});
