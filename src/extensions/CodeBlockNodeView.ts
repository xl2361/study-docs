import type { NodeViewRenderer, NodeViewRendererProps } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { ViewMutationRecord } from "prosemirror-view";

const copyIcon =
	'<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"/></svg>';

export function createCodeBlockNodeView(languages: string[]): NodeViewRenderer {
	return ({ editor, node, getPos, view }: NodeViewRendererProps) => {
		const pre = document.createElement("pre");
		const chrome = document.createElement("div");
		chrome.className = "ec-code-block-chrome";
		chrome.contentEditable = "false";

		const gutter = document.createElement("div");
		gutter.className = "ec-line-gutter";
		gutter.setAttribute("aria-hidden", "true");

		const bar = document.createElement("div");
		bar.className = "ec-code-lang-bar";
		bar.contentEditable = "false";
		const select = document.createElement("select");
		select.className = "ec-code-lang-select";
		select.contentEditable = "false";
		for (const language of languages) {
			const option = document.createElement("option");
			option.value = language;
			option.textContent = language;
			select.appendChild(option);
		}

		const copyButton = document.createElement("button");
		copyButton.type = "button";
		copyButton.className = "ec-code-copy-btn";
		copyButton.title = "复制代码";
		copyButton.contentEditable = "false";
		copyButton.innerHTML = copyIcon;

		const code = document.createElement("code");
		pre.append(chrome, code);
		chrome.append(gutter, bar, copyButton);
		bar.appendChild(select);

		const updateChrome = (currentNode: ProseMirrorNode) => {
			const language = currentNode.attrs.language || "";
			select.value = language;
			gutter.replaceChildren();
			for (const [index] of currentNode.textContent.split("\n").entries()) {
				const line = document.createElement("span");
				line.textContent = String(index + 1);
				gutter.appendChild(line);
			}
			pre.toggleAttribute("data-language", Boolean(language));
			if (language) pre.setAttribute("data-language", language);
		};
		select.addEventListener("change", () => {
			const position = getPos();
			if (position === undefined) return;
			view.dispatch(
				view.state.tr.setNodeMarkup(position, undefined, {
					...node.attrs,
					language: select.value || null,
				}),
			);
			editor.commands.focus();
		});

		copyButton.addEventListener("click", async () => {
			const text = node.textContent;
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				textarea.remove();
			}
			copyButton.classList.add("copied");
			window.setTimeout(() => copyButton.classList.remove("copied"), 1200);
		});

		updateChrome(node);
		return {
			dom: pre,
			contentDOM: code,
			update: (nextNode: ProseMirrorNode) => {
				if (nextNode.type.name !== node.type.name) return false;
				node = nextNode;
				updateChrome(nextNode);
				return true;
			},
			stopEvent: (event: Event) =>
				event.target instanceof HTMLElement && chrome.contains(event.target),
			ignoreMutation: (mutation: ViewMutationRecord) =>
				mutation.type !== "selection" &&
				(mutation.target === chrome || chrome.contains(mutation.target)),
		};
	};
}
