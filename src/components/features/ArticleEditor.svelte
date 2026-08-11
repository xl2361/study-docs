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
	view: {
		posAtDOM: (node: Node, offset: number) => number;
	};
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
	setTextSelection: (position: number) => EditorChain;
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
let scrollRestored = false;
let tableToolbar = { visible: false, left: 0, top: 0 };
let hoverTableEl: HTMLElement | null = null;
let activeTableEl: HTMLElement | null = null;
let tableToolbarEl: HTMLElement | null = null;
let tableHideTimer: ReturnType<typeof setTimeout> | null = null;
let lastMouseX = 0;
let lastMouseY = 0;

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
		editorMount.addEventListener("mouseover", onTableHover);
		editorMount.addEventListener("mouseout", onTableHoverLeave);
		document.addEventListener("mousemove", onTableMouseMove);
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
	if (!tableEl && !hoverTableEl && !tableToolbarEl?.matches(":hover")) {
		hideTableToolbarNow();
	}
}

function clearTableHideTimer() {
	if (tableHideTimer) clearTimeout(tableHideTimer);
	tableHideTimer = null;
}

function pointerOverTableOrToolbar() {
	const el =
		lastMouseX || lastMouseY
			? document.elementFromPoint(lastMouseX, lastMouseY)
			: null;
	return Boolean(
		el?.closest(".article-reading-body-editing .ProseMirror table") ||
			el?.closest(".table-toolbar"),
	);
}

function hideTableToolbarLater() {
	clearTableHideTimer();
	tableHideTimer = setTimeout(() => {
		// 用鼠标真实位置兜底判断（360 下 mouseout.relatedTarget 不可靠）
		if (hoverTableEl || tableToolbarEl?.matches(":hover")) return;
		if (pointerOverTableOrToolbar()) return;
		hideTableToolbarNow();
	}, 140);
}

const tableCommands: Array<[string, string]> = [
	["addRowBefore", "上方插入行"],
	["addRowAfter", "下方插入行"],
	["addColumnBefore", "左侧插入列"],
	["addColumnAfter", "右侧插入列"],
	["mergeCells", "合并单元格"],
	["splitCell", "拆分单元格"],
	["deleteRow", "删除当前行"],
	["deleteColumn", "删除当前列"],
	["toggleHeaderRow", "表头行"],
	["deleteTable", "删除整个表格"],
];

function ensureTableToolbar(): HTMLElement | null {
	if (tableToolbarEl?.isConnected) return tableToolbarEl;
	const bar = document.createElement("div");
	bar.className = "table-toolbar";
	bar.setAttribute("role", "toolbar");
	bar.setAttribute("aria-label", "表格操作");
	for (const [cmd, label] of tableCommands) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.title = label;
		btn.textContent =
			cmd === "deleteTable"
				? "删表"
				: cmd === "mergeCells"
					? "合并"
					: cmd === "splitCell"
						? "拆分"
						: cmd === "toggleHeaderRow"
							? "表头"
							: cmd === "addRowBefore"
								? "上插行"
								: cmd === "addRowAfter"
									? "下插行"
									: cmd === "addColumnBefore"
										? "左插列"
										: cmd === "addColumnAfter"
											? "右插列"
											: cmd === "deleteRow"
												? "删行"
												: "删列";
		if (cmd === "deleteTable") btn.classList.add("danger");
		btn.addEventListener("click", () => runTableCommand(cmd));
		bar.appendChild(btn);
	}
	bar.addEventListener("mouseenter", onTableToolbarEnter);
	bar.addEventListener("mouseleave", onTableToolbarLeave);
	document.body.appendChild(bar);
	tableToolbarEl = bar;
	return bar;
}

function hideTableToolbarNow() {
	clearTableHideTimer();
	hoverTableEl = null;
	activeTableEl = null;
	tableToolbar = { visible: false, left: 0, top: 0 };
	if (tableToolbarEl) tableToolbarEl.style.display = "none";
}

