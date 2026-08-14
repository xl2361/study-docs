<script lang="ts">
import { TextSelection } from "prosemirror-state";
import { CellSelection, tableEditingKey } from "prosemirror-tables";
import { onMount, tick } from "svelte";
import { FontSize } from "@/extensions/FontSize";
import { Indent } from "@/extensions/Indent";
import EditorToolbar from "./EditorToolbar.svelte";

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
	isActive: (name: string, attributes?: Record<string, unknown>) => boolean;
	getAttributes: (name: string) => Record<string, unknown>;
	state: {
		selection: {
			$from: {
				marks: () => Array<{
					type: { name: string };
					attrs: Record<string, unknown>;
				}>;
			};
		};
	};
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
	toggleUnderline: () => EditorChain;
	toggleSubscript: () => EditorChain;
	toggleSuperscript: () => EditorChain;
	toggleHeading: (options: { level: number }) => EditorChain;
	setParagraph: () => EditorChain;
	toggleBulletList: () => EditorChain;
	toggleOrderedList: () => EditorChain;
	toggleTaskList: () => EditorChain;
	toggleBlockquote: () => EditorChain;
	toggleCodeBlock: () => EditorChain;
	setHorizontalRule: () => EditorChain;
	setColor: (color: string) => EditorChain;
	unsetColor: () => EditorChain;
	toggleHighlight: (options: { color: string }) => EditorChain;
	unsetHighlight: () => EditorChain;
	setTextAlign: (alignment: string) => EditorChain;
	setFontSize: (size: string) => EditorChain;
	unsetFontSize: () => EditorChain;
	indent: () => EditorChain;
	outdent: () => EditorChain;
	setLink: (options: { href: string }) => EditorChain;
	unsetLink: () => EditorChain;
	unsetAllMarks: () => EditorChain;
	clearNodes: () => EditorChain;
	deleteSelection: () => EditorChain;
	setMark: (name: string, attributes: Record<string, unknown>) => EditorChain;
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
let painterActive = false;
let painterMarks: Array<{
	name: string;
	attrs: Record<string, unknown>;
}> = [];
let activeState = {
	bold: false,
	italic: false,
	strike: false,
	underline: false,
	subscript: false,
	superscript: false,
	paragraph: true,
	headingLevel: 0,
	textAlign: null as string | null,
	bulletList: false,
	orderedList: false,
	taskList: false,
	blockquote: false,
	link: false,
	color: null as string | null,
	highlight: null as string | null,
	fontSize: null as string | null,
};
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
// 自研划选拖拽：起点 cell pos（mousedown 记录，mouseup 清理）
let cellDragStartPos: number | null = null;
// 自研划选拖拽：是否已越过位移阈值进入拖动（拖动中才 preventDefault，
// 避免杀死 PM 单击定位依赖的浏览器默认光标行为）
let cellDragging = false;
let cellDragClientX = 0;
let cellDragClientY = 0;
// 单击（未拖动）时用于手动 dispatch 光标定位的点击 pos
let cellDragClickPos: number | null = null;
let tableToolbarEl: HTMLElement | null = null;
let dragHandleEl: HTMLDivElement | null = null;
let rowHandleEl: HTMLDivElement | null = null;
let colHandleEl: HTMLDivElement | null = null;
let tableHideTimer: ReturnType<typeof setTimeout> | null = null;
let lastMouseX = 0;
let lastMouseY = 0;
let pointerRefreshPending = false;
let pointerRefreshRaf = 0;

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
		const [
			core,
			starter,
			markdown,
			table,
			image,
			sub,
			sup,
			textStyle,
			color,
			highlight,
			textAlign,
			taskList,
			taskItem,
		] = await Promise.all([
			import("@tiptap/core"),
			import("@tiptap/starter-kit"),
			import("@tiptap/markdown"),
			import("@tiptap/extension-table"),
			import("@tiptap/extension-image"),
			import("@tiptap/extension-subscript"),
			import("@tiptap/extension-superscript"),
			import("@tiptap/extension-text-style"),
			import("@tiptap/extension-color"),
			import("@tiptap/extension-highlight"),
			import("@tiptap/extension-text-align"),
			import("@tiptap/extension-task-list"),
			import("@tiptap/extension-task-item"),
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
				starter.default.configure({
					link: { openOnClick: false, autolink: false },
					underline: {},
				}),
				markdown.Markdown,
				table.TableKit,
				image.default,
				sub.default,
				sup.default,
				textStyle.TextStyle,
				color.default,
				highlight.default.configure({ multicolor: true }),
				textAlign.default.configure({ types: ["heading", "paragraph"] }),
				taskList.default.configure({ itemTypeName: "taskItem" }),
				taskItem.default,
				FontSize,
				Indent,
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
		document.addEventListener("mousemove", onTableMouseMove);
		document.addEventListener("mousedown", onTableDocMouseDown);
		document.addEventListener("mouseup", onTableDocMouseUp, true);
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
	if (!editor) return;
	const is = (name: string, attrs?: Record<string, unknown>) =>
		Boolean(editor?.isActive(name, attrs));
	const paragraphAttrs = editor.getAttributes("paragraph") as Record<
		string,
		unknown
	>;
	const headingAttrs = editor.getAttributes("heading") as Record<
		string,
		unknown
	>;
	const textStyleAttrs = editor.getAttributes("textStyle") as Record<
		string,
		unknown
	>;
	activeState = {
		bold: is("bold"),
		italic: is("italic"),
		strike: is("strike"),
		underline: is("underline"),
		subscript: is("subscript"),
		superscript: is("superscript"),
		paragraph: is("paragraph"),
		headingLevel: is("heading") ? Number(headingAttrs.level ?? 0) : 0,
		textAlign: (String(paragraphAttrs.textAlign ?? "") ||
			String(headingAttrs.textAlign ?? "") ||
			null) as string | null,
		bulletList: is("bulletList"),
		orderedList: is("orderedList"),
		taskList: is("taskList"),
		blockquote: is("blockquote"),
		link: is("link"),
		color: (String(textStyleAttrs.color ?? "") || null) as string | null,
		highlight: is("highlight")
			? String(editor.getAttributes("highlight").color ?? "#ffe08a")
			: null,
		fontSize: (String(textStyleAttrs.fontSize ?? "") || null) as string | null,
	};
}

function onTableSelectionChange() {
	const tableEl = positionTableToolbar();
	if (
		!tableEl &&
		!hoverTableEl &&
		!tableToolbarEl?.matches(":hover") &&
		!pointerOverTableOrToolbar()
	) {
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
	if (
		el?.closest(".article-reading-body-editing .ProseMirror table") ||
		el?.closest(".table-toolbar")
	)
		return true;
	// 间隙带保持区：鼠标从表格移向工具条途中会经过这段空隙，
	// 360 下事件节流导致 mousemove 延迟到达时，定时器兜底判定若只认
	// elementFromPoint 会把间隙误判为"已离开"而闪隐。
	return inGapKeepZone();
}

// 工具条与表格之间的间隙带（含两者矩形外扩 4px）视为保持区。
function inGapKeepZone() {
	if (!tableToolbar.visible || !tableToolbarEl || !activeTableEl) return false;
	const tb = tableToolbarEl.getBoundingClientRect();
	const tr = activeTableEl.getBoundingClientRect();
	return (
		lastMouseX >= Math.min(tb.left, tr.left) - 4 &&
		lastMouseX <= Math.max(tb.right, tr.right) + 4 &&
		lastMouseY >= Math.min(tb.top, tr.top) - 4 &&
		lastMouseY <= Math.max(tb.bottom, tr.bottom) + 4
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

const tableCommands: Array<[string, string, string]> = [
	["addRowBefore", "上方插入行", "上插行"],
	["addRowAfter", "下方插入行", "下插行"],
	["addColumnBefore", "左侧插入列", "左插列"],
	["addColumnAfter", "右侧插入列", "右插列"],
	["mergeCells", "合并单元格", "合并"],
	["splitCell", "拆分单元格", "拆分"],
	["deleteRow", "删除当前行", "删行"],
	["deleteColumn", "删除当前列", "删列"],
	["toggleHeaderRow", "表头行", "表头"],
	["deleteTable", "删除整个表格", "删表"],
];

function ensureTableToolbar(): HTMLElement | null {
	if (tableToolbarEl?.isConnected) return tableToolbarEl;
	const bar = document.createElement("div");
	bar.className = "table-toolbar";
	bar.setAttribute("role", "toolbar");
	bar.setAttribute("aria-label", "表格操作");
	for (const [cmd, label, text] of tableCommands) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.title = label;
		btn.textContent = text;
		if (cmd === "deleteTable") btn.classList.add("danger");
		btn.addEventListener("click", () => runTableCommand(cmd));
		btn.addEventListener("mousemove", () => schedulePointerRefresh());
		bar.appendChild(btn);
	}
	document.body.appendChild(bar);
	tableToolbarEl = bar;
	return bar;
}

// 左上角拖拽手柄：6 点图标，鼠标移到表格时显示，长按拖动可移动整个表格。
// 不采用 PM 原生 node 拖拽（原生拖拽需在 draggable 元素上按下鼠标，手柄在表格
// 外按下无法启动），改为自定义拖拽：幽灵副本跟随 + mouseup 计算插入位置 + transaction 移动。
function ensureDragHandle(): HTMLDivElement | null {
	if (dragHandleEl?.isConnected) return dragHandleEl;
	const handle = document.createElement("div");
	handle.className = "table-drag-handle";
	handle.setAttribute("role", "button");
	handle.setAttribute("aria-label", "拖拽移动表格");
	handle.title = "拖拽移动表格";
	document.body.appendChild(handle);
	handle.addEventListener("mousedown", onDragHandleMouseDown);
	dragHandleEl = handle;
	return handle;
}

// 表格级手柄：鼠标移到表格左上角对角区域时显示，固定在表格左上角外侧（不遮挡鼠标）
function positionDragHandle(tableEl: HTMLElement) {
	const handle = ensureDragHandle();
	if (!handle) return;
	const rect = tableEl.getBoundingClientRect();
	handle.style.left = `${Math.max(2, rect.left - 8)}px`;
	handle.style.top = `${Math.max(2, rect.top - 8)}px`;
	handle.style.display = "grid";
}

function hideDragHandle() {
	if (dragHandleEl) dragHandleEl.style.display = "none";
}

// 行手柄：鼠标移到某行最左边缘时显示在表格左外侧（垂直位置跟随鼠标），按住可拖动整行。
function ensureRowHandle(): HTMLDivElement | null {
	if (rowHandleEl?.isConnected) return rowHandleEl;
	const handle = document.createElement("div");
	handle.className = "table-row-handle";
	handle.setAttribute("role", "button");
	handle.setAttribute("aria-label", "拖拽移动此行");
	handle.title = "拖拽移动此行";
	document.body.appendChild(handle);
	handle.addEventListener("mousedown", onRowHandleMouseDown);
	rowHandleEl = handle;
	return handle;
}

function positionRowHandle(tableEl: HTMLElement, rowIndex: number, my: number) {
	const handle = ensureRowHandle();
	if (!handle || rowIndex < 0) return;
	const row = tableEl.rows[rowIndex];
	if (!row) return;
	const tableRect = tableEl.getBoundingClientRect();
	handle.style.left = `${Math.max(2, tableRect.left - 15)}px`;
	handle.style.top = `${Math.max(2, my - 6)}px`;
	handle.style.display = "block";
}

function hideRowHandle() {
	if (rowHandleEl) rowHandleEl.style.display = "none";
}

// 列手柄：鼠标移到某列上边缘时显示在表格上外侧（水平位置跟随鼠标），按住可拖动整列。
function ensureColHandle(): HTMLDivElement | null {
	if (colHandleEl?.isConnected) return colHandleEl;
	const handle = document.createElement("div");
	handle.className = "table-col-handle";
	handle.setAttribute("role", "button");
	handle.setAttribute("aria-label", "拖拽移动此列");
	handle.title = "拖拽移动此列";
	document.body.appendChild(handle);
	handle.addEventListener("mousedown", onColHandleMouseDown);
	colHandleEl = handle;
	return handle;
}

function positionColHandle(tableEl: HTMLElement, colIndex: number, mx: number) {
	const handle = ensureColHandle();
	if (!handle || colIndex < 0) return;
	const cell = tableEl.rows[0]?.cells[colIndex];
	if (!cell) return;
	const tableRect = tableEl.getBoundingClientRect();
	handle.style.left = `${Math.max(2, mx - 7)}px`;
	handle.style.top = `${Math.max(2, tableRect.top - 15)}px`;
	handle.style.display = "block";
}

function hideColHandle() {
	if (colHandleEl) colHandleEl.style.display = "none";
}

// 鼠标 y 落在哪一行（表格内），不在任何行内返回 -1
function rowFromY(tableEl: HTMLElement, y: number): number {
	const rows = [...tableEl.rows];
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i].getBoundingClientRect();
		if (y >= r.top && y < r.bottom) return i;
	}
	return -1;
}

// 鼠标 x 落在哪一列（表格内），不在任何列内返回 -1
function colFromX(tableEl: HTMLElement, x: number): number {
	const cells = [...tableEl.rows[0].cells];
	for (let i = 0; i < cells.length; i++) {
		const r = cells[i].getBoundingClientRect();
		if (x >= r.left && x < r.right) return i;
	}
	return -1;
}

// 手柄触发判定：手柄随鼠标位置浮动
// - 左上角对角区域（表格内第一行第一列交汇处）→ 表格级手柄
// - 某行最左边缘（表格左边缘带内）→ 行手柄
// - 某列上边缘（表格上边缘带内）→ 列手柄
// - 表格中间 → 不显示任何手柄
const HANDLE_EDGE = 12;

function updateHandlesForPointer(tableEl: HTMLElement, mx: number, my: number) {
	const rect = tableEl.getBoundingClientRect();
	if (mx <= rect.left + HANDLE_EDGE && my <= rect.top + HANDLE_EDGE) {
		hoverRowIndex = -1;
		hoverColIndex = -1;
		hideRowHandle();
		hideColHandle();
		positionDragHandle(tableEl);
	} else if (mx <= rect.left + HANDLE_EDGE) {
		const ri = rowFromY(tableEl, my);
		hoverRowIndex = ri;
		hoverColIndex = -1;
		hideColHandle();
		hideDragHandle();
		if (ri >= 0) positionRowHandle(tableEl, ri, my);
		else hideRowHandle();
	} else if (my <= rect.top + HANDLE_EDGE) {
		const ci = colFromX(tableEl, mx);
		hoverColIndex = ci;
		hoverRowIndex = -1;
		hideRowHandle();
		hideDragHandle();
		if (ci >= 0) positionColHandle(tableEl, ci, mx);
		else hideColHandle();
	} else {
		hoverRowIndex = -1;
		hoverColIndex = -1;
		hideDragHandle();
		hideRowHandle();
		hideColHandle();
	}
}

function hideTableToolbarNow() {
	clearTableHideTimer();
	hoverTableEl = null;
	activeTableEl = null;
	hoverRowIndex = -1;
	hoverColIndex = -1;
	tableToolbar = { visible: false, left: 0, top: 0 };
	hideDragHandle();
	hideRowHandle();
	hideColHandle();
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

// 指针轮询：mousemove 时用 elementFromPoint 判定鼠标落在哪，稳定显示/隐藏表格工具条。
// 相比 mouseover/mouseout 方案，360 的 relatedTarget 不可靠会导致工具条闪现即失，
// 这里完全绕开 event.relatedTarget，鼠标真实坐标判定对真实操作最稳。
function refreshTableToolbarByPointer() {
	pointerRefreshPending = false;
	if (!editor || sourceMode) return;
	// 拖拽中不刷新工具条/手柄，避免幽灵跟随被 rAF 干扰
	if (tableDrag || lineDrag) return;
	const target = document.elementFromPoint(lastMouseX, lastMouseY);
	if (!target) {
		hideTableToolbarLater();
		return;
	}
	const tableEl = target.closest<HTMLElement>(
		".article-reading-body-editing .ProseMirror table",
	);
	if (tableEl) {
		hoverTableEl = tableEl;
		showTableToolbar(tableEl);
		updateHandlesForPointer(tableEl, lastMouseX, lastMouseY);
		return;
	}
	// 鼠标不在表格元素上：若仍处于 hover 表格的边缘带（表格外 ±HANDLE_EDGE），
	// 保持显示并按边缘位置更新手柄（行左边缘/列上边缘/左上角对角都在表格外触发）
	if (hoverTableEl?.isConnected) {
		const rect = hoverTableEl.getBoundingClientRect();
		const inBand =
			lastMouseX >= rect.left - HANDLE_EDGE &&
			lastMouseX <= rect.right + HANDLE_EDGE &&
			lastMouseY >= rect.top - HANDLE_EDGE &&
			lastMouseY <= rect.bottom + HANDLE_EDGE;
		if (inBand) {
			clearTableHideTimer();
			showTableToolbar(hoverTableEl);
			updateHandlesForPointer(hoverTableEl, lastMouseX, lastMouseY);
			return;
		}
	}
	// 鼠标落在任意手柄上：保持手柄显示，等待按下拖拽
	if (
		target.closest(".table-drag-handle") ||
		target.closest(".table-row-handle") ||
		target.closest(".table-col-handle")
	) {
		clearTableHideTimer();
		hoverTableEl = null;
		return;
	}
	hideDragHandle();
	hideRowHandle();
	hideColHandle();
	if (target.closest(".table-toolbar")) {
		clearTableHideTimer();
		hoverTableEl = null;
		return;
	}
	// 间隙带保持区：鼠标从表格移向工具条途中会经过这段空隙，
	// 360 事件节流下 mousemove 延迟到达时定时器先触发，若只认 elementFromPoint
	// 会把间隙误判为"已离开"而闪隐。这里复用本次 hit-test 的 target 判定保持区。
	hoverTableEl = null;
	if (tableToolbar.visible && inGapKeepZone()) {
		clearTableHideTimer();
		return;
	}
	if (tableToolbar.visible) hideTableToolbarLater();
}

function schedulePointerRefresh() {
	if (pointerRefreshPending) return;
	pointerRefreshPending = true;
	cancelAnimationFrame(pointerRefreshRaf);
	pointerRefreshRaf = requestAnimationFrame(refreshTableToolbarByPointer);
}

function onTableMouseMove(event: Event) {
	const mouse = event as MouseEvent;
	lastMouseX = mouse.clientX;
	lastMouseY = mouse.clientY;
	schedulePointerRefresh();
}

// 点击页面任意处：若点在表格/工具条外，立刻收起；点在表格内则保持显示
function onTableDocMouseDown(event: Event) {
	if (!editor || sourceMode) return;
	const target = event.target as Element | null;
	if (!target) return;
	const mouse = event as MouseEvent;
	const tableEl = target.closest<HTMLElement>(
		".article-reading-body-editing .ProseMirror table",
	);
	// 左键无修饰键的按下：统一注册拖动监听。
	// - 起点在 cell 内：立即记录起点并 preventDefault（阻止原生文本选择）；
	// - 起点在 cell 外：不 preventDefault（保留正常文本选择/定位），
	//   鼠标拖入 cell 时由 onCellDragMove 接管划选。
	if (
		mouse.button === 0 &&
		!mouse.shiftKey &&
		!mouse.ctrlKey &&
		!mouse.metaKey
	) {
		if (tableEl) {
			const cell = target.closest<HTMLElement>("td, th");
			if (cell) {
				// 阻止浏览器原生文本选择：拖动划选完全由我们自己 dispatch
				// CellSelection 管理，mouseup 后 PM 读回空选择就不会覆盖多选高亮。
				// 单击定位不能依赖 PM/浏览器默认（preventDefault 会杀死原生光标
				// 行为），改为在 mouseup 时手动 dispatch TextSelection 定位。
				event.preventDefault();
				const pm = document.querySelector(".ProseMirror");
				if (pm && document.activeElement !== pm) {
					(pm as HTMLElement).focus({ preventScroll: true });
				}
				try {
					const p = editor.view.posAtCoords({
						left: mouse.clientX,
						top: mouse.clientY,
					});
					cellDragClickPos = p ? p.pos : null;
				} catch {
					cellDragClickPos = null;
				}
				let pos: number | null = null;
				try {
					const startPos = editor.view.posAtDOM(cell, 0);
					const $s = editor.state.doc.resolve(startPos);
					for (let d = $s.depth; d > 0; d--) {
						const role = $s.node(d).type.spec.tableRole;
						if (role === "cell" || role === "header_cell") {
							pos = $s.before(d);
							break;
						}
					}
				} catch {
					pos = null;
				}
				cellDragStartPos = pos;
				cellDragging = false;
				cellDragClientX = mouse.clientX;
				cellDragClientY = mouse.clientY;
				if (pos != null) {
					// 重置 tableEditing 的拖选 anchor：prosemirror-tables 的 stop()
					// 会在 mouseup 时写入 -1，下一次拖动时其 move() 对 -1 执行
					// doc.resolve(-1) 会抛 RangeError 导致拖动失效；这里把 anchor
					// 重置为本次拖动起点，既避免崩溃又让库自身逻辑从正确起点走。
					try {
						editor.view.dispatch(editor.state.tr.setMeta(tableEditingKey, pos));
					} catch {
						/* 忽略 */
					}
				}
			} else {
				cellDragStartPos = null;
				cellDragging = false;
				cellDragClickPos = null;
			}
			document.addEventListener("mousemove", onCellDragMove);
			document.addEventListener("mouseup", onCellDragUp);
		} else if (mouse.button === 0) {
			// 表格外按下：注册监听，若拖入表格则接管划选；否则不影响原生文本选择
			cellDragStartPos = null;
			cellDragging = false;
			cellDragClickPos = null;
			document.addEventListener("mousemove", onCellDragMove);
			document.addEventListener("mouseup", onCellDragUp);
		}
	}
	if (tableEl) {
		hoverTableEl = tableEl;
		showTableToolbar(tableEl);
		updateHandlesForPointer(tableEl, mouse.clientX, mouse.clientY);
		return;
	}
	if (target.closest(".table-toolbar")) return;
	if (target.closest(".table-drag-handle")) return;
	if (target.closest(".table-row-handle")) return;
	if (target.closest(".table-col-handle")) return;
	hoverTableEl = null;
	hideTableToolbarNow();
}

// 拖动中：把鼠标所在 cell 与起点 cell 组成 CellSelection 直接 dispatch，
// 高亮由 drawCellSelection 装饰渲染，不依赖原生文本选择。
function onCellDragMove(event: MouseEvent) {
	if (!editor || sourceMode) return;
	// 起点未记录（mousedown 在 cell 外）：拖入 cell 时接管划选
	if (cellDragStartPos == null) {
		if (event.buttons !== 1) return;
		const p = editor.view.posAtCoords({
			left: event.clientX,
			top: event.clientY,
		});
		if (!p) return;
		const $p = editor.state.doc.resolve(p.pos);
		let cellPos: number | null = null;
		for (let d = $p.depth; d > 0; d--) {
			const role = $p.node(d).type.spec.tableRole;
			if (role === "cell" || role === "header_cell") {
				cellPos = $p.before(d);
				break;
			}
		}
		if (cellPos == null) return;
		// 进入表格：接管拖动，清除 mousedown 后可能已开始的原生文本选择
		cellDragStartPos = cellPos;
		cellDragging = true;
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) sel.removeAllRanges();
		try {
			editor.view.dispatch(editor.state.tr.setMeta(tableEditingKey, cellPos));
		} catch {
			/* 忽略 */
		}
	} else if (!cellDragging) {
		// 位移未越过阈值视为单击（允许 PM/浏览器正常定位光标），不 preventDefault
		const dx = event.clientX - cellDragClientX;
		const dy = event.clientY - cellDragClientY;
		if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return;
		cellDragging = true;
	}
	// 拖动已开始：阻止浏览器原生文本选择，避免覆盖 CellSelection 高亮
	event.preventDefault();
	const pos = editor.view.posAtCoords({
		left: event.clientX,
		top: event.clientY,
	});
	if (!pos) return;
	const $p = editor.state.doc.resolve(pos.pos);
	let cellPos: number | null = null;
	for (let d = $p.depth; d > 0; d--) {
		const role = $p.node(d).type.spec.tableRole;
		if (role === "cell" || role === "header_cell") {
			cellPos = $p.before(d);
			break;
		}
	}
	if (cellPos == null) return;
	try {
		const cellSel = CellSelection.create(
			editor.state.doc,
			cellDragStartPos,
			cellPos,
		);
		if (!editor.state.selection.eq(cellSel)) {
			editor.view.dispatch(editor.state.tr.setSelection(cellSel));
		}
	} catch {
		/* 跨表/异常情况忽略 */
	}
}

function onCellDragUp() {
	document.removeEventListener("mousemove", onCellDragMove);
	document.removeEventListener("mouseup", onCellDragUp);
	const wasDragging = cellDragging;
	const clickPos = cellDragClickPos;
	cellDragStartPos = null;
	cellDragging = false;
	cellDragClickPos = null;
	if (wasDragging) {
		// 拖动过：清除残留 DOM 选择（正常路径 preventDefault 后不会有原生选择）
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) sel.removeAllRanges();
	} else if (clickPos != null && editor && !sourceMode) {
		// 单击：mousedown 被 preventDefault 后浏览器/PM 都不会定位光标，
		// 这里手动 dispatch 光标定位（等价 PM 单击定位行为）。
		try {
			editor.view.dispatch(
				editor.state.tr.setSelection(
					TextSelection.near(editor.state.doc.resolve(clickPos)),
				),
			);
		} catch {
			/* 忽略 */
		}
	}
}

