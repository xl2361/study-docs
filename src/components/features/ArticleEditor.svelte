<script lang="ts">
import { onMount, tick } from "svelte";

export let slug: string;
export let title: string;
export let categories: string[] = [];

type Draft = {
	slug: string;
	title: string;
	content?: string;
	sha: string;
	path: string;
};
type EmergencyDraft = {
	slug: string;
	title: string;
	published: string;
	category: string;
	tags: string;
	body: string;
	sha: string;
	path: string;
	error: string;
	at: number;
};
type EditorLike = {
	chain: () => EditorChain;
	commands: {
		setContent: (content: string, options: Record<string, unknown>) => void;
		undo: () => void;
		redo: () => void;
	};
	getMarkdown: () => string;
	getHTML: () => string;
	getJSON: () => JsonNode;
	isActive: (name: string) => boolean;
	can: () => {
		undo: () => boolean;
		redo: () => boolean;
	};
	on: (event: string, handler: () => void) => void;
	off: (event: string, handler: () => void) => void;
	destroy: () => void;
};
type JsonNode = {
	type?: string;
	attrs?: { level?: number };
	text?: string;
	content?: JsonNode[];
};
type EditorChain = {
	focus: () => EditorChain;
	undo: () => EditorChain;
	redo: () => EditorChain;
	toggleBold: () => EditorChain;
	toggleItalic: () => EditorChain;
	toggleStrike: () => EditorChain;
	toggleHeading: (options: { level: number }) => EditorChain;
	toggleBulletList: () => EditorChain;
	toggleOrderedList: () => EditorChain;
	toggleBlockquote: () => EditorChain;
	toggleCodeBlock: () => EditorChain;
	setHorizontalRule: () => EditorChain;
	addRowBefore: () => EditorChain;
	addRowAfter: () => EditorChain;
	addColumnBefore: () => EditorChain;
	addColumnAfter: () => EditorChain;
	deleteRow: () => EditorChain;
	deleteColumn: () => EditorChain;
	deleteTable: () => EditorChain;
	mergeCells: () => EditorChain;
	splitCell: () => EditorChain;
	toggleHeaderRow: () => EditorChain;
	toggleHeaderColumn: () => EditorChain;
	toggleHeaderCell: () => EditorChain;
	insertTable: (options: {
		rows: number;
		cols: number;
		withHeaderRow: boolean;
	}) => EditorChain;
	run: () => boolean;
};

const draftsKey = "study-edit-drafts";
const editModeKey = "study-edit-mode";
const emergencyKey = "study-edit-emergency";
let editing = false;
let opening = false;
let editorCreating = false;
let loading = false;
let loaded = false;
let error = "";
let savedMessage = "";
let articleTitle = title;
let published = "";
let category = "";
let tags = "";
let originalBody = "";
let frontmatterSource = "";
let sha = "";
let path = "";
let dirty = false;
let bodyDirty = false;
let canUndo = false;
let canRedo = false;
let readingBodyEl: HTMLElement | null = null;
let savedReadingHTML = "";
let reverting = false;
let sourceMode = false;
let editorReady = false;
let editorMount: HTMLElement;
let sourceEditEl: HTMLTextAreaElement | null = null;
let sourceValue = "";
let editor: EditorLike | null = null;
let emergency: EmergencyDraft | null = null;
let editorSectionEl: HTMLElement | null = null;
let statuslineEl: HTMLElement | null = null;
let toolbarEl: HTMLElement | null = null;
const editorInstanceId = `${Date.now()}-${Math.random()}`;
let mounted = false;
let openOperation = 0;
let inTitleEl: HTMLElement | null = null;
let inCategoryAnchor: HTMLElement | null = null;
let inCategorySelect: HTMLSelectElement | null = null;
let inTagsEl: HTMLElement | null = null;
let inTagsInput: HTMLInputElement | null = null;
let titleEl: HTMLElement | null = null;
let pendingOptimisticHTML: string | null = null;
let editScrollY = 0;
let editBodyAnchor = 0;
let editAnchorText = "";
let editAnchorOffset = 0;
let scrollRestored = false;
let tableToolbar = { visible: false, left: 0, top: 0 };

function scalar(value: string) {
	const v = value.trim();
	if (v.startsWith('"') && v.endsWith('"')) {
		try {
			return JSON.parse(v) as string;
		} catch {
			return v.slice(1, -1);
		}
	}
	if (v.startsWith("'") && v.endsWith("'"))
		return v.slice(1, -1).replace(/''/g, "'");
	return v;
}

function fieldRange(lines: string[], key: string): [number, number] | null {
	const start = lines.findIndex((line) =>
		new RegExp(`^${key}\\s*:`).test(line),
	);
	if (start < 0) return null;
	let end = start + 1;
	while (end < lines.length && !/^[A-Za-z0-9_-]+\s*:/.test(lines[end])) end++;
	return [start, end];
}

function field(lines: string[], key: string) {
	const range = fieldRange(lines, key);
	return range
		? scalar(lines[range[0]].replace(new RegExp(`^${key}\\s*:\\s*`), ""))
		: "";
}