function showTableToolbar(tableEl: HTMLElement): HTMLElement {
	clearTableHideTimer();
	activeTableEl = tableEl;
	const bar = ensureTableToolbar();
	if (!bar) return tableEl;
	tableToolbar.visible = true;
	bar.style.display = "flex";
	// 文章内容祖先带 transform，内部的 position:fixed 会相对该祖先定位，
	// 导致工具条实际跑到视口外；挂到 body 后 fixed 真正相对视口。
	if (bar.parentElement !== document.body) document.body.appendChild(bar);
	const rect = tableEl.getBoundingClientRect();
	const toolbarWidth = bar.offsetWidth || 420;
	const toolbarHeight = bar.offsetHeight || 48;
	let top = rect.top - toolbarHeight - 8;
	if (top < 76)
		top = Math.min(rect.bottom + 8, window.innerHeight - toolbarHeight - 8);
	const left = Math.max(
		8,
		Math.min(rect.left, window.innerWidth - toolbarWidth - 8),
	);
	bar.style.left = `${left}px`;
	bar.style.top = `${Math.max(76, top)}px`;
	return tableEl;
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
	// 优先定位光标(selection)实际所在的表格，其次是悬停表格，最后是第一个表格
	let tableEl: HTMLElement | null = null;
	const sel = window.getSelection();
	if (sel?.focusNode) {
		const host =
			sel.focusNode instanceof Element
				? sel.focusNode
				: sel.focusNode.parentElement;
		if (host) {
			tableEl = host.closest<HTMLElement>(
				".article-reading-body-editing .ProseMirror table",
			);
		}
	}
	if (!tableEl && hoverTableEl) tableEl = hoverTableEl;
	if (!tableEl) {
		tableEl = document.querySelector<HTMLElement>(
			".article-reading-body-editing .ProseMirror table",
		);
	}
	if (!tableEl) return null;
	return showTableToolbar(tableEl);
}

// 鼠标悬停表格时显示工具条（点击进入单元格的原有逻辑仍保留）
function onTableHover(event: Event) {
	const target = event.target;
	const tableEl =
		target instanceof Element ? target.closest<HTMLElement>("table") : null;
	if (!tableEl || !editorMount.contains(tableEl)) return;
	if (hoverTableEl === tableEl) return;
	hoverTableEl = tableEl;
	showTableToolbar(tableEl);
	requestAnimationFrame(() => {
		if (hoverTableEl === tableEl) showTableToolbar(tableEl);
	});
}

// 鼠标移出表格：延迟隐藏，隐藏前用鼠标真实位置兜底判断
function onTableHoverLeave(event: Event) {
	const current = event.currentTarget as HTMLElement | null;
	const related = (event as MouseEvent).relatedTarget;
	// 表格内部（td/tr 之间）移动也会触发 mouseout，此时不离开表格
	if (related instanceof Node && current?.contains(related)) return;
	if (related instanceof Element && related.closest(".table-toolbar")) return;
	// 移到另一个表格：切换目标，不隐藏
	const relatedTable =
		related instanceof Element ? related.closest("table") : null;
	if (relatedTable && hoverTableEl && relatedTable !== hoverTableEl) {
		hoverTableEl = relatedTable;
		showTableToolbar(relatedTable);
		return;
	}
	hoverTableEl = null;
	hideTableToolbarLater();
}

function onTableToolbarEnter() {
	clearTableHideTimer();
	hoverTableEl = null;
}

function onTableToolbarLeave() {
	hideTableToolbarLater();
}

function onTableMouseMove(event: Event) {
	const mouse = event as MouseEvent;
	lastMouseX = mouse.clientX;
	lastMouseY = mouse.clientY;
}

function onWindowScrollOrResize() {
	if (!tableToolbar.visible || !editor) return;
	const tableEl = hoverTableEl || positionTableToolbar();
	if (!tableEl) {
		hideTableToolbarNow();
		return;
	}
	const rect = tableEl.getBoundingClientRect();
	if (rect.bottom < 76 || rect.top > window.innerHeight) {
		hideTableToolbarNow();
		return;
	}
	showTableToolbar(tableEl);
}

function insertTable() {
	if (!editor) return;
	editor
		.chain()
		.focus()
		.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
		.run();
}

