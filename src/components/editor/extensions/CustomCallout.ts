import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutType = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      toggleCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      setCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const CustomCallout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "NOTE",
        parseHTML: (element) => element.getAttribute("data-callout-type") || "NOTE",
        renderHTML: (attributes) => ({
          "data-callout-type": attributes.type,
          "data-type": "callout",
        }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-callout-title") || "",
        renderHTML: (attributes) =>
          attributes.title ? { "data-callout-title": attributes.title } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
      {
        tag: "div.callout",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = (node.attrs.type as CalloutType) || "NOTE";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: `callout callout-${type.toLowerCase()} my-3 rounded-lg border-l-4 p-3.5 transition-colors bg-muted/40`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },
});
