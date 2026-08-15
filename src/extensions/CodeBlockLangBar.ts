import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const CodeBlockLangBar = Extension.create({
	name: "codeBlockLangBar",

	addOptions() {
		return {
			languages: [] as string[],
		};
	},

	addProseMirrorPlugins() {
		const editor = this.editor;
		const languages = this.options.languages;
		return [
			new Plugin({
				key: new PluginKey("codeBlockLangBar"),
				props: {
					decorations(state) {
						const decos: Decoration[] = [];
						state.doc.descendants((node, pos) => {
							if (node.type.name !== "codeBlock") return;
							const lang = (node.attrs.language as string) || "";
							const bar = document.createElement("div");
							bar.className = "ec-code-lang-bar";
							bar.contentEditable = "false";
							const select = document.createElement("select");
							select.className = "ec-code-lang-select";
							select.contentEditable = "false";
							const placeholder = document.createElement("option");
							placeholder.value = "";
							placeholder.textContent = "语言";
							select.appendChild(placeholder);
							for (const langCode of languages) {
								const opt = document.createElement("option");
								opt.value = langCode;
								opt.textContent = langCode;
								if (langCode === lang) opt.selected = true;
								select.appendChild(opt);
							}
							select.addEventListener("change", () => {
								editor
									?.chain()
									.focus()
									.setTextSelection(pos)
									.setCodeBlockLanguage(select.value)
									.run();
							});
							const copyBtn = document.createElement("button");
							copyBtn.type = "button";
							copyBtn.className = "ec-code-copy-btn";
							copyBtn.title = "复制代码";
							copyBtn.innerHTML =
								'<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"/></svg>';
							copyBtn.addEventListener("click", async () => {
								const nodeAt = editor?.state.doc.nodeAt(pos);
								const text = nodeAt?.textContent ?? "";
								try {
									await navigator.clipboard.writeText(text);
								} catch {
									const ta = document.createElement("textarea");
									ta.value = text;
									document.body.appendChild(ta);
									ta.select();
									document.execCommand("copy");
									ta.remove();
								}
								copyBtn.classList.add("copied");
								setTimeout(() => copyBtn.classList.remove("copied"), 1200);
							});
							bar.appendChild(select);
							bar.appendChild(copyBtn);
							decos.push(
								Decoration.widget(pos + 1, bar, {
									side: -1,
									key: `ec-bar-${pos}`,
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