function selectTableForCommand(tableEl: HTMLElement | null) {
	if (!editor || !tableEl) return;
	// 当前 selection 已在目标表格内则无需切换
	const sel = window.getSelection();
	const selInTarget =
		sel?.focusNode && sel.focusNode.parentElement?.closest("table") === tableEl;
	if (selInTarget || editor.isActive("table")) return;
	const cell = tableEl.querySelector<HTMLElement>("td, th");
	if (!cell) return;
	try {
		const position = editor.view.posAtDOM(cell, 0) + 1;
		editor.chain().focus().setTextSelection(position).run();
	} catch {
		try {
			cell.click();
		} catch {
			/* 忽略 */
		}
	}
}

function runTableCommand(name: string) {
	if (!editor) return;
	selectTableForCommand(hoverTableEl || activeTableEl);
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
	}
	if (editorMount) {
		editorMount.removeEventListener("mouseover", onTableHover);
		editorMount.removeEventListener("mouseout", onTableHoverLeave);
	}
	document.removeEventListener("mousemove", onTableMouseMove);
	if (editor) editor.destroy();
	editor = null;
	editorReady = false;
	clearTableHideTimer();
	hoverTableEl = null;
	if (tableToolbarEl) {
		tableToolbarEl.remove();
		tableToolbarEl = null;
	}
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

function captureScrollAnchor() {
	editScrollY = window.scrollY;
	// 记录正文顶部在文档中的偏移，作为滚动恢复锚点：
	// 编辑模式会因 category-bar 隐藏/编辑器 UI 占位改变正文顶部位置，
	// 若直接恢复绝对 scrollY，正文相对视口会偏移导致视觉跳动。
	// 改为恢复"正文相对位置"（scrollY - 正文顶部偏移），使正文整体在视口
	// 中位置稳定。表格渲染差异已由 CSS 修复，正文容器 top 对齐足够可靠。
	const bodyEl = document.querySelector<HTMLElement>(".article-reading-body");
	editBodyAnchor = bodyEl
		? Math.round(bodyEl.getBoundingClientRect().top + window.scrollY)
		: 0;
}