// 拖拽划选结束后，浏览器若仍有残留原生文本选择，prosemirror 会在
// selectionchange 时把它读回为文本选择，覆盖掉 CellSelection（多选/全选状态）。
// 必须在 capture 阶段（true）抢在 prosemirror 的 bubble 阶段处理之前清除残留
// DOM 选择，否则 PM 已把文本选择写回 state。
function onTableDocMouseUp(event: Event) {
	const target = event.target as Element | null;
	if (!target?.closest(".article-reading-body-editing .ProseMirror table")) {
		return;
	}
	const pm = document.querySelector(".ProseMirror");
	if (!pm?.querySelector("td.selectedCell, th.selectedCell")) return;
	const sel = window.getSelection();
	if (sel && !sel.isCollapsed) sel.removeAllRanges();
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

type TableDragState = {
	tableEl: HTMLElement;
	startX: number;
	startY: number;
	offsetX: number;
	offsetY: number;
	ghost: HTMLElement | null;
	active: boolean;
};

let tableDrag: TableDragState | null = null;

// 手柄按下：阻止默认行为（不放光标、不选文本），监听移动/松开。
// 移动超过阈值进入拖拽（幽灵跟随），未超阈值视为点击（只显示工具条，无副作用）。
// 松开时若处于拖拽：计算目标插入位置并移动表格节点。
function onDragHandleMouseDown(event: MouseEvent) {
	if (event.button !== 0 || !editor) return;
	event.preventDefault();
	const tableEl = activeTableEl ?? hoverTableEl;
	if (!tableEl) return;
	const rect = tableEl.getBoundingClientRect();
	tableDrag = {
		tableEl,
		startX: event.clientX,
		startY: event.clientY,
		offsetX: event.clientX - rect.left,
		offsetY: event.clientY - rect.top,
		ghost: null,
		active: false,
	};
	document.body.classList.add("table-dragging");
	document.addEventListener("mousemove", onDragHandleMove);
	document.addEventListener("mouseup", onDragHandleUp);
}

function onDragHandleMove(event: MouseEvent) {
	if (!tableDrag) return;
	const dx = event.clientX - tableDrag.startX;
	const dy = event.clientY - tableDrag.startY;
	if (!tableDrag.active) {
		if (Math.hypot(dx, dy) < 4) return;
		tableDrag.active = true;
		if (!tableDrag.ghost) {
			const ghost = tableDrag.tableEl.cloneNode(true) as HTMLElement;
			ghost.className = "table-drag-ghost";
			ghost.style.left = `${event.clientX - tableDrag.offsetX}px`;
			ghost.style.top = `${event.clientY - tableDrag.offsetY}px`;
			document.body.appendChild(ghost);
			tableDrag.ghost = ghost;
		}
		hideDragHandle();
		return;
	}
	if (tableDrag.ghost) {
		tableDrag.ghost.style.left = `${event.clientX - tableDrag.offsetX}px`;
		tableDrag.ghost.style.top = `${event.clientY - tableDrag.offsetY}px`;
	}
}

function onDragHandleUp(event: MouseEvent) {
	document.removeEventListener("mousemove", onDragHandleMove);
	document.removeEventListener("mouseup", onDragHandleUp);
	document.body.classList.remove("table-dragging");
	const drag = tableDrag;
	tableDrag = null;
	hideDragHandle();
	if (!drag) return;
	if (!drag.active || !editor) return;
	drag.ghost?.remove();
	dropTableAt(drag.tableEl, event.clientX, event.clientY);
}

// 计算松手位置的块级插入点并移动表格（含目标在原表格范围内的原地保护）
function dropTableAt(tableEl: HTMLElement, clientX: number, clientY: number) {
	if (!editor) return;
	const state = editor.state;
	let domPos: number;
	try {
		domPos = editor.view.posAtDOM(tableEl, 0);
	} catch {
		return;
	}
	const doc = state.doc;
	const $p = doc.resolve(domPos);
	const nodePos = $p.before($p.depth);
	const tableNode = $p.node($p.depth);
	if (tableNode?.type.name !== "table") return;
	const size = tableNode.nodeSize;
	const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
	if (!coords) return;
	// 目标位置：从浅到深找第一个块级边界，光标在块内时按中点分界对齐到块前/块后。
	// 从 doc 层开始，保证目标点是 table 允许放置的位置（不会落到 cell 内等非法处）。
	let insertPos = coords.pos;
	const $t = doc.resolve(insertPos);
	for (let d = 1; d <= $t.depth; d++) {
		if (!$t.node(d).type.isBlock) continue;
		const start = $t.before(d);
		const end = $t.after(d);
		if (insertPos > start && insertPos < end) {
			insertPos = insertPos - start < (end - start) / 2 ? start : end;
		}
		break;
	}
	// 原地保护：目标落在原表格节点范围内（含其前后紧邻）则视为未移动
	if (insertPos >= nodePos && insertPos <= nodePos + size) return;
	let tr = state.tr;
	tr.delete(nodePos, nodePos + size);
	const mapped = tr.mapping.map(insertPos);
	tr.insert(mapped, tableNode);
	editor.view.dispatch(tr);
	refreshToolbarAfterDispatch();
}

// 表格节点被事务替换后旧 DOM 引用失效，收起旧工具条并在下一帧定位到新表格
function refreshToolbarAfterDispatch() {
	hoverTableEl = null;
	activeTableEl = null;
	hideTableToolbarNow();
	requestAnimationFrame(() => {
		if (!editor) return;
		const nt = document.querySelector<HTMLElement>(
			".article-reading-body-editing .ProseMirror table",
		);
		if (nt) {
			hoverTableEl = nt;
			showTableToolbar(nt);
		}
	});
}

type LineDragState = {
	kind: "row" | "col";
	tableEl: HTMLElement;
	index: number;
	startX: number;
	startY: number;
	highlightCells: HTMLElement[];
	active: boolean;
};

let lineDrag: LineDragState | null = null;
let hoverRowIndex = -1;
let hoverColIndex = -1;
let dropLineEl: HTMLDivElement | null = null;
let dragBadgeEl: HTMLDivElement | null = null;

function onRowHandleMouseDown(event: MouseEvent) {
	onLineHandleMouseDown("row", event);
}

function onColHandleMouseDown(event: MouseEvent) {
	onLineHandleMouseDown("col", event);
}

// 行/列手柄按下：记录拖拽起点，超过阈值进入拖拽（高亮被拖行/列 + 插入指示线 + 气泡），
// 松手移动整行/整列。
function onLineHandleMouseDown(kind: "row" | "col", event: MouseEvent) {
	if (event.button !== 0 || !editor) return;
	event.preventDefault();
	const tableEl = activeTableEl ?? hoverTableEl;
	if (!tableEl) return;
	const self = kind === "row" ? rowHandleEl : colHandleEl;
	if (!self) return;
	lineDrag = {
		kind,
		tableEl,
		index: kind === "row" ? hoverRowIndex : hoverColIndex,
		startX: event.clientX,
		startY: event.clientY,
		highlightCells: [],
		active: false,
	};
	document.body.classList.add("table-dragging");
	document.addEventListener("mousemove", onLineHandleMove);
	document.addEventListener("mouseup", onLineHandleUp);
}

function onLineHandleMove(event: MouseEvent) {
	if (!lineDrag) return;
	const dx = event.clientX - lineDrag.startX;
	const dy = event.clientY - lineDrag.startY;
	if (!lineDrag.active) {
		if (Math.hypot(dx, dy) < 4) return;
		lineDrag.active = true;
		applyLineHighlight(lineDrag);
		hideDragHandle();
		hideRowHandle();
		hideColHandle();
		return;
	}
	updateLineDragFeedback(lineDrag, event);
}

function onLineHandleUp(event: MouseEvent) {
	document.removeEventListener("mousemove", onLineHandleMove);
	document.removeEventListener("mouseup", onLineHandleUp);
	document.body.classList.remove("table-dragging");
	const drag = lineDrag;
	lineDrag = null;
	hideDragHandle();
	hideRowHandle();
	hideColHandle();
	clearLineHighlight(drag);
	hideDropLine();
	hideDragBadge();
	if (!drag) return;
	if (!drag.active || !editor) return;
	if (drag.kind === "row") {
		const toIndex = hitRowIndex(drag.tableEl, event.clientY);
		moveTableRow(drag.tableEl, drag.index, toIndex);
	} else {
		const toIndex = hitColIndex(drag.tableEl, event.clientX);
		moveTableColumn(drag.tableEl, drag.index, toIndex);
	}
}

// 拖拽激活：被拖行/列的所有单元格加浅蓝高亮（复刻语雀式拖拽反馈）
function applyLineHighlight(drag: LineDragState) {
	const cells: HTMLElement[] = [];
	if (drag.kind === "row") {
		const row = drag.tableEl.rows[drag.index];
		if (row) cells.push(...([...row.cells] as HTMLElement[]));
	} else {
		[...drag.tableEl.rows].forEach((r) => {
			const cell = r.cells[drag.index];
			if (cell) cells.push(cell);
		});
	}
	cells.forEach((cell) => {
		cell.classList.add("table-drag-source");
	});
	drag.highlightCells = cells;
}

function clearLineHighlight(drag: LineDragState | null) {
	drag?.highlightCells.forEach((cell) => {
		cell.classList.remove("table-drag-source");
	});
}

function ensureDropLine(): HTMLDivElement | null {
	if (dropLineEl?.isConnected) return dropLineEl;
	const el = document.createElement("div");
	el.className = "table-drop-line";
	document.body.appendChild(el);
	dropLineEl = el;
	return el;
}

function ensureDragBadge(): HTMLDivElement | null {
	if (dragBadgeEl?.isConnected) return dragBadgeEl;
	const el = document.createElement("div");
	el.className = "table-drag-badge";
	document.body.appendChild(el);
	dragBadgeEl = el;
	return el;
}

function hideDropLine() {
	if (dropLineEl) dropLineEl.style.display = "none";
}

function hideDragBadge() {
	if (dragBadgeEl) dragBadgeEl.style.display = "none";
}

// 拖拽移动中：更新插入位置指示线（蓝色线条）与气泡（正在移动1行/1列）
function updateLineDragFeedback(drag: LineDragState, event: MouseEvent) {
	const line = ensureDropLine();
	const badge = ensureDragBadge();
	if (!line || !badge) return;
	const rect = drag.tableEl.getBoundingClientRect();
	if (drag.kind === "row") {
		const ti = hitRowIndex(drag.tableEl, event.clientY);
		const rows = [...drag.tableEl.rows];
		const y =
			ti <= 0
				? rect.top
				: ti >= rows.length
					? rect.bottom
					: rows[ti].getBoundingClientRect().top;
		line.style.left = `${rect.left}px`;
		line.style.top = `${y - 1.5}px`;
		line.style.width = `${rect.width}px`;
		line.style.height = "3px";
		badge.textContent = "正在移动1行";
	} else {
		const ti = hitColIndex(drag.tableEl, event.clientX);
		const cells = [...drag.tableEl.rows[0].cells];
		const x =
			ti <= 0
				? rect.left
				: ti >= cells.length
					? rect.right
					: cells[ti].getBoundingClientRect().left;
		line.style.left = `${x - 1.5}px`;
		line.style.top = `${rect.top}px`;
		line.style.width = "3px";
		line.style.height = `${rect.height}px`;
		badge.textContent = "正在移动1列";
	}
	line.style.display = "block";
	badge.style.display = "block";
	badge.style.left = `${event.clientX + 14}px`;
	badge.style.top = `${event.clientY + 14}px`;
}

// 鼠标 y 落在哪一行：行内上半 → 插到该行前，下半 → 插到该行后；表格外按上/下界处理
function hitRowIndex(tableEl: HTMLElement, y: number): number {
	const rows = [...tableEl.rows];
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i].getBoundingClientRect();
		if (y >= r.top && y < r.bottom) {
			return y < r.top + r.height / 2 ? i : i + 1;
		}
	}
	const rect = tableEl.getBoundingClientRect();
	return y < rect.top ? 0 : rows.length;
}