function tagsField(lines: string[]) {
	const range = fieldRange(lines, "tags");
	if (!range) return "";
	const inline = lines[range[0]].replace(/^tags\s*:\s*/, "").trim();
	if (inline.startsWith("["))
		return inline
			.slice(1, -1)
			.split(",")
			.map(scalar)
			.filter(Boolean)
			.join(", ");
	return lines
		.slice(range[0] + 1, range[1])
		.map((line) => line.match(/^\s*-\s*(.+)$/)?.[1])
		.filter(Boolean)
		.map((v) => scalar(v as string))
		.join(", ");
}

function parseArticle(source: string) {
	const normalized = source.replace(/\r\n?/g, "\n");
	const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	const lines = match ? match[1].split("\n") : [];
	frontmatterSource = lines.join("\n");
	originalBody = match ? normalized.slice(match[0].length) : normalized;
	sourceValue = originalBody;
	articleTitle = field(lines, "title") || title;
	published = field(lines, "published");
	category = field(lines, "category");
	tags = tagsField(lines);
}

function setField(lines: string[], key: string, value: string) {
	const range = fieldRange(lines, key);
	const replacement = `${key}: ${value}`;
	if (range) lines.splice(range[0], range[1] - range[0], replacement);
	else lines.push(replacement);
}