function restoreScrollAfterEdit() {
	// 恢复滚动到"正文相对位置"：让编辑模式下正文容器顶部对应读模式的
	// 相对视口偏移一致（viewPortInBody 不变），从而保证正文整体在视口中
	// 位置稳定，避免 category-bar 隐藏 / editor-topbar 占位导致正文位移跳动。
	// 不做文本级锚点匹配：ProseMirror 与阅读模式块结构差异大（P 拆分、
	// td 内嵌 p 等），文本匹配不可靠，反而会导致回退/错位。
	// 表格渲染差异已通过 CSS 修复（table p 零 margin、display:table），
	// 编辑/阅读正文高度差从 +4930px 降到约 +1710px，正文容器 top 对齐后
	// 内部标题位置偏差集中在 ±150px 内，且正文整体稳定不跳。
	const maxScrollNow = () =>
		document.documentElement.scrollHeight - window.innerHeight;
	const scrollToEditY = () => {
		if (!mounted || !editing || editScrollY <= 0) return;
		const bodyEl = document.querySelector<HTMLElement>(".article-reading-body");
		const newAnchor = bodyEl
			? Math.round(bodyEl.getBoundingClientRect().top + window.scrollY)
			: editBodyAnchor;
		// 视口顶部相对正文的偏移在读模式为 (editScrollY - editBodyAnchor)，
		// 编辑模式保持该值不变
		const target = Math.min(
			editScrollY + (newAnchor - editBodyAnchor),
			Math.max(0, maxScrollNow()),
		);
		// 必须用瞬时滚动，且作用于 document.scrollingElement：
		// - 全局 scroll-behavior:smooth 会让 window.scrollTo 变成平滑动画
		// - 实测 360 浏览器下 window.scrollTo/scrollTop 赋值无效，
		//   只有 scrollingElement.scrollTo({behavior:'instant'}) 能瞬时生效
		document.scrollingElement?.scrollTo({
			top: Math.round(target),
			behavior: "instant",
		});
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
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if savedMessage}<p class="success">{savedMessage}</p>{/if}
  {#if sourceMode}<p class="source-note">源码模式：当前 Markdown 含有富文本编辑器无法解析的原始内容。</p><textarea class="source-editor" bind:this={sourceEditEl} bind:value={sourceValue} oninput={() => markDirty(true)} aria-label="Markdown 正文源码编辑器" spellcheck="false" disabled={!loaded}></textarea>{:else}<div class="tiptap-host prose dark:prose-invert prose-base max-w-none custom-md" bind:this={editorMount}></div>{/if}
 </section>
{/if}

<style>
 .ha-editor { color: var(--btn-content); } .statusline { display: flex; align-items: center; gap: .55rem; margin: .15rem 0 .25rem; } .edit-badge { flex: none; border: 1px solid var(--primary); border-radius: .4rem; padding: .12rem .5rem; color: var(--primary); font-size: .75rem; font-weight: 750; } .status { font-size: .75rem; opacity: .75; } .recover { border-color: color-mix(in srgb, #e0a23c 45%, transparent); color: #b7791f; } button { border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .35rem .6rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .78rem; cursor: pointer; } button:disabled { cursor: not-allowed; opacity: .5; } .primary { border-color: var(--primary); color: white; background: var(--primary); } .danger { color: #c74747; } .error { color: #c74747; font-size: .8rem; } .success { color: #27845f; font-size: .8rem; } .toolbar { position: sticky; top: 4.3rem; z-index: 20; display: flex; gap: .25rem; overflow-x: auto; margin: .35rem 0 .9rem; border-block: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); padding: .4rem .2rem; background: color-mix(in srgb, var(--card-bg) 94%, transparent); backdrop-filter: blur(10px); } .toolbar button { flex: 0 0 auto; min-width: 2rem; } .tiptap-host :global(.ProseMirror) { min-height: 26rem; outline: none; line-height: 1.75; } .tiptap-host :global(.ProseMirror pre) { margin: 0; overflow-x: auto; border-radius: .4rem; padding: .8rem; background: color-mix(in srgb, var(--btn-content) 8%, var(--card-bg)); } .tiptap-host :global(.ProseMirror table) { display: table; width: max-content; max-width: 100%; min-width: 100%; border-collapse: separate; border-spacing: 0; } .tiptap-host :global(.ProseMirror td), .tiptap-host :global(.ProseMirror th) { min-width: 120px; padding: 8px 12px; word-break: break-word; text-align: left; } .tiptap-host :global(.ProseMirror table p) { margin: 0; padding: 0; } .tiptap-host :global(.ProseMirror li p), .tiptap-host :global(.ProseMirror blockquote p) { margin: 0; padding: 0; } .tiptap-host :global(.ProseMirror table colgroup) { display: table-column-group; } .tiptap-host :global(.ProseMirror img) { max-width: 100%; height: auto; } .tiptap-host :global(.ProseMirror code) { font-size: .875em; } .source-note { margin-top: .5rem; color: color-mix(in srgb, var(--btn-content) 65%, transparent); font-size: .8rem; } .source-editor { display: block; width: 100%; min-height: 26rem; resize: vertical; font-family: var(--font-jetbrains-mono), monospace; font-size: .86rem; line-height: 1.65; border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .6rem; color: inherit; background: var(--card-bg); }
 :global([data-article-title].article-title-editing) { outline: 2px dashed color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 2px; border-radius: .25rem; }
 :global(.article-category-select), :global(.article-tags-input) { display: inline-block; max-width: 14rem; border: 1px dashed color-mix(in srgb, var(--primary) 45%, transparent); border-radius: .3rem; padding: .08rem .3rem; color: inherit; background: var(--card-bg); font: inherit; font-size: .78rem; }
 :global(.post-meta-cover .article-category-select), :global(.post-meta-cover .article-tags-input) { color: white; background: rgb(0 0 0 / .35); }
 :global(.table-toolbar) { position: fixed; z-index: 24; display: flex; flex-wrap: wrap; gap: .35rem; padding: .45rem .55rem; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: .7rem; background: color-mix(in srgb, var(--card-bg) 94%, transparent); backdrop-filter: blur(10px); box-shadow: 0 10px 28px color-mix(in srgb, var(--btn-content) 10%, transparent); } :global(.table-toolbar button) { flex: 0 0 auto; min-width: 3.6rem; border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .3rem .55rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .78rem; cursor: pointer; } :global(.table-toolbar button:hover) { border-color: color-mix(in srgb, var(--primary) 45%, transparent); transform: translateY(-1px); } :global(.table-toolbar .danger) { color: #c74747; }
 @media (max-width: 760px) { .toolbar { top: 3.6rem; } }
</style>
