/**
 * Notion 式行（块）手柄 + 行操作菜单。
 *
 * - hover 编辑器顶层块时，在其左侧显示 6 点手柄；
 * - 点击手柄弹出菜单：转化为（子菜单）/删除/复制/剪切/缩进/在下方添加块。
 *
 * 纯 DOM 实现（与表格工具条/手柄同套路），避免侵入 Svelte 状态。
 * 由 ArticleEditor.svelte 在编辑器创建/销毁时调用 setupBlockHandle/teardownBlockHandle。
 */
import { YUQUE_ICONS } from "./yuqueIcons";

type BlockHandleEditor = {
	view: {
		posAtCoords: (coords: {
			left: number;
			top: number;
		}) => { pos: number; inside: number } | null;
		posAtDOM: (node: Node, offset: number) => number;
		dom: HTMLElement;
	};
	state: {
		doc: {
			resolve: (pos: number) => {
				depth: number;
				node: (depth: number) => {
					type: { name: string };
					textContent: string;
					attrs: Record<string, unknown>;
				};
				before: (depth: number) => number;
				after: (depth: number) => number;
			};
		};
		selection: { from: number; to: number; empty: boolean };
	};
};

type MenuAction = "delete" | "copy" | "cut" | "indent";

type TransformKind =
	| "heading1"
	| "heading2"
	| "heading3"
	| "heading4"
	| "heading5"
	| "heading6"
	| "paragraph"
	| "orderedList"
	| "bulletList"
	| "taskList"
	| "blockquote"
	| "codeBlock";

let host: HTMLElement | null = null;
let getEditor: (() => BlockHandleEditor | null) | null = null;
let handleEl: HTMLDivElement | null = null;
let menuEl: HTMLDivElement | null = null;
let subEl: HTMLDivElement | null = null;

// 当前手柄对应的顶层块
let curPos = -1;
let curEnd = -1;
let curType = "";
let curText = "";
let menuOpen = false;
let subOpen = false;
// 活跃实例计数（编辑器重建时 setup/teardown 可能交叉，见 teardownBlockHandle）
let instanceCount = 0;

const TOP_TYPES = new Set([
	"paragraph",
	"heading",
	"blockquote",
	"codeBlock",
	"bulletList",
	"orderedList",
	"taskList",
	"image",
	"horizontalRule",
	"table",
]);

// —— 查找顶层块 ——

// 把任意 pos 提升到文档顶层块的 [start, end] 与类型信息
function resolveTopBlock(pos: number): {
	start: number;
	end: number;
	type: string;
	text: string;
	isListItem: boolean;
} | null {
	const ed = getEditor?.();
	if (!ed) return null;
	try {
		const $ = ed.state.doc.resolve(pos);
		if ($.depth === 0) return null;
		// 沿深度向上找第一个非 list 的顶层块；列表场景落在 list 本身
		const depth = 1;
		let name = $.node(1).type.name;
		let isListItem = false;
		for (let d = 1; d <= $.depth; d++) {
			const n = $.node(d);
			if (d === 1) name = n.type.name;
			if (n.type.name === "listItem" || n.type.name === "taskItem") {
				isListItem = true;
			}
		}
		if (!TOP_TYPES.has(name)) return null;
		const start = $.before(depth);
		const end = $.after(depth);
		const node = $.node(depth);
		return {
			start,
			end,
			type: name,
			text: node.textContent,
			isListItem,
		};
	} catch {
		return null;
	}
}

// —— DOM 构建 ——

function ensureHandle(): HTMLDivElement {
	if (handleEl?.isConnected) return handleEl;
	const h = document.createElement("div");
	h.className = "block-handle";
	h.setAttribute("role", "button");
	h.setAttribute("aria-label", "块操作");
	h.title = "块操作";
	// Notion 式六点图标（两列三点）
	h.innerHTML =
		'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
		'<circle cx="5" cy="3" r="1.4"/><circle cx="11" cy="3" r="1.4"/>' +
		'<circle cx="5" cy="8" r="1.4"/><circle cx="11" cy="8" r="1.4"/>' +
		'<circle cx="5" cy="13" r="1.4"/><circle cx="11" cy="13" r="1.4"/>' +
		"</svg>";
	h.addEventListener("mousedown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		openMenu();
	});
	document.body.appendChild(h);
	handleEl = h;
	return h;
}