// 鼠标 x 落在哪一列：列内左半 → 插到该列前，右半 → 插到该列后
function hitColIndex(tableEl: HTMLElement, x: number): number {
	const cells = [...tableEl.rows[0].cells];
	for (let i = 0; i < cells.length; i++) {
		const r = cells[i].getBoundingClientRect();
		if (x >= r.left && x < r.right) {
			return x < r.left + r.width / 2 ? i : i + 1;
		}
	}
	const rect = tableEl.getBoundingClientRect();
	return x < rect.left ? 0 : cells.length;
}

// 移动整行：把 fromRow 行移动到 toIndex 位置（toIndex 为插入位置，0..rowCount）。
// 含 rowspan/colspan 合并单元格的行暂不支持移动。
function moveTableRow(tableEl: HTMLElement, fromRow: number, toIndex: number) {
	if (!editor) return;
	const state = editor.state;
	let domPos: number;
	try {
		domPos = editor.view.posAtDOM(tableEl, 0);
	} catch {
		return;
	}
	const doc = state.doc;
	const $p = doc.resolve(domPos);
	const nodePos = $p.before($p.depth);
	const tableNode = $p.node($p.depth);
	if (tableNode?.type.name !== "table") return;
	const rowCount = tableNode.childCount;
	if (fromRow < 0 || fromRow >= rowCount || toIndex < 0 || toIndex > rowCount)
		return;
	if (fromRow === toIndex || fromRow + 1 === toIndex) return;
	// 合并单元格检测：被移动行内有 rowspan/colspan 则暂不支持
	let merged = false;
	tableNode.forEach((row, _off, i) => {
		if (i !== fromRow) return;
		row.forEach((cell) => {
			if ((cell.attrs.colspan ?? 1) > 1 || (cell.attrs.rowspan ?? 1) > 1) {
				merged = true;
			}
		});
	});
	if (merged) return;
	const rows: ReturnType<typeof tableNode.child>[] = [];
	tableNode.forEach((row) => {
		rows.push(row);
	});
	const moved = rows[fromRow];
	rows.splice(fromRow, 1);
	rows.splice(toIndex - (fromRow < toIndex ? 1 : 0), 0, moved);
	const newTable = tableNode.type.create(tableNode.attrs, rows);
	let tr = state.tr;
	tr.replaceWith(nodePos, nodePos + tableNode.nodeSize, newTable);
	editor.view.dispatch(tr);
	refreshToolbarAfterDispatch();
}

