<script lang="ts">
import { createEventDispatcher, onDestroy, onMount } from "svelte";

export let canUndo = false;
export let canRedo = false;
export let painterActive = false;
export let disabled = false;
export let active: {
	bold: boolean;
	italic: boolean;
	strike: boolean;
	underline: boolean;
	subscript: boolean;
	superscript: boolean;
	paragraph: boolean;
	headingLevel: number;
	textAlign: string | null;
	bulletList: boolean;
	orderedList: boolean;
	taskList: boolean;
	blockquote: boolean;
	link: boolean;
	color: string | null;
	highlight: string | null;
	fontSize: string | null;
} = {
	bold: false,
	italic: false,
	strike: false,
	underline: false,
	subscript: false,
	superscript: false,
	paragraph: true,
	headingLevel: 0,
	textAlign: null,
	bulletList: false,
	orderedList: false,
	taskList: false,
	blockquote: false,
	link: false,
	color: null,
	highlight: null,
	fontSize: null,
};

const dispatch = createEventDispatcher<{
	action: { action: string; payload?: unknown };
}>();

const ICONS: Record<string, string> = {
	undo: `<path fill="currentColor" d="M7 19v-2h7.1q1.575 0 2.738-1T18 13.5T16.838 11T14.1 10H7.8l2.6 2.6L9 14L4 9l5-5l1.4 1.4L7.8 8h6.3q2.425 0 4.163 1.575T20 13.5t-1.737 3.925T14.1 19z"/>`,
	redo: `<path fill="currentColor" d="M9.9 19q-2.425 0-4.163-1.575T4 13.5t1.738-3.925T9.9 8h6.3l-2.6-2.6L15 4l5 5l-5 5l-1.4-1.4l2.6-2.6H9.9q-1.575 0-2.738 1T6 13.5T7.163 16T9.9 17H17v2z"/>`,
	clearFormat: `<path fill="currentColor" d="m13.2 10.35l-2.325-2.325L7.85 5H20v3h-5.8zm6.6 12.25l-8.3-8.3l-2 4.7H6.225L9.2 12L1.4 4.2l1.4-1.4l18.4 18.4z"/>`,
	painter: `<path fill="currentColor" d="M11 22q-.825 0-1.412-.587T9 20v-4H6q-.825 0-1.412-.587T4 14V7q0-1.65 1.175-2.825T8 3h12v11q0 .825-.587 1.413T18 16h-3v4q0 .825-.587 1.413T13 22zM6 10h12V5h-1v4h-2V5h-1v2h-2V5H8q-.825 0-1.412.588T6 7z"/>`,
	superscript: `<path fill="currentColor" d="M19 9V7q0-.425.288-.712T20 6h2V5h-3V4h3q.425 0 .713.288T23 5v1q0 .425-.288.713T22 7h-2v1h3v1zM5.875 20l4.625-7.275L6.2 6h2.65l3.1 5h.1l3.075-5H17.8l-4.325 6.725L18.125 20H15.45l-3.4-5.425h-.1L8.55 20z"/>`,
	subscript: `<path fill="currentColor" d="M19 20v-2q0-.425.288-.712T20 17h2v-1h-3v-1h3q.425 0 .713.288T23 16v1q0 .425-.288.713T22 18h-2v1h3v1zM5.875 18l4.625-7.275L6.2 4h2.65l3.1 5h.1l3.075-5H17.8l-4.325 6.725L18.125 18H15.45l-3.4-5.425h-.1L8.55 18z"/>`,
	colorText: `<path fill="currentColor" d="M2 24v-4h20v4zm3.5-7l5.25-14h2.5l5.25 14h-2.4l-1.25-3.6H9.2L7.9 17zm4.4-5.6h4.2l-2.05-5.8h-.1z"/>`,
	highlighter: `<path fill="currentColor" d="m6.7 18.7l-1.4-1.4Q5 17 5 16.588t.3-.713L15.875 5.3q.3-.3.713-.3t.712.3l1.4 1.4q.3.3.3.713t-.3.712L8.1 18.7q-.275.275-.7.275t-.7-.275"/>`,
	alignLeft: `<path fill="currentColor" d="M3 21v-2h18v2zm0-4v-2h12v2zm0-4v-2h18v2zm0-4V7h12v2zm0-4V3h18v2z"/>`,
	alignCenter: `<path fill="currentColor" d="M3 21v-2h18v2zm4-4v-2h10v2zm-4-4v-2h18v2zm4-4V7h10v2zM3 5V3h18v2z"/>`,
	alignRight: `<path fill="currentColor" d="M3 5V3h18v2zm6 4V7h12v2zm-6 4v-2h18v2zm6 4v-2h12v2zm-6 4v-2h18v2z"/>`,
	alignJustify: `<path fill="currentColor" d="M3 21v-2h18v2zm0-4v-2h18v2zm0-4v-2h18v2zm0-4V7h18v2zm0-4V3h18v2z"/>`,
	listBulleted: `<path fill="currentColor" d="M9 19v-2h12v2zm0-6v-2h12v2zm0-6V5h12v2zM5 20q-.825 0-1.412-.587T3 18t.588-1.412T5 16t1.413.588T7 18t-.587 1.413T5 20m0-6q-.825 0-1.412-.587T3 12t.588-1.412T5 10t1.413.588T7 12t-.587 1.413T5 14M3.588 7.413Q3 6.825 3 6t.588-1.412T5 4t1.413.588T7 6t-.587 1.413T5 8t-1.412-.587"/>`,
	listNumbered: `<path fill="currentColor" d="M3 22v-1.5h2.5v-.75H4v-1.5h1.5v-.75H3V16h3q.425 0 .713.288T7 17v1q0 .425-.288.713T6 19q.425 0 .713.288T7 20v1q0 .425-.288.713T6 22zm0-7v-2.75q0-.425.288-.712T4 11.25h1.5v-.75H3V9h3q.425 0 .713.288T7 10v1.75q0 .425-.288.713T6 12.75H4.5v.75H7V15zm1.5-7V3.5H3V2h3v6zM9 19v-2h12v2zm0-6v-2h12v2zm0-6V5h12v2z"/>`,
	indentDecrease: `<path fill="currentColor" d="M3 21v-2h18v2zm8-4v-2h10v2zm0-4v-2h10v2zm0-4V7h10v2zM3 5V3h18v2zm4 11l-4-4l4-4z"/>`,
	indentIncrease: `<path fill="currentColor" d="M3 21v-2h18v2zm8-4v-2h10v2zm0-4v-2h10v2zm0-4V7h10v2zM3 5V3h18v2zm0 11V8l4 4z"/>`,
	checklist: `<path fill="currentColor" d="M5.55 19L2 15.45l1.4-1.4l2.125 2.125l4.25-4.25l1.4 1.425zm0-8L2 7.45l1.4-1.4l2.125 2.125l4.25-4.25l1.4 1.425zM13 17v-2h9v2zm0-8V7h9v2z"/>`,
	link: `<path fill="currentColor" d="M11 17H7q-2.075 0-3.537-1.463T2 12t1.463-3.537T7 7h4v2H7q-1.25 0-2.125.875T4 12t.875 2.125T7 15h4zm-3-4v-2h8v2zm5 4v-2h4q1.25 0 2.125-.875T20 12t-.875-2.125T17 9h-4V7h4q2.075 0 3.538 1.463T22 12t-1.463 3.538T17 17z"/>`,
	quote: `<path fill="currentColor" d="M5.7 18L8 14q-1.65 0-2.825-1.175T4 10t1.175-2.825T8 6t2.825 1.175T12 10q0 .575-.137 1.063T11.45 12L8 18zm9 0l2.3-4q-1.65 0-2.825-1.175T13 10t1.175-2.825T17 6t2.825 1.175T21 10q0 .575-.137 1.063T20.45 12L17 18z"/>`,
	hr: `<path fill="currentColor" d="M4 13v-2h16v2z"/>`,
	table: `<path fill="currentColor" d="M11 16H3v3q0 .825.588 1.413T5 21h6zm2 0v5h6q.825 0 1.413-.587T21 19v-3zm-2-2V9H3v5zm2 0h8V9h-8zM3 7h18V5q0-.825-.587-1.412T19 3H5q-.825 0-1.412.588T3 5z"/>`,
	code: `<path fill="currentColor" d="m8 18l-6-6l6-6l1.425 1.425l-4.6 4.6L9.4 16.6zm8 0l-1.425-1.425l4.6-4.6L14.6 7.4L16 6l6 6z"/>`,
	more: `<path fill="currentColor" d="M6 14q-.825 0-1.412-.587T4 12t.588-1.412T6 10t1.413.588T8 12t-.587 1.413T6 14m6 0q-.825 0-1.412-.587T10 12t.588-1.412T12 10t1.413.588T14 12t-.587 1.413T12 14m6 0q-.825 0-1.412-.587T16 12t.588-1.412T18 10t1.413.588T20 12t-.587 1.413T18 14"/>`,
	chevronDown: `<path fill="currentColor" d="M7 10l5 5l5-5z"/>`,
};