function makeItem(
	label: string,
	onClick: (e: MouseEvent) => void,
): HTMLDivElement {
	const it = document.createElement("div");
	it.className = "block-menu-item";
	it.setAttribute("role", "menuitem");
	it.textContent = label;
	it.addEventListener("mousedown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onClick(e);
	});
	return it;
}

function ensureMenu(): HTMLDivElement {
	if (menuEl?.isConnected) return menuEl;
	const m = document.createElement("div");
	m.className = "block-menu";
	m.setAttribute("role", "menu");
	m.addEventListener("mousedown", (e) => e.stopPropagation());
	m.addEventListener("click", (e) => e.stopPropagation());

	const transformItem = makeItem("转化为", () => {
		toggleSub();
		positionMenu(); // 子菜单展开可能改变尺寸，重新校边界
	});
	transformItem.setAttribute("data-act", "transform");
	// 右侧箭头提示子菜单
	const arrow = document.createElement("span");
	arrow.textContent = "▸";
	arrow.style.opacity = "0.5";
	transformItem.appendChild(arrow);
	m.appendChild(transformItem);
	m.appendChild(
		makeItem("删除", () => {
			runAction("delete");
		}),
	);
	m.appendChild(
		makeItem("复制", () => {
			runAction("copy");
		}),
	);
	m.appendChild(
		makeItem("剪切", () => {
			runAction("cut");
		}),
	);
	const indentItem = makeItem("缩进", () => {
		runAction("indent");
	});
	indentItem.setAttribute("data-act", "indent");
	m.appendChild(indentItem);
	m.appendChild(
		makeItem("在下方添加块", () => {
			runAction("add");
		}),
	);

	// 子菜单（挂 body，独立定位在手柄菜单旁）：横向图标条，当前块类型高亮
	const sub = document.createElement("div");
	sub.className = "block-menu block-menu-sub";
	sub.setAttribute("role", "menu");
	sub.addEventListener("mousedown", (e) => e.stopPropagation());

	// 按图中布局：第一行 H1–H6，第二行其余块类型
	const items: Array<[string, TransformKind]> = [
		["标题 1", "heading1"],
		["标题 2", "heading2"],
		["标题 3", "heading3"],
		["标题 4", "heading4"],
		["标题 5", "heading5"],
		["标题 6", "heading6"],
		["正文", "paragraph"],
		["无序列表", "bulletList"],
		["有序列表", "orderedList"],
		["任务列表", "taskList"],
		["代码块", "codeBlock"],
	];
	for (const [label, kind] of items) {
		const icon = YUQUE_ICONS[kind];
		const btn = document.createElement("div");
		btn.className = "block-menu-icon";
		btn.dataset.kind = kind;
		btn.setAttribute("role", "menuitem");
		btn.setAttribute("title", label);
		btn.setAttribute("aria-label", label);
		btn.innerHTML = `<svg viewBox="${icon.viewBox}" width="18" height="18" aria-hidden="true">${icon.body}</svg>`;
		btn.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			runTransform(kind);
		});
		sub.appendChild(btn);
	}
	document.body.appendChild(sub);
	subEl = sub;

	document.body.appendChild(m);
	menuEl = m;
	return m;
}

// —— 显隐与定位 ——

function showHandle(block: NonNullable<ReturnType<typeof resolveTopBlock>>) {
	curPos = block.start;
	curEnd = block.end;
	curType = block.type;
	curText = block.text;
	const h = ensureHandle();
	const hostRect = host?.getBoundingClientRect();
	if (!hostRect) return;
	// 找块起始位置的视口 Y：用 posAtDOM 取块 DOM 再取 rect
	const ed = getEditor();
	if (!ed) return;
	let top = 0;
	try {
		const domAt = ed.view.domAtPos(block.start + 1);
		let el: Element | null =
			domAt.node instanceof Element
				? (domAt.node as Element)
				: domAt.node.parentElement;
		// 叶子节点（image 等）：domAtPos 返回父容器+偏移，按偏移取实际子节点
		if (
			!(domAt.node instanceof Element) &&
			domAt.node.parentElement &&
			(domAt.node.parentElement.childElementCount || 1) > domAt.offset
		) {
			const child = domAt.node.parentElement.children[domAt.offset];
			if (child) el = child;
		}
		const matched = el?.matches(
			"p,h1,h2,h3,h4,h5,h6,pre,ul,ol,blockquote,table,img",
		)
			? el
			: el?.closest("p,h1,h2,h3,h4,h5,h6,pre,ul,ol,blockquote,table,img");
		const r = matched?.getBoundingClientRect();
		if (r) {
			top = r.top;
			// 垂直居中于块首行（块很高时对齐首行，与 Notion 一致）
			const lineH = Math.min(r.height, 36);
			top = r.top + lineH / 2 - 11; // 11 = 手柄半高
		}
	} catch {
		return;
	}
	h.style.left = `${Math.max(2, hostRect.left - 26)}px`;
	h.style.top = `${Math.max(2, top)}px`;
	h.style.display = "grid";
}

