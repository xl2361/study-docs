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
	undo: `<path fill="currentColor" d="M7.404 18v-1h7.254q1.556 0 2.65-1.067q1.096-1.067 1.096-2.606t-1.095-2.596q-1.096-1.058-2.651-1.058H6.916l2.965 2.965l-.708.708L5 9.173L9.173 5l.708.708l-2.965 2.965h7.742q1.963 0 3.355 1.354q1.39 1.354 1.39 3.3t-1.39 3.31T14.657 18z"/>`,
	redo: `<path fill="currentColor" d="M9.342 18q-1.963 0-3.355-1.364t-1.39-3.309t1.39-3.3Q7.38 8.673 9.343 8.673h7.743L14.12 5.708L14.828 5L19 9.173l-4.173 4.173l-.708-.707l2.966-2.966H9.342q-1.556 0-2.65 1.058q-1.096 1.058-1.096 2.596t1.095 2.606Q7.787 17 9.342 17h7.254v1z"/>`,
	cut: `<path fill="currentColor" d="m19.385 20.539l-7.308-7.308l-3.12 3.119q.22.375.324.79t.104.86q0 1.362-.973 2.335q-.974.973-2.335.973t-2.335-.973Q2.77 19.362 2.77 18t.973-2.334t2.335-.974q.444 0 .86.104q.415.104.79.323L10.847 12l-3.12-3.12q-.375.22-.79.324t-.86.104q-1.362 0-2.335-.973Q2.77 7.36 2.77 6t.973-2.334t2.335-.974t2.335.973q.972.974.972 2.335q0 .444-.103.86q-.104.415-.323.79L21.23 19.923v.616zm-4.77-9.847l-1.23-1.23l6-6h1.846v.615zM7.712 7.634Q8.385 6.96 8.385 6T7.71 4.366t-1.634-.674t-1.634.674Q3.77 5.041 3.77 6t.674 1.634t1.634.674t1.634-.674m4.37 4.37q-.004.004-.004-.004t.004-.004t-.004.004t-.004-.004t.004.004t-.004.004t.004-.004t.004.004m-4.37 7.63q.673-.675.673-1.634t-.674-1.634q-.674-.674-1.633-.674q-.96 0-1.634.674q-.674.675-.674 1.634t.674 1.634q.674.674 1.634.674t1.633-.674"/>`,
	eraser: `<path fill="currentColor" d="M16.712 18h4.673v1H15.71zM4.558 19l-1.414-1.413q-.478-.48-.491-1.137t.466-1.161L13.273 4.733q.479-.503 1.134-.494t1.134.489l4.09 4.09q.479.479.488 1.146q.01.668-.469 1.146L11.962 19z"/>`,
	painter: `<path fill="currentColor" d="M6.385 19.616q-.587 0-1.168-.204q-.58-.204-1.025-.566q.496-.327.844-.878t.349-1.352q0-.847.577-1.424q.577-.576 1.423-.576t1.423.576t.577 1.424q0 1.246-.877 2.123t-2.123.877M11.25 14.5l-1.711-1.711l8.18-8.181q.275-.275.688-.288t.712.288l.312.311q.3.3.3.7t-.3.7z"/>`,
	superscript: `<path fill="currentColor" d="M18.385 9V7.423q0-.348.23-.578t.577-.23H21V5.77h-2.616V5h2.577q.349 0 .579.23t.23.578v.769q0 .348-.23.578t-.578.23h-1.808v.846h2.615V9zM7.009 19l4.183-6.467l-3.838-5.917h1.284l3.331 5.192h.023l3.383-5.192h1.29l-3.901 5.917L16.99 19H15.7l-3.708-5.713h-.023L8.3 19z"/>`,
	subscript: `<path fill="currentColor" d="M18.385 19v-1.577q0-.348.23-.578t.577-.23H21v-.846h-2.616V15h2.577q.349 0 .579.23t.23.578v.769q0 .348-.23.578t-.578.23h-1.808v.846h2.615V19zM7.009 17.384l4.183-6.467L7.354 5h1.284l3.331 5.192h.023L15.375 5h1.29l-3.901 5.917l4.227 6.468H15.7l-3.708-5.714h-.023L8.3 17.385z"/>`,
	colorText: `<path fill="currentColor" d="M3 24v-3.462h18V24zm3.23-7l5.29-13h.96l5.29 13h-1.21l-1.442-3.638H8.816L7.36 17zm2.94-4.6h5.584L12.05 5.6h-.138z"/>`,
	highlighter: `<path fill="currentColor" d="M2 24v-2h20v2zm8.696-15.02l4.016 4.022l-3.885 3.885q-.485.484-1.134.484t-1.133-.484l-.193-.193l-1.155 1.133h-2.77l2.535-2.529l-.154-.154q-.484-.485-.49-1.14t.479-1.139zm.708-.713l4.558-4.551q.484-.485 1.133-.485t1.134.485l1.754 1.748q.484.484.484 1.133q0 .65-.484 1.134l-4.558 4.558z"/>`,
	alignLeft: `<path fill="currentColor" d="M4 20v-1h16v1zm0-3.75v-1h10v1zm0-3.75v-1h16v1zm0-3.75v-1h10v1zM4 5V4h16v1z"/>`,
	alignCenter: `<path fill="currentColor" d="M4 20v-1h16v1zm4-3.75v-1h8v1zM4 12.5v-1h16v1zm4-3.75v-1h8v1zM4 5V4h16v1z"/>`,
	alignRight: `<path fill="currentColor" d="M4 5V4h16v1zm6 3.75v-1h10v1zM4 12.5v-1h16v1zm6 3.75v-1h10v1zM4 20v-1h16v1z"/>`,
	alignJustify: `<path fill="currentColor" d="M4 20v-1h16v1zm0-3.75v-1h16v1zm0-3.75v-1h16v1zm0-3.75v-1h16v1zM4 5V4h16v1z"/>`,
	listBulleted: `<path fill="currentColor" d="M9.616 18.5v-1H20v1zm0-6v-1H20v1zm0-6v-1H20v1zM5.327 19.327q-.547 0-.937-.39T4 18t.39-.937t.937-.39t.937.39t.39.937t-.39.937t-.937.39m0-6q-.547 0-.937-.386Q4 12.556 4 12t.39-.941t.937-.386t.937.386q.39.385.39.941t-.39.941t-.937.386m-.941-6.386Q4 6.556 4 6t.386-.941t.941-.386t.941.386q.386.385.386.941t-.386.941q-.385.386-.941.386t-.941-.386"/>`,
	listNumbered: `<path fill="currentColor" d="M4 21v-.885h2.5V18.75H5v-.885h1.5V16.5H4v-.885h2.692q.294 0 .493.2t.2.493v1.384q0 .295-.2.494t-.493.199q.294 0 .493.199q.2.199.2.493v1.23q0 .295-.2.494T6.692 21zm0-6.308V12.25q0-.294.199-.493t.493-.2H6.5v-1.365H4v-.884h2.692q.294 0 .493.199t.2.493v1.75q0 .294-.2.493t-.493.2H4.884v1.365h2.5v.884zm1.5-6.308v-4.5H4V3h2.385v5.385zM9.616 18.5v-1H20v1zm0-6v-1H20v1zm0-6v-1H20v1z"/>`,
	indentDecrease: `<path fill="currentColor" d="M4 20v-1h16v1zm8-3.75v-1h8v1zm0-3.75v-1h8v1zm0-3.75v-1h8v1zM4 5V4h16v1zm2.808 9.808L4 12l2.808-2.808z"/>`,
	indentIncrease: `<path fill="currentColor" d="M4 20v-1h16v1zm8-3.75v-1h8v1zm0-3.75v-1h8v1zm0-3.75v-1h8v1zM4 5V4h16v1zm0 9.808V9.192L6.808 12z"/>`,
	table: `<path fill="currentColor" d="M11.5 14.885H4v3.5q0 .666.475 1.14t1.14.475H11.5zm1 0V20h5.885q.666 0 1.14-.475t.475-1.14v-3.5zm-1-1V8.769H4v5.116zm1 0H20V8.769h-7.5zM4 7.769h16V5.615q0-.666-.475-1.14T18.386 4H5.615q-.666 0-1.14.475T4 5.615z"/>`,
	link: `<path fill="currentColor" d="M10.616 16.077H7.077q-1.692 0-2.884-1.192T3 12t1.193-2.885t2.884-1.193h3.539v1H7.077q-1.27 0-2.173.904Q4 10.731 4 12t.904 2.173t2.173.904h3.539zM8.5 12.5v-1h7v1zm4.885 3.577v-1h3.538q1.27 0 2.173-.904Q20 13.269 20 12t-.904-2.173t-2.173-.904h-3.538v-1h3.538q1.692 0 2.885 1.192T21 12t-1.193 2.885t-2.884 1.193z"/>`,
	quote: `<path fill="currentColor" d="m6.585 17.308l2.396-4.174q-.173.097-.404.135t-.461.039q-1.4 0-2.354-.973q-.954-.974-.954-2.335q0-1.4.954-2.354t2.354-.954q1.361 0 2.334.954T11.423 10q0 .479-.118.899t-.336.793l-3.238 5.616zm8.769 0l2.396-4.173q-.173.096-.404.134t-.461.039q-1.4 0-2.354-.973T13.577 10q0-1.42.954-2.363t2.354-.945q1.361 0 2.334.954T20.192 10q0 .479-.118.899t-.335.793L16.5 17.308z"/>`,
	hr: `<path fill="currentColor" d="M5 12.5v-1h14v1z"/>`,
	code: `<path fill="currentColor" d="M8.005 18l-1.413-1.412L11.18 12L6.592 7.412L8.005 6l6 6zm7.99 0l-6-6l6-6l1.413 1.412L13.18 12l4.588 4.588z"/>`,
	more: `<path fill="currentColor" d="M6.462 13q-.413 0-.707-.294T5.462 12t.293-.706t.707-.294t.706.294t.293.706t-.293.706T6.46 13M12 13q-.413 0-.706-.294T11 12t.294-.706T12 11t.706.294T13 12t-.294.706T12 13m5.539 0q-.413 0-.707-.294T16.538 12t.294-.706t.706-.294t.707.294t.293.706t-.293.706t-.707.294"/>`,
	check: `<path fill="currentColor" d="m9.55 17.308l-4.97-4.97l.714-.713l4.256 4.256l9.156-9.156l.713.714z"/>`,
	chevronDown: `<path fill="currentColor" d="M12 14.702L6.692 9.394l.708-.707l4.6 4.6l4.6-4.6l.708.707z"/>`,
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

