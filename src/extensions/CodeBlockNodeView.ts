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
		const languagePicker = document.createElement("div");
		languagePicker.className = "ec-code-lang-picker";
		languagePicker.contentEditable = "false";
		const languageButton = document.createElement("button");
		languageButton.type = "button";
		languageButton.className = "ec-code-lang-select";
		languageButton.setAttribute("aria-haspopup", "listbox");
		languageButton.setAttribute("aria-expanded", "false");
		languageButton.contentEditable = "false";
		const languageList = document.createElement("div");
		languageList.className = "ec-code-lang-list";
		languageList.setAttribute("role", "listbox");
		languageList.hidden = true;
		for (const language of languages) {
			const option = document.createElement("button");
			option.type = "button";
			option.className = "ec-code-lang-option";
			option.dataset.language = language;
			option.setAttribute("role", "option");
			option.textContent = language;
			languageList.appendChild(option);
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
		bar.appendChild(languagePicker);
		languagePicker.append(languageButton, languageList);

		const closeLanguageList = () => {
			languageList.hidden = true;
			languageButton.setAttribute("aria-expanded", "false");
		};
		const openLanguageList = () => {
			languageList.hidden = false;
			languageButton.setAttribute("aria-expanded", "true");
		};

		const updateChrome = (currentNode: ProseMirrorNode) => {
			const language = currentNode.attrs.language || "";
			languageButton.textContent = language || "text";
			for (const option of languageList.querySelectorAll<HTMLButtonElement>(
				".ec-code-lang-option",
			)) {
				const selected = option.dataset.language === language;
				option.setAttribute("aria-selected", String(selected));
			}
			gutter.replaceChildren();
			for (const [index] of currentNode.textContent.split("\n").entries()) {
				const line = document.createElement("span");
				line.textContent = String(index + 1);
				gutter.appendChild(line);
			}
			pre.toggleAttribute("data-language", Boolean(language));
			if (language) pre.setAttribute("data-language", language);
		};
		const refreshLines = () => updateChrome(node);
		const observer = new MutationObserver(refreshLines);
		observer.observe(code, {
			childList: true,
			characterData: true,
			subtree: true,
		});

		languageButton.addEventListener("click", () => {
			if (languageList.hidden) openLanguageList();
			else closeLanguageList();
		});
		languageList.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLButtonElement)) return;
			const position = getPos();
			if (position === undefined) return;
			const language = target.dataset.language || null;
			view.dispatch(
				view.state.tr.setNodeMarkup(position, undefined, {
					...node.attrs,
					language,
				}),
			);
			closeLanguageList();
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
			destroy: () => observer.disconnect(),
			stopEvent: (event: Event) =>
				event.target instanceof HTMLElement && chrome.contains(event.target),
			ignoreMutation: (mutation: ViewMutationRecord) =>
				mutation.type !== "selection" &&
				(mutation.target === chrome || chrome.contains(mutation.target)),
		};
	};
}