function hideHandle() {
	if (handleEl) handleEl.style.display = "none";
	if (!menuOpen) closeMenu();
}

function positionMenu() {
	if (!menuOpen || !handleEl || !menuEl || !subEl) return;
	const hr = handleEl.getBoundingClientRect();
	menuEl.style.left = `${hr.right + 6}px`;
	menuEl.style.top = `${hr.top}px`;
	menuEl.style.display = "flex";
	if (subOpen) {
		const mr = menuEl.getBoundingClientRect();
		subEl.style.left = `${mr.right + 4}px`;
		subEl.style.top = `${mr.top}px`;
		subEl.style.display = "flex";
		subEl.classList.add("open");
	} else {
		subEl.style.display = "none";
		subEl.classList.remove("open");
	}
	// 视口边界：底部溢出则上移
	for (const el of [menuEl, subEl]) {
		if (el.style.display === "none") continue;
		const r = el.getBoundingClientRect();
		if (r.bottom > window.innerHeight - 8) {
			el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
		}
		if (r.right > window.innerWidth - 8) {
			el.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
		}
	}
}

function openMenu() {
	menuOpen = true;
	subOpen = false;
	ensureMenu();
	// 高亮当前块类型对应的图标（正文/标题按类型；列表高亮对应列表图标）
	if (subEl) {
		const kindOf: Record<string, string> = {
			paragraph: "paragraph",
			heading: "heading?" + curType,
			bulletList: "bulletList",
			orderedList: "orderedList",
			taskList: "taskList",
			blockquote: "blockquote",
			codeBlock: "codeBlock",
		};
		let active = kindOf[curType] || "";
		if (active.startsWith("heading?")) {
			// heading1..6 映射到对应按钮
			const m = curType.match(/^heading([1-6])$/);
			active = m ? `heading${m[1]}` : "";
		}
		for (const b of subEl.querySelectorAll(".block-menu-icon")) {
			b.classList.toggle("active", b.dataset.kind === active);
		}
	}
	positionMenu();
}

function closeMenu() {
	menuOpen = false;
	subOpen = false;
	if (menuEl) menuEl.style.display = "none";
	if (subEl) {
		subEl.style.display = "none";
		subEl.classList.remove("open");
	}
}

function toggleSub() {
	subOpen = !subOpen;
	positionMenu();
}

// —— 动作执行（通过回调注入，避免本模块耦合 Tiptap 命令细节） ——

let onAction:
	| ((
			action: MenuAction | "add",
			block: { pos: number; end: number; text: string },
	  ) => void)
	| null = null;
let onTransform:
	| ((kind: TransformKind, block: { pos: number; end: number }) => void)
	| null = null;

function runAction(action: MenuAction | "add") {
	hideHandle();
	closeMenu();
	if (!onAction) return;
	onAction(action, { pos: curPos, end: curEnd, text: curText });
}

function runTransform(kind: TransformKind) {
	hideHandle();
	closeMenu();
	if (!onTransform) return;
	onTransform(kind, { pos: curPos, end: curEnd });
}

// —— 对外接口 ——

