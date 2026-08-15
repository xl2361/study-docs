import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const CodeBlockLineNumbers = Extension.create({
	name: "codeBlockLineNumbers",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("codeBlockLineNumbers"),
				props: {
					decorations(state) {
						const decos: Decoration[] = [];
						state.doc.descendants((node, pos) => {
							if (node.type.name !== "codeBlock") return;
							const lines = node.textContent.split("\n");
							const gutter = document.createElement("div");
							gutter.className = "ec-line-gutter";
							gutter.setAttribute("contenteditable", "false");
							gutter.setAttribute("aria-hidden", "true");
							for (let i = 0; i < lines.length; i++) {
								const span = document.createElement("span");
								span.textContent = String(i + 1);
								gutter.appendChild(span);
							}
							decos.push(
								Decoration.widget(pos + 1, gutter, {
									side: -1,
									key: `ec-gutter-${pos}`,
								}),
							);
						});
						return DecorationSet.create(state.doc, decos);
					},
				},
			}),
		];
	},
});