function todayString() {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function buildArticle(body: string) {
	const lines = frontmatterSource.replace(/\r\n?/g, "\n").split("\n");
	setField(lines, "title", JSON.stringify(articleTitle.trim()));
	setField(lines, "published", published.trim());
	setField(lines, "updated", JSON.stringify(todayString()));
	setField(lines, "category", JSON.stringify(category.trim()));
	setField(
		lines,
		"tags",
		JSON.stringify(
			tags
				.split(/[,，]/)
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	);
	return `---\n${lines.join("\n")}\n---\n\n${body.replace(/^\n+/, "")}`;
}

function readDrafts(): Record<string, Draft> {
	const value = sessionStorage.getItem(draftsKey) || "{}";
	try {
		return JSON.parse(value) as Record<string, Draft>;
	} catch {
		return {};
	}
}

function markDirty(bodyChanged = false) {
	dirty = true;
	bodyDirty = bodyDirty || bodyChanged;
	savedMessage = "";
}

async function createEditor(operation: number) {
	if (!editorMount || sourceMode || editor || editorCreating) return;
	editorCreating = true;
	editorReady = false;
	try {
		const [core, starter, markdown, table, image] = await Promise.all([
			import("@tiptap/core"),
			import("@tiptap/starter-kit"),
			import("@tiptap/markdown"),
			import("@tiptap/extension-table"),
			import("@tiptap/extension-image"),
		]);
		if (
			!mounted ||
			operation !== openOperation ||
			!editing ||
			!editorMount ||
			sourceMode ||
			editor
		)
			return;
		editor = new core.Editor({
			element: editorMount,
			extensions: [
				starter.default,
				markdown.Markdown,
				table.TableKit,
				image.default,
			],
			content: "",
			onUpdate: () => {
				markDirty(true);
				syncHistoryState();
			},
			onTransaction: syncHistoryState,
		});
		editor.commands.setContent(originalBody, {
			contentType: "markdown",
			emitUpdate: false,
			errorOnInvalidContent: true,
		});
		editorReady = true;
		syncHistoryState();
		editor.on("selectionUpdate", onTableSelectionChange);
		editor.on("transaction", onTableSelectionChange);
		window.addEventListener("scroll", onWindowScrollOrResize, {
			passive: true,
		});
		window.addEventListener("resize", onWindowScrollOrResize);
	} catch (reason) {
		if (!mounted || operation !== openOperation || !editing) return;
		editor?.destroy();
		editor = null;
		sourceMode = true;
		sourceValue = originalBody;
		editorReady = true;
		error = "本文包含富文本模式无法解析的原始 HTML/XML，已切换为源码模式";
	} finally {
		editorCreating = false;
	}
}

function syncHistoryState() {
	canUndo = Boolean(editor?.can().undo());
	canRedo = Boolean(editor?.can().redo());
}

function onTableSelectionChange() {
	const tableEl = positionTableToolbar();
	if (!tableEl) {
		tableToolbar = { visible: false, left: 0, top: 0 };
	}
}

function positionTableToolbar(): HTMLElement | null {
	if (!editor) return null;
	let active = false;
	try {
		active = editor.isActive("table");
	} catch {
		active = false;
	}
	if (!active) return null;
	const tableEl = document.querySelector<HTMLElement>(
		".article-reading-body-editing .ProseMirror table",
	);
	if (!tableEl) return null;
	// 工具条定位在激活表格上方，fixed 相对视口，滚动时由 onWindowScroll 重新计算
	const rect = tableEl.getBoundingClientRect();
	const toolbarHeight = 48;
	let top = rect.top - toolbarHeight - 8;
	if (top < 80) top = rect.bottom + 8;
	tableToolbar = {
		visible: true,
		left: Math.max(8, Math.min(rect.left, window.innerWidth - 420)),
		top: Math.max(8, top),
	};
	return tableEl;
}

function onWindowScrollOrResize() {
	if (tableToolbar.visible && editor) positionTableToolbar();
}

function insertTable() {
	if (!editor) return;
	editor
		.chain()
		.focus()
		.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
		.run();
}

function runTableCommand(name: string) {
	if (!editor) return;
	const chain = editor.chain().focus();
	const actions: Record<string, () => unknown> = {
		addRowBefore: () => chain.addRowBefore(),
		addRowAfter: () => chain.addRowAfter(),
		addColumnBefore: () => chain.addColumnBefore(),
		addColumnAfter: () => chain.addColumnAfter(),
		deleteRow: () => chain.deleteRow(),
		deleteColumn: () => chain.deleteColumn(),
		deleteTable: () => chain.deleteTable(),
		mergeCells: () => chain.mergeCells(),
		splitCell: () => chain.splitCell(),
		toggleHeaderRow: () => chain.toggleHeaderRow(),
		toggleHeaderColumn: () => chain.toggleHeaderColumn(),
		toggleHeaderCell: () => chain.toggleHeaderCell(),
	};
	const fn = actions[name];
	if (fn) fn().run();
}

function destroyEditor() {
	if (editor) {
		editor.off("selectionUpdate", onTableSelectionChange);
		editor.off("transaction", onTableSelectionChange);
		editor.destroy();
	}
	editor = null;
	editorReady = false;
	tableToolbar = { visible: false, left: 0, top: 0 };
	window.removeEventListener("scroll", onWindowScrollOrResize);
	window.removeEventListener("resize", onWindowScrollOrResize);
}

async function loadArticle(operation: number) {
	loading = true;
	loaded = false;
	error = "";
	try {
		const response = await fetch(
			`/api/editor/article?slug=${encodeURIComponent(slug)}`,
		);
		if (response.status === 401) {
			location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
			return;
		}
		if (!response.ok) throw new Error("文章读取失败");
		const article = (await response.json()) as {
			content?: string;
			sha?: string;
			path?: string;
		};
		if (!mounted || operation !== openOperation) return;
		parseArticle(article.content || "");
		sha = article.sha || "";
		path = article.path || "";
		const draft = readDrafts()[slug];
		if (draft) {
			sha = draft.sha || sha;
			path = draft.path || path;
			if (draft.content) parseArticle(draft.content);
		}
		loaded = true;
		dirty = false;
		bodyDirty = false;
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "文章读取失败";
	} finally {
		loading = false;
	}
}

function setupInPlace() {
	const titleNodes = Array.from(
		document.querySelectorAll<HTMLElement>("[data-article-title]"),
	);
	let target: HTMLElement | null = null;
	for (const node of titleNodes) {
		if (node.offsetParent !== null || node.getBoundingClientRect().height > 0) {
			target = node;
			break;
		}
	}
	titleEl = target;
	if (titleEl) {
		inTitleEl = titleEl;
		titleEl.contentEditable = "plaintext-only";
		titleEl.classList.add("article-title-editing");
		titleEl.addEventListener("input", onTitleInput);
	}

	const anchors = Array.from(
		document.querySelectorAll<HTMLElement>("[data-article-category]"),
	);
	let anchor: HTMLElement | null = null;
	for (const node of anchors) {
		if (node.offsetParent !== null || node.getBoundingClientRect().height > 0) {
			anchor = node;
			break;
		}
	}
	if (anchor) {
		inCategoryAnchor = anchor;
		const select = document.createElement("select");
		select.className = "article-category-select";
		select.setAttribute("aria-label", "文章分类");
		select.addEventListener("change", () => {
			category = select.value;
			markDirty();
		});
		anchor.replaceWith(select);
		inCategorySelect = select;
		syncCategorySelect();
	}

	const tagsNodes = Array.from(
		document.querySelectorAll<HTMLElement>("[data-article-tags]"),
	);
	let tagsTarget: HTMLElement | null = null;
	for (const node of tagsNodes) {
		if (node.offsetParent !== null || node.getBoundingClientRect().height > 0) {
			tagsTarget = node;
			break;
		}
	}
	if (tagsTarget) {
		inTagsEl = tagsTarget;
		const input = document.createElement("input");
		input.className = "article-tags-input";
		input.value = tags;
		input.setAttribute("aria-label", "文章标签");
		input.addEventListener("input", () => {
			tags = input.value;
			markDirty();
		});
		tagsTarget.replaceWith(input);
		inTagsInput = input;
	}
}

function syncCategorySelect() {
	if (!inCategorySelect) return;
	const existing = Array.from(inCategorySelect.options).map(
		(option) => option.value,
	);
	const current = (category || "").trim();
	const values = [...new Set([current, ...categories].filter(Boolean))];
	const selected = current || "";
	for (const value of values) {
		if (!existing.includes(value)) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = value;
			inCategorySelect.insertBefore(
				option,
				inCategorySelect.querySelector("option[value='']"),
			);
		}
	}
	const empty = document.createElement("option");
	empty.value = "";
	empty.textContent = "未分类";
	if (!existing.includes("")) inCategorySelect.appendChild(empty);
	inCategorySelect.value = selected;
}

function onTitleInput() {
	if (!titleEl) return;
	const value = titleEl.textContent || "";
	articleTitle = value;
	markDirty();
}

function teardownInPlace() {
	if (inTitleEl) {
		inTitleEl.removeEventListener("input", onTitleInput);
		inTitleEl.classList.remove("article-title-editing");
		inTitleEl.removeAttribute("contenteditable");
		inTitleEl = null;
	}
	if (inCategorySelect && inCategoryAnchor) {
		inCategorySelect.replaceWith(inCategoryAnchor);
		inCategorySelect = null;
		inCategoryAnchor = null;
	}
	if (inTagsInput && inTagsEl) {
		inTagsInput.replaceWith(inTagsEl);
		inTagsInput = null;
		inTagsEl = null;
	}
	titleEl = null;
}

function normalizeAnchorText(value: string) {
	return (value || "")
		.replace(/#+\s*$/, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 30);
}

function captureScrollAnchor() {
	editScrollY = window.scrollY;
	// 记录正文顶部在文档中的偏移，作为滚动恢复兜底锚点：
	// 编辑模式会因 category-bar 隐藏/编辑器 UI 占位改变正文顶部位置，
	// 若直接恢复绝对 scrollY，正文相对视口会偏移导致视觉跳动。
	const bodyEl = document.querySelector<HTMLElement>(".article-reading-body");
	editBodyAnchor = bodyEl
		? Math.round(bodyEl.getBoundingClientRect().top + window.scrollY)
		: 0;
	// 内容级锚点：记录视口顶部附近实际可见的内容块（标题/段落/列表项等）
	// 的文本指纹及其相对视口顶部偏移。ProseMirror 与阅读模式的内容高度分布
	// 不同（图片/代码块渲染差异会累积偏移，实测中后部标题偏移可达 +1300px），
	// 仅靠正文容器 top 对齐不够，必须按内容块在编辑器内重新定位。
	// 用"视口顶部实际元素"而非"远处最近标题"，可保证用户在任何滚动位置
	// （包括标题之间、段落中部）都能精确对齐，不产生上下滑动的残留跳动。
	editAnchorText = "";
	editAnchorOffset = 0;
	if (!bodyEl) return;
	// 在视口上部取一个正文内可见的内容块
	const probeY = Math.min(160, window.innerHeight - 100);
	const hit = document.elementFromPoint(window.innerWidth / 2, probeY);
	let block: HTMLElement | null = null;
	let cur: Element | null = hit;
	while (cur && cur !== document.body) {
		if (bodyEl.contains(cur)) {
			const tag = cur.tagName;
			if (/^(H1|H2|H3|H4|H5|H6|P|LI|PRE|BLOCKQUOTE|TD|TH|DT|DD)$/.test(tag)) {
				const el = cur as HTMLElement;
				if ((el.textContent || "").trim()) {
					block = el;
					break;
				}
			}
		}
		cur = cur.parentElement;
	}
	if (!block) {
		// 视口顶部无文本块（如图片），退回最近标题
		const heads = Array.from(
			bodyEl.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
		);
		for (const h of heads) {
			const top = h.getBoundingClientRect().top + window.scrollY;
			if (top >= editScrollY - 200) {
				block = h;
				break;
			}
		}
	}
	if (!block) return;
	editAnchorText = normalizeAnchorText(block.textContent || "");
	editAnchorOffset = Math.max(
		0,
		Math.round(block.getBoundingClientRect().top + window.scrollY - editScrollY),
	);
}

function restoreScrollAfterEdit() {
	// 优先按内容锚点恢复：让编辑模式下视口顶部对齐到与读模式相同的内容块。
	// 因为 ProseMirror 与阅读模式内容高度分布不同，正文容器 top 对齐仍会让
	// 用户看到不同内容；按内容块文本在编辑器内重新定位可精确对齐。
	// 若编辑器内找不到同内容块，则回退到正文相对位置。
	const maxScrollNow = () =>
		document.documentElement.scrollHeight - window.innerHeight;
	const scrollToEditY = () => {
		if (!mounted || !editing || editScrollY <= 0) return;
		let target: number | null = null;
		// 尝试按内容锚点定位
		if (editAnchorText) {
			const pm = document.querySelector<HTMLElement>(
				".article-reading-body-editing .ProseMirror",
			);
			if (pm) {
				const blocks = Array.from(
					pm.querySelectorAll<HTMLElement>(
						"h1, h2, h3, h4, h5, h6, p, li, pre, blockquote, td, th",
					),
				);
				// 先精确匹配，再允许前缀匹配（ProseMirror 文本可能与渲染文本略有差异）
				const exact = blocks.find(
					(b) => normalizeAnchorText(b.textContent || "") === editAnchorText,
				);
				const prefix = exact
					? null
					: blocks.find((b) => {
							const n = normalizeAnchorText(b.textContent || "");
							return (
								editAnchorText.length > 6 &&
								(n.startsWith(editAnchorText.slice(0, 10)) ||
									editAnchorText.startsWith(n.slice(0, 10)))
							);
						});
				const match = exact || prefix;
				if (match) {
					const matchTop =
						match.getBoundingClientRect().top + window.scrollY;
					target = Math.round(matchTop - editAnchorOffset);
				}
			}
		}
		// 回退：正文相对位置对齐
		if (target === null) {
			const bodyEl = document.querySelector<HTMLElement>(
				".article-reading-body",
			);
			const newAnchor = bodyEl
				? Math.round(bodyEl.getBoundingClientRect().top + window.scrollY)
				: editBodyAnchor;
			target = editScrollY + (newAnchor - editBodyAnchor);
		}
		target = Math.min(Math.round(target), Math.max(0, maxScrollNow()));
		window.scrollTo(0, target);
	};
	scrollToEditY();
	// 字体/图片等资源加载完成后，若页面高度恢复导致 scrollY 被 clamp 或偏移，再精确校准一次
	let tries = 0;
	const finalize = scrollToEditY;
	const waitThenFinalize = () => {
		if (tries++ > 12) return;
		if (editScrollY > 0) finalize();
		if (document.fonts?.ready) {
			void document.fonts.ready.then(() => {
				if (mounted && editing) finalize();
			});
		}
		requestAnimationFrame(waitThenFinalize);
	};
	requestAnimationFrame(waitThenFinalize);
}

async function openEditor() {
	if (opening) return;
	const operation = ++openOperation;
	opening = true;
	try {
		if (!loaded) await loadArticle(operation);
		if (!mounted || operation !== openOperation || !loaded) return;
		const topbar = document.getElementById("editor-topbar");
		if (topbar) topbar.dataset.editorOwner = editorInstanceId;
		scrollRestored = false;
		// 在 editing=true 之前记录当前滚动位置
		captureScrollAnchor();
		editing = true;
		// 立即切换全局编辑态样式：隐藏分类栏、让 editor-topbar 容器 overflow:clip。
		// 必须与 moveTopbar（显示 editor-topbar）在同一渲染帧完成，
		// 否则会出现 "editor-topbar 出现(+75px) 但分类栏尚未隐藏(-75px)" 的中间帧，
		// 导致正文下移产生视觉跳动。正文不再由 CSS display:none 隐藏，此处安全。
		document.documentElement.classList.add("study-editor-active");
		await tick();
		if (!mounted || operation !== openOperation || !editing) return;
		moveTopbar();
		setupInPlace();
		await createEditor(operation);
		if (!mounted || operation !== openOperation || !editing) return;
		hostIntoReadingBody();
		// 立即恢复滚动位置（与 class 切换同一帧，避免分类栏隐藏导致的位移被用户看到）
		if (mounted && editing && !scrollRestored) {
			scrollRestored = true;
			restoreScrollAfterEdit();
		}
	} finally {
		opening = false;
		if (
			mounted &&
			!editing &&
			sessionStorage.getItem(editModeKey) === "1" &&
			operation !== openOperation
		)
			void openEditor();
	}
}

function hostIntoReadingBody() {
	if (!editing || readingBodyEl) return;
	const target = document.querySelector<HTMLElement>(".article-reading-body");
	if (!target) return;
	readingBodyEl = target;
	savedReadingHTML = target.innerHTML;
	target.innerHTML = "";
	target.classList.add("article-reading-body-editing");
	syncHostIntoBody();
}

function currentHostEl(): HTMLElement | null {
	return sourceMode ? sourceEditEl : editorMount;
}

function syncHostIntoBody() {
	const target = readingBodyEl;
	const host = currentHostEl();
	if (!target || !host) return;
	if (host.parentElement !== target) target.appendChild(host);
}

function saveEmergencyDraft(reason: unknown) {
	try {
		const rawBody = bodyDirty
			? sourceMode
				? sourceValue
				: editor?.getMarkdown() || ""
			: originalBody;
		const emergency = {
			slug,
			title: articleTitle.trim(),
			published,
			category,
			tags,
			body: rawBody,
			sha,
			path,
			error: reason instanceof Error ? reason.message : "草稿保存失败",
			at: Date.now(),
		};
		sessionStorage.setItem(
			`${emergencyKey}:${slug}`,
			JSON.stringify(emergency),
		);
	} catch {
		// 紧急备份失败时放弃，避免双重异常。
	}
}

function loadEmergency(): EmergencyDraft | null {
	try {
		const raw = sessionStorage.getItem(`${emergencyKey}:${slug}`);
		return raw ? (JSON.parse(raw) as EmergencyDraft) : null;
	} catch {
		return null;
	}
}

function saveDraft(): boolean {
	error = "";
	savedMessage = "";
	try {
		if (!loaded || !sha || !path) throw new Error("文章尚未成功加载，无法保存");
		if ((!editor && !sourceMode) || !editorReady)
			throw new Error("正文编辑器未成功加载，无法保存");
		articleTitle = articleTitle.trim();
		if (!articleTitle) throw new Error("标题不能为空");
		if (!published) published = todayString();
		if (category.includes("\n") || category.length > 50)
			throw new Error("分类不能换行且最多 50 个字符");
		const normalizedTags = [
			...new Set(
				tags
					.split(/[,，]/)
					.map((tag) => tag.trim())
					.filter(Boolean),
			),
		];
		if (
			normalizedTags.length > 30 ||
			normalizedTags.some((tag) => tag.length > 50)
		)
			throw new Error("标签最多 30 个，且每项最多 50 个字符");
		tags = normalizedTags.join(", ");
		const body = bodyDirty
			? sourceMode
				? sourceValue
				: editor?.getMarkdown() || ""
			: originalBody;
		const drafts = readDrafts();
		drafts[slug] = {
			slug,
			title: articleTitle,
			content: buildArticle(body),
			sha,
			path,
		};
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
		sessionStorage.removeItem(`${emergencyKey}:${slug}`);
		originalBody = body;
		sourceValue = body;
		dirty = false;
		bodyDirty = false;
		savedMessage = "已保存到本轮，点击顶部“更新”后提交";
		return true;
	} catch (reason) {
		saveEmergencyDraft(reason);
		const detail = reason instanceof Error ? reason.message : "草稿保存失败";
		error = `${detail}（已临时备份，可稍后恢复）`;
		return false;
	}
}

function restoreEmergencyDraft() {
	const backup = loadEmergency();
	if (!backup) return;
	parseArticle(backup.body);
	articleTitle = backup.title || title;
	published = backup.published;
	category = backup.category;
	bodyDirty = true;
	dirty = true;
	sessionStorage.removeItem(`${emergencyKey}:${slug}`);
	error = "";
	savedMessage = "已恢复上次未提交的编辑内容，请核对后保存";
	emergency = null;
	if (sourceMode) sourceValue = backup.body;
	else {
		try {
			editor?.commands.setContent(backup.body, {
				contentType: "markdown",
				emitUpdate: false,
				errorOnInvalidContent: false,
			});
		} catch {
			// 编辑器内容同步失败时以源码形式兜底恢复。
			sourceMode = true;
			sourceValue = backup.body;
		}
	}
	markDirty();
}

function leaveEditor() {
	openOperation++;
	const clearGlobalState = restoreTopbar();
	if (readingBodyEl) {
		readingBodyEl.innerHTML = savedReadingHTML;
		readingBodyEl.classList.remove("article-reading-body-editing");
		if (pendingOptimisticHTML) {
			readingBodyEl.innerHTML = pendingOptimisticHTML;
			pendingOptimisticHTML = null;
		}
		readingBodyEl = null;
		savedReadingHTML = "";
	}
	teardownInPlace();
	destroyEditor();
	sourceMode = false;
	editing = false;
	if (clearGlobalState)
		document.documentElement.classList.remove("study-editor-active");
}

function captureOptimisticHTML() {
	if (pendingOptimisticHTML) return;
	// 源码模式（含原始 HTML/XML 无法被富文本解析）无法在前端还原渲染效果，
	// 不做乐观更新，等待后台部署后的静态页面。
	if (sourceMode) return;
	pendingOptimisticHTML = editor?.getHTML() || null;
}

function moveTopbar() {
	if (!statuslineEl || !toolbarEl) return;
	const topbar = document.getElementById("editor-topbar");
	if (!topbar) return;
	topbar.dataset.editorOwner = editorInstanceId;
	topbar.hidden = false;
	if (statuslineEl.parentElement !== topbar) {
		topbar.replaceChildren(statuslineEl, toolbarEl);
	}
}

function restoreTopbar(): boolean {
	const topbar = document.getElementById("editor-topbar");
	const ownsTopbar =
		!topbar?.dataset.editorOwner ||
		topbar.dataset.editorOwner === editorInstanceId;
	if (
		editorSectionEl &&
		statuslineEl &&
		toolbarEl &&
		statuslineEl.parentElement !== editorSectionEl
	) {
		editorSectionEl.prepend(statuslineEl, toolbarEl);
	}
	if (topbar && ownsTopbar) {
		delete topbar.dataset.editorOwner;
		topbar.hidden = true;
	}
	return ownsTopbar;
}

function complete() {
	syncArticleMeta();
	leaveEditor();
}

function syncArticleMeta() {
	if (titleEl) titleEl.textContent = articleTitle;
	if (inCategoryAnchor) {
		const textEl = inCategoryAnchor.querySelector(
			"[data-article-category-text]",
		);
		if (textEl) textEl.textContent = category || "未分类";
		else inCategoryAnchor.textContent = category || "未分类";
	}
}

function format(action: string) {
	if (!editor) return;
	const chain = editor.chain().focus();
	const actions: Record<string, () => EditorChain> = {
		undo: () => chain.undo(),
		redo: () => chain.redo(),
		bold: () => chain.toggleBold(),
		italic: () => chain.toggleItalic(),
		strike: () => chain.toggleStrike(),
		h1: () => chain.toggleHeading({ level: 1 }),
		h2: () => chain.toggleHeading({ level: 2 }),
		h3: () => chain.toggleHeading({ level: 3 }),
		bullet: () => chain.toggleBulletList(),
		ordered: () => chain.toggleOrderedList(),
		quote: () => chain.toggleBlockquote(),
		code: () => chain.toggleCodeBlock(),
		hr: () => chain.setHorizontalRule(),
	};
	actions[action]?.().run();
}

onMount(() => {
	mounted = true;
	// 注意：不要通过 DOM 直接给 ProseMirror 内 heading 赋 id——
	// 会触发编辑器观察器连续重绘，导致页面滚动时"乱跳"。
	// 目录点击定位依赖 SidebarTOC 的 getEditorHeading 文本匹配兜底，无需 DOM id。
	const setMode = (enabled: boolean) => {
		if (enabled) void openEditor();
		else complete();
	};
	const flush = (event: Event) => {
		const detail = (event as CustomEvent<{ success: boolean }>).detail;
		if (editing && dirty) detail.success = saveDraft();
	};
	const beforeUnload = () => {
		if (reverting) return;
		if (dirty && !saveDraft())
			saveEmergencyDraft(new Error("页面刷新时保存失败"));
	};
	const modeChange = (event: Event) =>
		setMode(
			Boolean((event as CustomEvent<{ editing?: boolean }>).detail?.editing),
		);
	const onOpen = () => void openEditor();
	const onRevert = () => {
		// 顶栏“退出”触发：丢弃本轮修改后页面将重载，标记本次不落盘
		reverting = true;
	};
	const onKeydown = (event: KeyboardEvent) => {
		if (!event.ctrlKey && !event.metaKey) return;
		if (event.key.toLowerCase() !== "s") return;
		event.preventDefault();
		if (editing) saveDraft();
	};
	window.addEventListener("study-edit-mode-change", modeChange);
	window.addEventListener("study-article-editor-open", onOpen);
	window.addEventListener("study-article-editor-revert", onRevert);
	window.addEventListener("study-article-editor-flush", flush);
	window.addEventListener(
		"study-article-commit-success",
		captureOptimisticHTML,
	);
	window.addEventListener("beforeunload", beforeUnload);
	window.addEventListener("keydown", onKeydown);
	if (sessionStorage.getItem(editModeKey) === "1") void openEditor();
	emergency = loadEmergency();
	return () => {
		mounted = false;
		openOperation++;
		window.removeEventListener("study-edit-mode-change", modeChange);
		window.removeEventListener("study-article-editor-open", onOpen);
		window.removeEventListener("study-article-editor-revert", onRevert);
		window.removeEventListener("study-article-editor-flush", flush);
		window.removeEventListener(
			"study-article-commit-success",
			captureOptimisticHTML,
		);
		window.removeEventListener("beforeunload", beforeUnload);
		window.removeEventListener("keydown", onKeydown);
		const clearGlobalState = restoreTopbar();
		if (!reverting && dirty && !saveDraft())
			saveEmergencyDraft(new Error("页面关闭时保存失败"));
		teardownInPlace();
		destroyEditor();
		if (clearGlobalState)
			document.documentElement.classList.remove("study-editor-active");
	};
});

$: if (editing && (sourceMode || editorMount || sourceEditEl))
	syncHostIntoBody();
</script>

{#if editing}
 <section class="ha-editor" bind:this={editorSectionEl} aria-busy={loading} aria-label="文章编辑器">
  <div class="statusline" bind:this={statuslineEl} role="status" aria-live="polite" style={!emergency ? 'display:none' : ''}>
   {#if emergency}
     <button class="recover" type="button" onclick={restoreEmergencyDraft} title={emergency.error}>恢复备份</button>
   {/if}
  </div>
  <nav class="toolbar" bind:this={toolbarEl} aria-label="正文格式"><button title="后退一步" onclick={() => format("undo")} disabled={!editorReady || sourceMode || !canUndo}>↶</button><button title="前进一步" onclick={() => format("redo")} disabled={!editorReady || sourceMode || !canRedo}>↷</button><button title="一级标题" onclick={() => format("h1")} disabled={!editorReady || sourceMode}>H1</button><button title="二级标题" onclick={() => format("h2")} disabled={!editorReady || sourceMode}>H2</button><button title="三级标题" onclick={() => format("h3")} disabled={!editorReady || sourceMode}>H3</button><button title="粗体" onclick={() => format("bold")} disabled={!editorReady || sourceMode}><b>B</b></button><button title="斜体" onclick={() => format("italic")} disabled={!editorReady || sourceMode}><i>I</i></button><button title="删除线" onclick={() => format("strike")} disabled={!editorReady || sourceMode}><s>S</s></button><button title="无序列表" onclick={() => format("bullet")} disabled={!editorReady || sourceMode}>•</button><button title="有序列表" onclick={() => format("ordered")} disabled={!editorReady || sourceMode}>1.</button><button title="引用" onclick={() => format("quote")} disabled={!editorReady || sourceMode}>❝</button><button title="代码块" onclick={() => format("code")} disabled={!editorReady || sourceMode}>{"</>"}</button><button title="分隔线" onclick={() => format("hr")} disabled={!editorReady || sourceMode}>—</button><button title="插入表格" onclick={() => insertTable()} disabled={!editorReady || sourceMode}>▦</button></nav>
  {#if tableToolbar.visible && !sourceMode}
    <div class="table-toolbar" style={`left:${tableToolbar.left}px;top:${tableToolbar.top}px;`} role="toolbar" aria-label="表格操作">
      <button type="button" title="上方插入行" onclick={() => runTableCommand("addRowBefore")}>上插行</button>
      <button type="button" title="下方插入行" onclick={() => runTableCommand("addRowAfter")}>下插行</button>
      <button type="button" title="左侧插入列" onclick={() => runTableCommand("addColumnBefore")}>左插列</button>
      <button type="button" title="右侧插入列" onclick={() => runTableCommand("addColumnAfter")}>右插列</button>
      <button type="button" title="合并单元格" onclick={() => runTableCommand("mergeCells")}>合并</button>
      <button type="button" title="拆分单元格" onclick={() => runTableCommand("splitCell")}>拆分</button>
      <button type="button" title="删除当前行" onclick={() => runTableCommand("deleteRow")}>删行</button>
      <button type="button" title="删除当前列" onclick={() => runTableCommand("deleteColumn")}>删列</button>
      <button type="button" title="表头行" onclick={() => runTableCommand("toggleHeaderRow")}>表头</button>
      <button type="button" class="danger" title="删除整个表格" onclick={() => runTableCommand("deleteTable")}>删表</button>
    </div>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if savedMessage}<p class="success">{savedMessage}</p>{/if}
  {#if sourceMode}<p class="source-note">源码模式：当前 Markdown 含有富文本编辑器无法解析的原始内容。</p><textarea class="source-editor" bind:this={sourceEditEl} bind:value={sourceValue} oninput={() => markDirty(true)} aria-label="Markdown 正文源码编辑器" spellcheck="false" disabled={!loaded}></textarea>{:else}<div class="tiptap-host prose dark:prose-invert prose-base max-w-none custom-md" bind:this={editorMount}></div>{/if}
 </section>
{/if}

<style>
 .ha-editor { color: var(--btn-content); } .statusline { display: flex; align-items: center; gap: .55rem; margin: .15rem 0 .25rem; } .edit-badge { flex: none; border: 1px solid var(--primary); border-radius: .4rem; padding: .12rem .5rem; color: var(--primary); font-size: .75rem; font-weight: 750; } .status { font-size: .75rem; opacity: .75; } .recover { border-color: color-mix(in srgb, #e0a23c 45%, transparent); color: #b7791f; } button { border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .35rem .6rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .78rem; cursor: pointer; } button:disabled { cursor: not-allowed; opacity: .5; } .primary { border-color: var(--primary); color: white; background: var(--primary); } .danger { color: #c74747; } .error { color: #c74747; font-size: .8rem; } .success { color: #27845f; font-size: .8rem; } .toolbar { position: sticky; top: 4.3rem; z-index: 20; display: flex; gap: .25rem; overflow-x: auto; margin: .35rem 0 .9rem; border-block: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); padding: .4rem .2rem; background: color-mix(in srgb, var(--card-bg) 94%, transparent); backdrop-filter: blur(10px); } .toolbar button { flex: 0 0 auto; min-width: 2rem; } .tiptap-host :global(.ProseMirror) { min-height: 26rem; outline: none; line-height: 1.75; } .tiptap-host :global(.ProseMirror pre) { overflow-x: auto; border-radius: .4rem; padding: .8rem; background: color-mix(in srgb, var(--btn-content) 8%, var(--card-bg)); } .tiptap-host :global(.ProseMirror table) { display: block; max-width: 100%; overflow-x: auto; } .tiptap-host :global(.ProseMirror img) { max-width: 100%; height: auto; } .tiptap-host :global(.ProseMirror code) { font-size: .875em; } .source-note { margin-top: .5rem; color: color-mix(in srgb, var(--btn-content) 65%, transparent); font-size: .8rem; } .source-editor { display: block; width: 100%; min-height: 26rem; resize: vertical; font-family: var(--font-jetbrains-mono), monospace; font-size: .86rem; line-height: 1.65; border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .6rem; color: inherit; background: var(--card-bg); }
 :global([data-article-title].article-title-editing) { outline: 2px dashed color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 2px; border-radius: .25rem; }
 :global(.article-category-select), :global(.article-tags-input) { display: inline-block; max-width: 14rem; border: 1px dashed color-mix(in srgb, var(--primary) 45%, transparent); border-radius: .3rem; padding: .08rem .3rem; color: inherit; background: var(--card-bg); font: inherit; font-size: .78rem; }
 :global(.post-meta-cover .article-category-select), :global(.post-meta-cover .article-tags-input) { color: white; background: rgb(0 0 0 / .35); }
 .table-toolbar { position: fixed; z-index: 24; display: flex; flex-wrap: wrap; gap: .35rem; padding: .45rem .55rem; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: .7rem; background: color-mix(in srgb, var(--card-bg) 94%, transparent); backdrop-filter: blur(10px); box-shadow: 0 10px 28px color-mix(in srgb, var(--btn-content) 10%, transparent); } .table-toolbar button { flex: 0 0 auto; min-width: 3.6rem; border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .3rem .55rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .78rem; cursor: pointer; } .table-toolbar button:hover { border-color: color-mix(in srgb, var(--primary) 45%, transparent); transform: translateY(-1px); } .table-toolbar .danger { color: #c74747; }
 @media (max-width: 760px) { .toolbar { top: 3.6rem; } }
</style>