// 移动整列：对每一行重排该列 cell 到 toIndex 位置。
// 表格含任何 rowspan/colspan 合并单元格时暂不支持移动。
function moveTableColumn(
	tableEl: HTMLElement,
	fromCol: number,
	toIndex: number,
) {
	if (!editor) return;
	const state = editor.state;
	let domPos: number;
	try {
		domPos = editor.view.posAtDOM(tableEl, 0);
	} catch {
		return;
	}
	const doc = state.doc;
	const $p = doc.resolve(domPos);
	const nodePos = $p.before($p.depth);
	const tableNode = $p.node($p.depth);
	if (tableNode?.type.name !== "table") return;
	const rowCount = tableNode.childCount;
	if (rowCount === 0 || fromCol < 0 || toIndex < 0) return;
	const firstRow = tableNode.child(0);
	const colCount = firstRow.childCount;
	if (fromCol >= colCount || toIndex > colCount) return;
	if (fromCol === toIndex || fromCol + 1 === toIndex) return;
	// 合并单元格检测：任何 cell 有 rowspan/colspan 则暂不支持
	let merged = false;
	tableNode.forEach((row) => {
		row.forEach((cell) => {
			if ((cell.attrs.colspan ?? 1) > 1 || (cell.attrs.rowspan ?? 1) > 1) {
				merged = true;
			}
		});
	});
	if (merged) return;
	let tr = state.tr;
	let rowPos = nodePos + 1;
	tableNode.forEach((row) => {
		const cells: ReturnType<typeof row.child>[] = [];
		row.forEach((cell) => {
			cells.push(cell);
		});
		if (fromCol < cells.length && toIndex <= cells.length) {
			const moved = cells[fromCol];
			cells.splice(fromCol, 1);
			cells.splice(toIndex - (fromCol < toIndex ? 1 : 0), 0, moved);
			const newRow = row.type.create(row.attrs, cells);
			tr.replaceWith(rowPos, rowPos + row.nodeSize, newRow);
		}
		rowPos += row.nodeSize;
	});
	editor.view.dispatch(tr);
	refreshToolbarAfterDispatch();
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
	cancelAnimationFrame(pointerRefreshRaf);
	pointerRefreshPending = false;
	document.removeEventListener("mousemove", onTableMouseMove);
	document.removeEventListener("mousedown", onTableDocMouseDown);
	document.removeEventListener("mouseup", onTableDocMouseUp, true);
	if (editor) editor.destroy();
	editor = null;
	editorReady = false;
	clearTableHideTimer();
	hoverTableEl = null;
	if (tableToolbarEl) {
		tableToolbarEl.remove();
		tableToolbarEl = null;
	}
	if (dragHandleEl) {
		dragHandleEl.remove();
		dragHandleEl = null;
	}
	if (rowHandleEl) {
		rowHandleEl.remove();
		rowHandleEl = null;
	}
	if (colHandleEl) {
		colHandleEl.remove();
		colHandleEl = null;
	}
	if (tableDrag?.ghost) {
		tableDrag.ghost.remove();
		tableDrag = null;
	}
	if (lineDrag) {
		clearLineHighlight(lineDrag);
		lineDrag = null;
	}
	if (dropLineEl) {
		dropLineEl.remove();
		dropLineEl = null;
	}
	if (dragBadgeEl) {
		dragBadgeEl.remove();
		dragBadgeEl = null;
	}
	document.removeEventListener("mousemove", onDragHandleMove);
	document.removeEventListener("mouseup", onDragHandleUp);
	document.removeEventListener("mousemove", onLineHandleMove);
	document.removeEventListener("mouseup", onLineHandleUp);
	document.body.classList.remove("table-dragging");
	document.removeEventListener("mousemove", onCellDragMove);
	document.removeEventListener("mouseup", onCellDragUp);
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

function onToolbarAction(
	event: CustomEvent<{ action: string; payload?: unknown }>,
) {
	const { action, payload } = event.detail;
	if (action === "table") {
		insertTable();
		return;
	}
	format(action, payload);
}

function format(action: string, payload?: unknown) {
	if (!editor) return;
	if (action === "painter") {
		togglePainter();
		return;
	}
	if (action === "link") {
		handleLink();
		return;
	}
	if (action === "cut") {
		handleCut();
		return;
	}
	const chain = editor.chain().focus();
	const actions: Record<string, () => EditorChain> = {
		undo: () => chain.undo(),
		redo: () => chain.redo(),
		bold: () => chain.toggleBold(),
		italic: () => chain.toggleItalic(),
		strike: () => chain.toggleStrike(),
		underline: () => chain.toggleUnderline(),
		sub: () => chain.toggleSubscript(),
		sup: () => chain.toggleSuperscript(),
		h1: () => chain.toggleHeading({ level: 1 }),
		h2: () => chain.toggleHeading({ level: 2 }),
		h3: () => chain.toggleHeading({ level: 3 }),
		h4: () => chain.toggleHeading({ level: 4 }),
		h5: () => chain.toggleHeading({ level: 5 }),
		h6: () => chain.toggleHeading({ level: 6 }),
		paragraph: () => chain.setParagraph(),
		bullet: () => chain.toggleBulletList(),
		ordered: () => chain.toggleOrderedList(),
		task: () => chain.toggleTaskList(),
		quote: () => chain.toggleBlockquote(),
		code: () => chain.toggleCodeBlock(),
		hr: () => chain.setHorizontalRule(),
		indent: () => chain.indent(),
		outdent: () => chain.outdent(),
		align: () => chain.setTextAlign(String(payload ?? "left")),
		color: () => chain.setColor(String(payload ?? "#1f2329")),
		unsetColor: () => chain.unsetColor(),
		highlight: () =>
			chain.toggleHighlight({ color: String(payload ?? "#ffe08a") }),
		unsetHighlight: () => chain.unsetHighlight(),
		fontSize: () => chain.setFontSize(String(payload ?? "16px")),
		unsetFontSize: () => chain.unsetFontSize(),
		clearFormat: () => chain.unsetAllMarks().clearNodes(),
	};
	const fn = actions[action];
	if (fn) fn().run();
}

function togglePainter() {
	if (!editor) return;
	if (painterActive) {
		const chain = editor.chain().focus();
		for (const mark of painterMarks) {
			if (mark.name === "textStyle") chain.setMark("textStyle", mark.attrs);
			else chain.setMark(mark.name, mark.attrs);
		}
		chain.run();
		painterMarks = [];
		painterActive = false;
	} else {
		painterMarks = editor.state.selection.$from
			.marks()
			.filter((mark) => mark.type.name !== "link")
			.map((mark) => ({
				name: mark.type.name,
				attrs: mark.attrs,
			}));
		if (painterMarks.length) painterActive = true;
	}
}

function handleCut() {
	if (!editor) return;
	editor.chain().focus().run();
	const ok = document.execCommand("cut");
	if (ok) return;
	const text = window.getSelection()?.toString() ?? "";
	if (!text || !navigator.clipboard) return;
	void navigator.clipboard
		.writeText(text)
		.then(() => editor?.chain().focus().deleteSelection().run())
		.catch(() => undefined);
}

function handleLink() {
	if (!editor) return;
	if (editor.isActive("link")) {
		editor.chain().focus().unsetLink().run();
		return;
	}
	const url = window.prompt("链接地址", "https://");
	if (url === null) return;
	if (url.trim()) editor.chain().focus().setLink({ href: url.trim() }).run();
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
  <nav class="toolbar" bind:this={toolbarEl} aria-label="正文格式"><EditorToolbar {canUndo} {canRedo} {painterActive} active={activeState} disabled={!editorReady || sourceMode} on:action={onToolbarAction} /></nav>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if savedMessage}<p class="success">{savedMessage}</p>{/if}
  {#if sourceMode}<p class="source-note">源码模式：当前 Markdown 含有富文本编辑器无法解析的原始内容。</p><textarea class="source-editor" bind:this={sourceEditEl} bind:value={sourceValue} oninput={() => markDirty(true)} aria-label="Markdown 正文源码编辑器" spellcheck="false" disabled={!loaded}></textarea>{:else}<div class="tiptap-host prose dark:prose-invert prose-base max-w-none custom-md" bind:this={editorMount}></div>{/if}
 </section>
{/if}

<style>
 .ha-editor { color: var(--btn-content); } .statusline { display: flex; align-items: center; gap: .55rem; margin: .15rem 0 .25rem; } .edit-badge { flex: none; border: 1px solid var(--primary); border-radius: .4rem; padding: .12rem .5rem; color: var(--primary); font-size: .75rem; font-weight: 750; } .status { font-size: .75rem; opacity: .75; } .recover { border-color: color-mix(in srgb, #e0a23c 45%, transparent); color: #b7791f; } button { border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .35rem .6rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .78rem; cursor: pointer; } button:disabled { cursor: not-allowed; opacity: .5; } .primary { border-color: var(--primary); color: white; background: var(--primary); } .danger { color: #c74747; } .error { color: #c74747; font-size: .8rem; } .success { color: #27845f; font-size: .8rem; } .toolbar { position: sticky; top: 4.3rem; z-index: 20; margin: .35rem 0 .9rem; border-radius: .6rem; box-shadow: 0 1px 8px color-mix(in srgb, var(--btn-content) 10%, transparent); } .tiptap-host :global(.ProseMirror) { min-height: 26rem; outline: none; line-height: 1.75; } .tiptap-host :global(.ProseMirror pre) { margin: 0; overflow-x: auto; border-radius: .4rem; padding: .8rem; background: color-mix(in srgb, var(--btn-content) 8%, var(--card-bg)); } .tiptap-host :global(.ProseMirror table) { display: table; width: max-content; max-width: 100%; min-width: 100%; border-collapse: separate; border-spacing: 0; } .tiptap-host :global(.ProseMirror td), .tiptap-host :global(.ProseMirror th) { min-width: 120px; padding: 8px 12px; word-break: break-word; text-align: left; } .tiptap-host :global(.ProseMirror table p) { margin: 0; padding: 0; } .tiptap-host :global(.ProseMirror li p), .tiptap-host :global(.ProseMirror blockquote p) { margin: 0; padding: 0; } .tiptap-host :global(.ProseMirror table colgroup) { display: table-column-group; } .tiptap-host :global(.ProseMirror img) { max-width: 100%; height: auto; } .tiptap-host :global(.ProseMirror code) { font-size: .875em; } .source-note { margin-top: .5rem; color: color-mix(in srgb, var(--btn-content) 65%, transparent); font-size: .8rem; } .source-editor { display: block; width: 100%; min-height: 26rem; resize: vertical; font-family: var(--font-jetbrains-mono), monospace; font-size: .86rem; line-height: 1.65; border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .6rem; color: inherit; background: var(--card-bg); }
 :global([data-article-title].article-title-editing) { outline: 2px dashed color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 2px; border-radius: .25rem; }
 :global(.article-category-select), :global(.article-tags-input) { display: inline-block; max-width: 14rem; border: 1px dashed color-mix(in srgb, var(--primary) 45%, transparent); border-radius: .3rem; padding: .08rem .3rem; color: inherit; background: var(--card-bg); font: inherit; font-size: .78rem; }
 :global(.post-meta-cover .article-category-select), :global(.post-meta-cover .article-tags-input) { color: white; background: rgb(0 0 0 / .35); }
   :global(.table-toolbar) { position: fixed; z-index: 40; display: flex; flex-wrap: wrap; gap: .35rem; padding: .45rem .55rem; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: .7rem; background: color-mix(in srgb, var(--card-bg) 94%, transparent); backdrop-filter: blur(10px); box-shadow: 0 10px 28px color-mix(in srgb, var(--btn-content) 10%, transparent); } :global(.table-toolbar button) { flex: 0 0 auto; min-width: 3.6rem; border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .3rem .55rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .78rem; cursor: pointer; } :global(.table-toolbar button:hover) { border-color: color-mix(in srgb, var(--primary) 45%, transparent); transform: translateY(-1px); } :global(.table-toolbar .danger) { color: #c74747; } :global(.table-drag-handle) { display: none; position: fixed; z-index: 41; width: 14px; height: 14px; padding: 3px; border-radius: 4px; background: #3f3f46; box-shadow: 0 2px 6px rgb(0 0 0 / 28%); cursor: grab; touch-action: none; -webkit-user-select: none; user-select: none; } :global(.table-drag-handle::before) { content: ""; display: block; width: 100%; height: 100%; background-image: radial-gradient(circle, #fff 1px, transparent 1px); background-size: 4px 4px; background-position: center; } :global(.table-drag-handle:hover) { background: #52525b; } :global(.table-drag-handle:active) { cursor: grabbing; } :global(.table-row-handle), :global(.table-col-handle) { display: none; position: fixed; z-index: 42; border-radius: 3px; background-color: #3f3f46; background-image: radial-gradient(circle, #fff 0.85px, transparent 0.85px); background-size: 3.5px 3.5px; background-position: center; background-repeat: no-repeat; box-shadow: 0 1px 4px rgb(0 0 0 / 25%); cursor: grab; touch-action: none; -webkit-user-select: none; user-select: none; } :global(.table-row-handle) { width: 12px; height: 12px; } :global(.table-col-handle) { width: 14px; height: 14px; } :global(.table-row-handle:hover), :global(.table-col-handle:hover) { background-color: #4f6ef7; } :global(.table-row-handle:active), :global(.table-col-handle:active) { cursor: grabbing; } :global(body.table-dragging) { cursor: grabbing !important; } :global(.table-drop-line) { display: none; position: fixed; z-index: 9999; background: #4a90e2; border-radius: 1px; pointer-events: none; } :global(.table-drag-badge) { display: none; position: fixed; z-index: 10001; padding: 4px 9px; border-radius: 6px; background: #4a90e2; color: #fff; font-size: 12px; line-height: 1; white-space: nowrap; pointer-events: none; box-shadow: 0 2px 8px rgb(0 0 0 / 25%); } :global(.ProseMirror td.table-drag-source), :global(.ProseMirror th.table-drag-source) { background: #d6eefc !important; } :global(.table-drag-ghost) { position: fixed; z-index: 10000; width: max-content; max-width: 92vw; overflow: hidden; border-radius: 6px; opacity: 0.86; pointer-events: none; box-shadow: 0 14px 34px rgb(0 0 0 / 32%); transform: rotate(0.5deg); } :global(.table-drag-ghost *), :global(.table-drag-ghost) { -webkit-user-select: none; user-select: none; } :global(.table-drag-ghost table) { width: 100%; }
 :global(.tiptap-host .ProseMirror td.selectedCell), :global(.tiptap-host .ProseMirror th.selectedCell) { background: #d3e4ff !important; }
 @media (max-width: 760px) { .toolbar { top: 3.6rem; } }
</style>