const FONT_SIZES = [12, 13, 14, 15, 16, 19, 22, 24, 29, 32, 40, 48];
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
	<span class="tb-group">
		<button class="tb-btn" type="button" title="撤销 (Ctrl+Z)" disabled={disabled || !canUndo} onclick={() => act("undo")}>
			{@html SVG("undo")}
		</button>
		<button class="tb-btn" type="button" title="重做 (Ctrl+Y)" disabled={disabled || !canRedo} onclick={() => act("redo")}>
			{@html SVG("redo")}
		</button>
		<button class="tb-btn" disabled={disabled} type="button" title="剪切 (Ctrl+X)" onclick={() => act("cut")}>
			{@html SVG("cut")}
		</button>
		<button class="tb-btn" disabled={disabled} type="button" title="清除格式 (Ctrl+\)" onclick={() => act("clearFormat")}>
			{@html SVG("eraser")}
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
						{#if active.paragraph}{@html SVG("check", 14)}{/if}
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
							{#if active.headingLevel === level}
								{@html SVG("check", 14)}
							{/if}
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
				<div class="tb-panel tb-panel-scroll tb-panel-zebra" role="menu">
					{#each FONT_SIZES as size}
						<button
							class="tb-panel-item"
							class:tb-checked={active.fontSize === `${size}px`}
							type="button"
							onclick={() => act("fontSize", `${size}px`)}
						>
							{#if active.fontSize === `${size}px`}
								{@html SVG("check", 14)}
							{/if}
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

		<div class="tb-drop">
			<button
				class="tb-btn"
				type="button" disabled={disabled}
				title="缩进"
				onclick={() => toggleMenu("indent")}
			>
				{@html SVG("indentDecrease")}
				{@html SVG("chevronDown", 12)}
			</button>
			{#if openMenu === "indent"}
				<div class="tb-panel" role="menu">
					<button
						class="tb-panel-item"
						type="button"
						onclick={() => act("indent")}
					>
						{@html SVG("indentIncrease", 16)}<span>增加缩进</span>
					</button>
					<button
						class="tb-panel-item"
						type="button"
						onclick={() => act("outdent")}
					>
						{@html SVG("indentDecrease", 16)}<span>减少缩进</span>
					</button>
				</div>
			{/if}
		</div>

		<button class="tb-btn" disabled={disabled} type="button" title="插入表格" onclick={() => act("table")}>
			{@html SVG("table")}
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
		background: #f2f3f5;
		color: #1d2129;
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
	.tb-panel-zebra .tb-panel-item:nth-child(even) {
		background: #f7f8fa;
	}
	.tb-panel-zebra .tb-panel-item:nth-child(even):hover {
		background: #f2f3f5;
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