export function setupBlockHandle(options: {
	host: HTMLElement;
	getEditor: () => BlockHandleEditor | null;
	onAction: (
		action: MenuAction | "add",
		block: { pos: number; end: number; text: string },
	) => void;
	onTransform: (
		kind: TransformKind,
		block: { pos: number; end: number },
	) => void;
}) {
	host = options.host;
	getEditor = options.getEditor;
	onAction = options.onAction;
	onTransform = options.onTransform;
	instanceCount++;
	ensureHandle();
	ensureMenu();

	const onMove = (e: MouseEvent) => {
		if (!host) return;
		// 菜单打开时：鼠标移出手柄+菜单区域 → 整体收起（模拟"点击别处"）
		if (menuOpen) {
			let near = false;
			if (handleEl && handleEl.style.display === "grid") {
				const r = handleEl.getBoundingClientRect();
				near =
					e.clientX >= r.left - 10 &&
					e.clientX <= r.right + 16 &&
					e.clientY >= r.top - 8 &&
					e.clientY <= r.bottom + 8;
			}
			if (menuEl && menuEl.style.display === "flex") {
				const r = menuEl.getBoundingClientRect();
				near =
					near ||
					(e.clientX >= r.left - 8 &&
						e.clientX <= r.right + 8 &&
						e.clientY >= r.top - 8 &&
						e.clientY <= r.bottom + 8);
			}
			if (subEl && subOpen && subEl.style.display === "flex") {
				const r = subEl.getBoundingClientRect();
				near =
					near ||
					(e.clientX >= r.left - 8 &&
						e.clientX <= r.right + 8 &&
						e.clientY >= r.top - 8 &&
						e.clientY <= r.bottom + 8);
			}
			if (!near) {
				closeMenu();
				hideHandle();
			}
			return;
		}
		const ed = getEditor?.();
		if (!ed) return;
		const target = e.target as Node;
		if (!ed.view.dom.contains(target)) {
			const t = e.target as Element;
			if (t?.closest?.(".block-handle, .block-menu")) return;
			// 鼠标在编辑器与手柄之间的走道/手柄热区附近：保持显示。
			// 否则移向手柄途中（离开编辑器 DOM 的瞬间）手柄先隐藏，
			// 鼠标到达时手柄已消失，永远点不到。
			if (handleEl && handleEl.style.display === "grid") {
				const r = handleEl.getBoundingClientRect();
				if (
					e.clientX >= r.left - 10 &&
					e.clientX <= r.right + 16 &&
					e.clientY >= r.top - 8 &&
					e.clientY <= r.bottom + 8
				) {
					return;
				}
			}
			// 兜底：坐标仍在编辑器矩形内（偶发 target 解析不到编辑器子节点，
			// 如顶层容器/装饰层），视为还在编辑器里，不隐藏
			const hostRect2 = host.getBoundingClientRect();
			if (
				e.clientX >= hostRect2.left - 26 &&
				e.clientX <= hostRect2.right + 8 &&
				e.clientY >= hostRect2.top &&
				e.clientY <= hostRect2.bottom
			) {
				return;
			}
			hideHandle();
			return;
		}
		// 排除表格内部与图片缩放 UI（表格有自己的手柄体系）
		const el = target as Element;
		if (el.closest?.("table") || el.closest?.("[data-resize-container]")) {
			hideHandle();
			return;
		}
		const coords = ed.view.posAtCoords({ left: e.clientX, top: e.clientY });
		if (!coords) {
			// posAtCoords 偶发失败（块间隙/边缘），保持现有手柄不闪没
			return;
		}
		const block = resolveTopBlock(coords.pos);
		if (!block) {
			// 块间隙等无法定位处：保持现有手柄不闪没
			return;
		}
		// 已显示同一块则不闪动
		if (
			handleEl?.style.display !== "none" &&
			block.start === curPos &&
			block.end === curEnd
		) {
			return;
		}
		showHandle(block);
	};

	const onDocDown = (e: MouseEvent) => {
		const t = e.target as Element;
		if (t?.closest?.(".block-handle, .block-menu")) return;
		// 点击手柄/菜单以外任意处：整个菜单（含子菜单）收起
		if (menuOpen) closeMenu();
		hideHandle();
	};

	const onScrollOrResize = () => {
		hideHandle();
	};

	document.addEventListener("mousemove", onMove);
	document.addEventListener("mousedown", onDocDown);
	window.addEventListener("scroll", onScrollOrResize, { passive: true });
	window.addEventListener("resize", onScrollOrResize);

	return () => {
		document.removeEventListener("mousemove", onMove);
		document.removeEventListener("mousedown", onDocDown);
		window.removeEventListener("scroll", onScrollOrResize);
		window.removeEventListener("resize", onScrollOrResize);
	};
}

export function teardownBlockHandle(cleanup?: () => void) {
	cleanup?.();
	instanceCount = Math.max(0, instanceCount - 1);
	if (instanceCount > 0) return; // 还有活跃实例，保留引用
	hideHandle();
	closeMenu();
	handleEl?.remove();
	handleEl = null;
	menuEl?.remove();
	menuEl = null;
	subEl?.remove();
	subEl = null;
	getEditor = null;
	onAction = null;
	onTransform = null;
	host = null;
}
