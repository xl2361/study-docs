import type { NodeViewRenderer, NodeViewRendererProps } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { ViewMutationRecord } from "prosemirror-view";

const copyIcon =
	'<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"/></svg>';

const chevronIcon =
	'<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';

/* 语言搜索别名：按语言名列出可被搜到的额外关键词 */
const LANG_SEARCH_TERMS: Record<string, string[]> = {
	javascript: ["js", "ecmascript"],
	typescript: ["ts"],
	python: ["py"],
	ruby: ["rb"],
	bash: ["sh", "shell", "zsh"],
	shell: ["sh", "bash"],
	yaml: ["yml"],
	markdown: ["md"],
	go: ["golang"],
	kotlin: ["kt"],
	cpp: ["c++", "cxx"],
	css: ["style"],
	html: ["htm"],
	sql: ["mysql"],
	protobuf: ["proto"],
};

function langMatches(lang: string, filter: string): boolean {
	if (!filter) return true;
	const label = (lang || "auto").toLowerCase();
	if (label.includes(filter)) return true;
	const terms = LANG_SEARCH_TERMS[lang] || [];
	return terms.some((t) => t.includes(filter) || filter.includes(t));
}

export function createCodeBlockNodeView(languages: string[]): NodeViewRenderer {
	return ({ node, getPos, view }: NodeViewRendererProps) => {
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

		/* —— 语言按钮（替代原生 select）—— */
		const langButton = document.createElement("button");
		langButton.type = "button";
		langButton.className = "ec-code-lang-btn";
		langButton.contentEditable = "false";
		langButton.setAttribute("aria-haspopup", "listbox");
		langButton.setAttribute("aria-expanded", "false");

		const copyButton = document.createElement("button");
		copyButton.type = "button";
		copyButton.className = "ec-code-copy-btn";
		copyButton.title = "复制代码";
		copyButton.contentEditable = "false";
		copyButton.innerHTML = copyIcon;

		const code = document.createElement("code");
		pre.append(chrome, code);
		chrome.append(gutter, bar, copyButton);
		bar.appendChild(langButton);

		/* —— 状态 —— */
		let currentNode: ProseMirrorNode = node;
		let currentLang = node.attrs.language || "";
		let panel: HTMLElement | null = null;
		let searchInput: HTMLInputElement | null = null;
		let listEl: HTMLElement | null = null;
		let outsideClickHandler: ((e: PointerEvent) => void) | null = null;
		let escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
		let listenerTimer: ReturnType<typeof setTimeout> | null = null;

		/* 聚焦编辑器但不把旧选区滚进视口（避免选语言/Escape 后页面跳动） */
		function focusEditorQuietly() {
			(view.dom as HTMLElement).focus({ preventScroll: true });
		}

		function updateLangButton() {
			const label = currentLang || "auto";
			langButton.innerHTML = "";
			const span = document.createElement("span");
			span.textContent = label;
			langButton.appendChild(span);
			const chev = document.createElement("span");
			chev.className = "ec-code-lang-chevron";
			chev.innerHTML = chevronIcon;
			langButton.appendChild(chev);
			pre.toggleAttribute("data-language", Boolean(currentLang));
			if (currentLang) pre.setAttribute("data-language", currentLang);
		}

		function updateChrome(nextNode: ProseMirrorNode) {
			currentNode = nextNode;
			currentLang = nextNode.attrs.language || "";
			langButton.setAttribute("data-lang", currentLang);
			updateLangButton();
			gutter.replaceChildren();
			const lines = currentNode.textContent.split("\n");
			// 行号列宽自适应：按最大行号位数扩展（1位=1.55rem 基准，每多1位加0.62rem），
			// 避免超过 100 行时行号被截断错乱
			const digits = String(lines.length).length;
			gutter.style.width = `${(1.55 + (digits - 2) * 0.62).toFixed(2)}rem`;
			for (const [index] of lines.entries()) {
				const line = document.createElement("span");
				line.textContent = String(index + 1);
				gutter.appendChild(line);
			}
		}

		/* —— 下拉面板 —— */
		function openPanel() {
			if (panel) return;
			panel = document.createElement("div");
			panel.className = "ec-code-lang-panel";
			panel.setAttribute("role", "listbox");

			searchInput = document.createElement("input");
			searchInput.type = "text";
			searchInput.className = "ec-code-lang-search";
			searchInput.placeholder = "搜索…";
			searchInput.autocomplete = "off";
			/* size=1：避免 input 默认宽度参与面板 max-content 计算把面板撑宽 */
			searchInput.size = 1;

			listEl = document.createElement("div");
			listEl.className = "ec-code-lang-list";

			/* 顺序：语言列表在上，搜索框在下（搜索框紧贴语言按钮） */
			panel.append(listEl, searchInput);
			/* 挂到 chrome 内部（代码块容器），随代码块一起滚动 */
			chrome.appendChild(panel);
			renderList("");
			positionPanel();
			requestAnimationFrame(() => searchInput?.focus({ preventScroll: true }));

			searchInput.addEventListener("input", () => {
				const input = searchInput;
				if (input) renderList(input.value.toLowerCase().trim());
			});

			/* 拦截搜索框内的键盘事件，防止 ProseMirror 拦截 Enter（导致跳到页末）。
			   isComposing：输入法组词中的 Enter 是"确认候选"，不应提交选择。 */
			searchInput.addEventListener("keydown", (e) => {
				e.stopPropagation();
				if (e.key === "Enter") {
					if (e.isComposing || e.keyCode === 229) return;
					e.preventDefault();
					/* 选中第一个匹配项 */
					const first = listEl?.querySelector(
						".ec-code-lang-item",
					) as HTMLElement | null;
					if (first) {
						const lang = first.dataset.lang || "";
						selectLanguage(lang);
					}
					closePanel();
				} else if (e.key === "ArrowDown") {
					e.preventDefault();
					const items = listEl?.querySelectorAll(".ec-code-lang-item");
					if (items && items.length > 0) {
						(items[0] as HTMLElement).focus({ preventScroll: true });
					}
				}
			});

			const clickHandler = (e: PointerEvent) => {
				if (
					panel &&
					!panel.contains(e.target as Node) &&
					!langButton.contains(e.target as Node)
				) {
					closePanel();
				}
			};
			const keyHandler = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					closePanel();
					focusEditorQuietly();
				}
			};
			outsideClickHandler = clickHandler;
			escapeKeyHandler = keyHandler;
			/* 同步安装（打开面板的 pointerdown 已过 document 捕获阶段，
			   不会误关自己），并保存 timer 便于 close/destroy 时取消，
			   避免"先关再 destroy"后定时器仍把监听装回去的泄漏。 */
			listenerTimer = setTimeout(() => {
				listenerTimer = null;
				document.addEventListener("pointerdown", clickHandler, true);
				document.addEventListener("keydown", keyHandler, true);
			}, 0);
		}

		function closePanel() {
			/* 无论面板是否打开，都要清掉未触发的定时器与已装的全局监听 */
			if (listenerTimer !== null) {
				clearTimeout(listenerTimer);
				listenerTimer = null;
			}
			if (outsideClickHandler) {
				document.removeEventListener("pointerdown", outsideClickHandler, true);
				outsideClickHandler = null;
			}
			if (escapeKeyHandler) {
				document.removeEventListener("keydown", escapeKeyHandler, true);
				escapeKeyHandler = null;
			}
			if (!panel) return;
			panel.remove();
			panel = null;
			searchInput = null;
			listEl = null;
			langButton.setAttribute("aria-expanded", "false");
		}

		function renderList(filter: string) {
			if (!listEl) return;
			listEl.replaceChildren();
			const all = ["", ...languages];
			const filtered = all.filter((l) => langMatches(l, filter));
			if (filtered.length === 0) {
				const empty = document.createElement("div");
				empty.className = "ec-code-lang-empty";
				empty.textContent = "无匹配语言";
				listEl.appendChild(empty);
				return;
			}
			for (const lang of filtered) {
				const item = document.createElement("div");
				item.className = "ec-code-lang-item";
				if (lang === currentLang) item.classList.add("active");
				item.setAttribute("role", "option");
				item.tabIndex = -1;
				item.dataset.lang = lang;
				item.textContent = lang || "auto";
				item.addEventListener("pointerdown", (e) => {
					e.preventDefault();
					e.stopPropagation();
					selectLanguage(lang);
					closePanel();
				});
				item.addEventListener("keydown", (e) => {
					e.stopPropagation();
					if (e.key === "Enter") {
						if (e.isComposing || e.keyCode === 229) return;
						e.preventDefault();
						selectLanguage(lang);
						closePanel();
					} else if (e.key === "ArrowDown") {
						e.preventDefault();
						(item.nextElementSibling as HTMLElement)?.focus({
							preventScroll: true,
						});
					} else if (e.key === "ArrowUp") {
						e.preventDefault();
						const prev = item.previousElementSibling as HTMLElement;
						if (prev) prev.focus({ preventScroll: true });
						else searchInput?.focus({ preventScroll: true });
					}
				});
				listEl.appendChild(item);
			}
		}

		function positionPanel() {
			if (!panel) return;
			/* 面板挂在 chrome 内部，position: absolute 相对于 pre。
			   默认：紧贴语言按钮正上方、左边与按钮对齐；
			   上方空间不足时翻到按钮下方；水平溢出视口时按右缘对齐。 */
			const btnRect = langButton.getBoundingClientRect();
			const preRect = pre.getBoundingClientRect();
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const panelW = panel.offsetWidth;
			const gap = 4;

			/* 垂直：优先向上展开；按钮在视口内上方的空间不够时改向下 */
			const spaceAbove = btnRect.top;
			const openBelow = spaceAbove < 260 && spaceAbove < vh - btnRect.bottom;
			const maxH = Math.min(
				260,
				Math.max(120, openBelow ? vh - btnRect.bottom - gap : spaceAbove - gap),
			);

			/* 水平：默认左对齐按钮；面板会超出视口右缘时改为右缘对齐按钮 */
			let viewLeft = btnRect.left;
			if (viewLeft + panelW > vw - 8) {
				viewLeft = Math.max(8, btnRect.right - panelW);
			}

			const relLeft = viewLeft - preRect.left;
			const relBtnBottom = btnRect.bottom - preRect.top;

			panel.style.position = "absolute";
			panel.style.left = `${relLeft}px`;
			if (openBelow) {
				/* 面板顶边贴按钮底边 */
				panel.style.top = `${relBtnBottom + gap}px`;
				panel.style.bottom = "";
			} else {
				/* 面板底边贴按钮顶边（bottom 相对 pre 高度） */
				panel.style.bottom = `${preRect.height - relBtnBottom + btnRect.height + gap}px`;
				panel.style.top = "";
			}
			panel.style.minWidth = `${Math.round(btnRect.width)}px`;
			panel.style.maxHeight = `${maxH}px`;
		}

		function selectLanguage(lang: string) {
			currentLang = lang;
			const position = getPos();
			if (position === undefined) return;
			view.dispatch(
				view.state.tr.setNodeMarkup(position, undefined, {
					...currentNode.attrs,
					language: lang || null,
				}),
			);
			updateLangButton();
			/* 只恢复编辑焦点，不把旧选区滚动进视口 */
			focusEditorQuietly();
		}

		function togglePanel() {
			if (panel) {
				closePanel();
			} else {
				langButton.setAttribute("aria-expanded", "true");
				try {
					openPanel();
				} catch (err) {
					console.error("[CodeBlockNodeView] openPanel failed:", err);
				}
			}
		}

		/* 鼠标：pointerdown 抢先处理并阻止 PM 抢焦点 */
		langButton.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			togglePanel();
		});
		/* 键盘：原生按钮 Enter/Space 产生 click（detail=0），鼠标点击走上面的
		   pointerdown，detail>=1，不会双触发 */
		langButton.addEventListener("click", (e) => {
			if (e.detail !== 0) return;
			e.preventDefault();
			togglePanel();
		});

		copyButton.addEventListener("click", async () => {
			const text = currentNode.textContent;
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
				updateChrome(nextNode);
				return true;
			},
			destroy: () => {
				closePanel();
			},
			stopEvent: (event: Event) =>
				event.target instanceof HTMLElement && chrome.contains(event.target),
			ignoreMutation: (mutation: ViewMutationRecord) =>
				mutation.type !== "selection" &&
				(mutation.target === chrome || chrome.contains(mutation.target)),
		};
	};
}