const SVG = (name: string, size = 18) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">${ICONS[name]}</svg>`;

let openMenu: string | null = null;

function toggleMenu(name: string) {
	openMenu = openMenu === name ? null : name;
}

function act(action: string, payload?: unknown) {
	openMenu = null;
	dispatch("action", { action, payload });
}

function onGlobalPointerDown(event: PointerEvent) {
	if (event.target?.closest(".tb-drop")) return;
	openMenu = null;
}

onMount(() =>
	window.addEventListener("pointerdown", onGlobalPointerDown, true),
);
onDestroy(() =>
	window.removeEventListener("pointerdown", onGlobalPointerDown, true),
);

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const TEXT_COLORS = [
	{ name: "默认", value: "" },
	{ name: "黑", value: "#1f2329" },
	{ name: "红", value: "#e5484d" },
	{ name: "橙", value: "#f76b15" },
	{ name: "黄", value: "#f5a524" },
	{ name: "绿", value: "#30a46c" },
	{ name: "蓝", value: "#0090ff" },
	{ name: "紫", value: "#8e4ec6" },
	{ name: "粉", value: "#d6409f" },
	{ name: "灰", value: "#6b7280" },
];
const BG_COLORS = [
	{ name: "无", value: "" },
	{ name: "黄", value: "#ffe08a" },
	{ name: "绿", value: "#b5f0c8" },
	{ name: "蓝", value: "#b3dcff" },
	{ name: "粉", value: "#ffc9d6" },
	{ name: "橙", value: "#ffd6a8" },
	{ name: "紫", value: "#e3d0ff" },
];
const ALIGNS = [
	{ name: "左对齐", icon: "alignLeft", action: "left" },
	{ name: "居中", icon: "alignCenter", action: "center" },
	{ name: "右对齐", icon: "alignRight", action: "right" },
	{ name: "两端对齐", icon: "alignJustify", action: "justify" },
];

const currentBlock = () =>
	active.headingLevel > 0 ? `标题 ${active.headingLevel}` : "正文";
const currentSize = () => active.fontSize ?? "16px";
const currentAlign = () =>
	ALIGNS.find((a) => a.action === (active.textAlign ?? "left")) ?? ALIGNS[0];
</script>

<nav
	class="editor-toolbar"
	class:tb-disabled={disabled}
	role="toolbar"
	aria-label="正文格式"
>
	<button
		class="tb-btn tb-new"
		type="button" disabled={disabled}
		title="新建文章"
		onclick={() => act("new")}
	>
		<span class="tb-new-circle">{@html SVG("add", 20)}</span>
	</button>

	<span class="tb-group">
		<button class="tb-btn" type="button" title="撤销 (Ctrl+Z)" disabled={disabled || !canUndo} onclick={() => act("undo")}>
			{@html SVG("undo")}
		</button>
		<button class="tb-btn" type="button" title="重做 (Ctrl+Y)" disabled={disabled || !canRedo} onclick={() => act("redo")}>
			{@html SVG("redo")}
		</button>
	</span>

	<span class="tb-group">
		<button class="tb-btn" disabled={disabled} type="button" title="清除格式 (Ctrl+\)" onclick={() => act("clearFormat")}>
			{@html SVG("clearFormat")}
		</button>
		<button
			class="tb-btn tb-painter"
			class:tb-on={painterActive}
			type="button"
			title="格式刷：点击拾取格式，再点击目标文字应用"
			onclick={() => act("painter")}
		>
			{@html SVG("painter")}
		</button>
	</span>

	<span class="tb-group">
		<div class="tb-drop">
			<button
				class="tb-btn tb-select"
				type="button" disabled={disabled}
				title="段落样式"
				onclick={() => toggleMenu("block")}
			>
				<span class="tb-select-label">{currentBlock()}</span>
				{@html SVG("chevronDown", 14)}
			</button>
			{#if openMenu === "block"}
				<div class="tb-panel" role="menu">
					<button
						class="tb-panel-item"
						class:tb-checked={active.paragraph}
						type="button"
						onclick={() => act("paragraph")}
					>
						<span>正文</span>
						<span class="tb-kbd">Ctrl+0</span>
					</button>
					{#each [1, 2, 3, 4, 5, 6] as level}
						<button
							class="tb-panel-item"
							class:tb-checked={active.headingLevel === level}
							type="button"
							onclick={() => act(`h${level}`)}
						>
							<span>标题 {level}</span>
							<span class="tb-kbd">Ctrl+{level}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="tb-drop">
			<button
				class="tb-btn tb-select"
				type="button" disabled={disabled}
				title="字号"
				onclick={() => toggleMenu("size")}
			>
				<span class="tb-select-label">{currentSize()}</span>
				{@html SVG("chevronDown", 14)}
			</button>
			{#if openMenu === "size"}
				<div class="tb-panel tb-panel-scroll" role="menu">
					<button
						class="tb-panel-item"
						class:tb-checked={active.fontSize === null}
						type="button"
						onclick={() => act("unsetFontSize")}
					>
						<span>默认</span>
					</button>
					{#each FONT_SIZES as size}
						<button
							class="tb-panel-item"
							class:tb-checked={active.fontSize === `${size}px`}
							type="button"
							onclick={() => act("fontSize", `${size}px`)}
						>
							<span style="font-size:{size}px">{size}px</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</span>

	<span class="tb-group">
		<button class="tb-btn" disabled={disabled} class:tb-on={active.bold} type="button" title="加粗 (Ctrl+B)" onclick={() => act("bold")}>
			<b class="tb-char">B</b>
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.italic} type="button" title="斜体 (Ctrl+I)" onclick={() => act("italic")}>
			<i class="tb-char">I</i>
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.strike} type="button" title="删除线 (Ctrl+Shift+X)" onclick={() => act("strike")}>
			<s class="tb-char">S</s>
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.underline} type="button" title="下划线 (Ctrl+U)" onclick={() => act("underline")}>
			<u class="tb-char">U</u>
		</button>
	</span>

	<span class="tb-group">
		<div class="tb-drop">
			<button
				class="tb-btn"
				class:tb-on={active.superscript || active.subscript}
				type="button"
				title="上标 / 下标"
				onclick={() => toggleMenu("script")}
			>
				{@html SVG(active.subscript ? "subscript" : "superscript")}
			</button>
			{#if openMenu === "script"}
				<div class="tb-panel" role="menu">
					<button
						class="tb-panel-item"
						class:tb-checked={active.superscript}
						type="button"
						onclick={() => act("sup")}
					>
						{@html SVG("superscript", 16)}<span>上标</span>
					</button>
					<button
						class="tb-panel-item"
						class:tb-checked={active.subscript}
						type="button"
						onclick={() => act("sub")}
					>
						{@html SVG("subscript", 16)}<span>下标</span>
					</button>
				</div>
			{/if}
		</div>

		<div class="tb-drop">
			<button
				class="tb-btn tb-color-btn"
				type="button" disabled={disabled}
				title="字体颜色"
				onclick={() => toggleMenu("color")}
			>
				{@html SVG("colorText")}
				<span class="tb-color-bar" style="background:{active.color ?? '#1f2329'}"></span>
			</button>
			{#if openMenu === "color"}
				<div class="tb-panel tb-swatches" role="menu">
					{#each TEXT_COLORS as c}
						<button
							class="tb-swatch"
							class:tb-checked={active.color === c.value}
							type="button"
							title={c.name}
							style="background:{c.value || 'transparent'};{c.value === '' ? 'border:1px dashed #c9cdd4;' : ''}"
							onclick={() => (c.value ? act("color", c.value) : act("unsetColor"))}
						></button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="tb-drop">
			<button
				class="tb-btn tb-color-btn"
				type="button" disabled={disabled}
				title="高亮颜色"
				onclick={() => toggleMenu("bg")}
			>
				{@html SVG("highlighter")}
				<span class="tb-color-bar" style="background:{active.highlight ?? '#ffe08a'}"></span>
			</button>
			{#if openMenu === "bg"}
				<div class="tb-panel tb-swatches" role="menu">
					{#each BG_COLORS as c}
						<button
							class="tb-swatch"
							class:tb-checked={active.highlight === c.value}
							type="button"
							title={c.name}
							style="background:{c.value || 'transparent'};{c.value === '' ? 'border:1px dashed #c9cdd4;' : ''}"
							onclick={() => (c.value ? act("highlight", c.value) : act("unsetHighlight"))}
						></button>
					{/each}
				</div>
			{/if}
		</div>
	</span>

	<span class="tb-group">
		<div class="tb-drop">
			<button
				class="tb-btn"
				type="button" disabled={disabled}
				title="对齐方式"
				onclick={() => toggleMenu("align")}
			>
				{@html SVG(currentAlign().icon)}
			</button>
			{#if openMenu === "align"}
				<div class="tb-panel" role="menu">
					{#each ALIGNS as a}
						<button
							class="tb-panel-item"
							class:tb-checked={(active.textAlign ?? "left") === a.action}
							type="button"
							onclick={() => act("align", a.action)}
						>
							{@html SVG(a.icon, 16)}<span>{a.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="tb-drop">
			<button
				class="tb-btn"
				class:tb-on={active.bulletList}
				type="button"
				title="无序列表"
				onclick={() => toggleMenu("bullet")}
			>
				{@html SVG("listBulleted")}
			</button>
			{#if openMenu === "bullet"}
				<div class="tb-panel" role="menu">
					<button
						class="tb-panel-item"
						class:tb-checked={active.bulletList}
						type="button"
						onclick={() => act("bullet")}
					>
						{@html SVG("listBulleted", 16)}<span>无序列表</span>
					</button>
					<button
						class="tb-panel-item"
						class:tb-checked={active.taskList}
						type="button"
						onclick={() => act("task")}
					>
						{@html SVG("checklist", 16)}<span>任务列表</span>
					</button>
				</div>
			{/if}
		</div>

		<div class="tb-drop">
			<button
				class="tb-btn"
				class:tb-on={active.orderedList}
				type="button"
				title="有序列表"
				onclick={() => toggleMenu("ordered")}
			>
				{@html SVG("listNumbered")}
			</button>
			{#if openMenu === "ordered"}
				<div class="tb-panel" role="menu">
					<button
						class="tb-panel-item"
						class:tb-checked={active.orderedList}
						type="button"
						onclick={() => act("ordered")}
					>
						{@html SVG("listNumbered", 16)}<span>有序列表</span>
					</button>
				</div>
			{/if}
		</div>

		<button class="tb-btn" disabled={disabled} type="button" title="减少缩进" onclick={() => act("outdent")}>
			{@html SVG("indentDecrease")}
		</button>
		<button class="tb-btn" disabled={disabled} type="button" title="增加缩进" onclick={() => act("indent")}>
			{@html SVG("indentIncrease")}
		</button>

		<button class="tb-btn" disabled={disabled} class:tb-on={active.taskList} type="button" title="任务列表" onclick={() => act("task")}>
			{@html SVG("checklist")}
		</button>
	</span>

	<span class="tb-group">
		<button class="tb-btn" disabled={disabled} class:tb-on={active.link} type="button" title="插入链接 (Ctrl+K)" onclick={() => act("link")}>
			{@html SVG("link")}
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.blockquote} type="button" title="引用" onclick={() => act("quote")}>
			{@html SVG("quote")}
		</button>
		<button class="tb-btn" disabled={disabled} type="button" title="分隔线" onclick={() => act("hr")}>
			{@html SVG("hr")}
		</button>
	</span>

	<div class="tb-drop">
		<button class="tb-btn" disabled={disabled} type="button" title="更多" onclick={() => toggleMenu("more")}>
			{@html SVG("more")}
		</button>
		{#if openMenu === "more"}
			<div class="tb-panel" role="menu">
				<button class="tb-panel-item" type="button" onclick={() => act("code")}>
					{@html SVG("code", 16)}<span>代码块</span>
				</button>
				<button class="tb-panel-item" type="button" onclick={() => act("table")}>
					{@html SVG("table", 16)}<span>表格</span>
				</button>
			</div>
		{/if}
	</div>
</nav>

<style>
	.editor-toolbar {
		position: relative;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px;
		padding: 6px 10px;
		background: #fff;
		border-bottom: 1px solid #e5e6eb;
		user-select: none;
		-webkit-user-select: none;
	}

	.editor-toolbar.tb-disabled {
		opacity: 0.55;
		pointer-events: none;
	}

	.tb-group {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-right: 6px;
	}

	.tb-drop {
		position: relative;
		display: inline-flex;
	}

	.tb-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 5px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #4e5969;
		cursor: pointer;
		line-height: 1;
		gap: 4px;
		flex: none;
	}
	.tb-btn:hover:not(:disabled) {
		background: #f2f3f5;
		color: #1d2129;
	}
	.tb-btn:active:not(:disabled) {
		background: #e5e6eb;
	}
	.tb-btn:disabled {
		color: #c9cdd4;
		cursor: not-allowed;
	}
	.tb-btn.tb-on {
		background: #e8f3ff;
		color: #3370ff;
	}

	.tb-new {
		margin-right: 2px;
		background: transparent;
	}
	.tb-new-circle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #3370ff;
		color: #fff;
	}
	.tb-new:hover .tb-new-circle {
		background: #2560e0;
	}

	.tb-select {
		min-width: 64px;
		justify-content: space-between;
		padding: 0 6px;
		font-size: 13px;
	}
	.tb-select-label {
		white-space: nowrap;
	}

	.tb-char {
		font-size: 15px;
		font-weight: 700;
		font-style: normal;
	}

	.tb-painter.tb-on {
		background: #f5e9ff;
		color: #722ed1;
	}

	.tb-color-btn {
		flex-direction: column;
		gap: 1px;
		padding: 2px 5px 0;
	}
	.tb-color-btn .tb-color-bar {
		display: block;
		width: 100%;
		height: 3px;
		border-radius: 2px;
	}

	.tb-panel {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 100;
		min-width: 140px;
		padding: 4px;
		background: #fff;
		border: 1px solid #e5e6eb;
		border-radius: 8px;
		box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
	}
	.tb-panel-scroll {
		max-height: 280px;
		overflow-y: auto;
	}
	.tb-panel-item {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 8px;
		padding: 6px 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #1d2129;
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}
	.tb-panel-item:hover {
		background: #f2f3f5;
	}
	.tb-panel-item.tb-checked {
		color: #3370ff;
		font-weight: 600;
	}
	.tb-kbd {
		margin-left: auto;
		color: #86909c;
		font-size: 12px;
		font-weight: 400;
	}

	.tb-swatches {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
		min-width: 170px;
		padding: 10px;
	}
	.tb-swatch {
		width: 26px;
		height: 26px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}
	.tb-swatch:hover {
		transform: scale(1.08);
	}
	.tb-swatch.tb-checked {
		outline: 2px solid #3370ff;
		outline-offset: 1px;
	}
</style>