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
	undo: `<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>`,
	redo: `<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>`,
	cut: `<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.1 8.1 12 12M20 4 8.1 15.9"/>`,
	eraser: `<path d="m7 21-4-4a2 2 0 0 1 0-2.8L13 4.2a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8l-9 9zM5.5 11.7l6.8 6.8M15 21h6"/>`,
	painter: `<path d="m14.6 17.9-10.7-2.9M18.4 2.6a1 1 0 0 1 3 3l-4 4a.5.5 0 0 0 0 .7l.9.9a2.4 2.4 0 0 1 0 3.4l-.9.9a.5.5 0 0 1-.7 0L8.4 7.3a.5.5 0 0 1 0-.7l.9-.9a2.4 2.4 0 0 1 3.4 0l.9.9a.5.5 0 0 0 .7 0zM9 8c-1.8 2.7-4 3.5-6.6 4a.5.5 0 0 0-.3.8l7.3 8.9a1 1 0 0 0 1.2.2C12.7 20.4 16 16.8 16 15"/>`,
	superscript: `<path d="m4 19 8-8m0 8-8-8m12-4a2 2 0 1 1 4 0c0 1.4-2 2-4 5h4"/>`,
	subscript: `<path d="m4 5 8 8m0-8-8 8m12 3a2 2 0 1 1 4 0c0 1.4-2 2-4 5h4"/>`,
	colorText: `<path d="M6 19 12 5l6 14M8 15h8"/>`,
	highlighter: `<path d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0L9.4 11.4a2 2 0 0 1 0-2.8L14 4"/>`,
	alignLeft: `<path d="M15 12H3m14 6H3M21 6H3"/>`,
	alignCenter: `<path d="M17 12H7m12 6H5M21 6H3"/>`,
	alignRight: `<path d="M21 12H9m12 6H7M21 6H3"/>`,
	alignJustify: `<path d="M3 6h18M3 12h18M3 18h18"/>`,
	listBulleted: `<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r=".75" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r=".75" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r=".75" fill="currentColor" stroke="none"/>`,
	listNumbered: `<path d="M11 5h10m-10 7h10m-10 7h10M4 4h1v5M4 9h2m.5 11H3.4c0-1 2.6-1.9 2.6-3.5A1.5 1.5 0 0 0 3.4 15.5"/>`,
	checklist: `<path d="m3 5 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8"/>`,
	indentDecrease: `<path d="M21 6H11m10 6H11m10 6H11M7 8l-4 4 4 4"/>`,
	indentIncrease: `<path d="M21 6H11m10 6H11m10 6H11M3 8l4 4-4 4"/>`,
	table: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M12 3v18"/>`,
	link: `<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.8-1.7"/>`,
	quote: `<path d="M9 11H4a2 2 0 0 1-2-2V7a4 4 0 0 1 4-4h1M22 11h-5a2 2 0 0 1-2-2V7a4 4 0 0 1 4-4h1M6 11v2a5 5 0 0 1-5 5M19 11v2a5 5 0 0 1-5 5"/>`,
	hr: `<path d="M5 12h14"/>`,
	code: `<path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-8-2 10"/>`,
	more: `<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>`,
	check: `<path d="m20 6-11 11-5-5"/>`,
	chevronDown: `<path d="m6 9 6 6 6-6"/>`,
};

const SVG = (name: string, size = 18) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

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

function onGlobalKeyDown(event: KeyboardEvent) {
	if (event.key === "Escape") openMenu = null;
}

onMount(() => {
	window.addEventListener("pointerdown", onGlobalPointerDown, true);
	window.addEventListener("keydown", onGlobalKeyDown);
});
onDestroy(() => {
	window.removeEventListener("pointerdown", onGlobalPointerDown, true);
	window.removeEventListener("keydown", onGlobalKeyDown);
});

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
const isSizeActive = (size: number) =>
	active.fontSize === `${size}px` || (size === 16 && active.fontSize === null);
const currentAlign = () =>
	ALIGNS.find((a) => a.action === (active.textAlign ?? "left")) ?? ALIGNS[0];
</script>

<div
	class="editor-toolbar"
	class:tb-disabled={disabled}
	role="toolbar"
	aria-label="正文格式"
	aria-disabled={disabled}
>
	<span class="tb-group">
		<button class="tb-btn" type="button" title="撤销 (Ctrl+Z)" aria-label="撤销" disabled={disabled || !canUndo} onclick={() => act("undo")}>
			{@html SVG("undo")}
		</button>
		<button class="tb-btn" type="button" title="重做 (Ctrl+Y)" aria-label="重做" disabled={disabled || !canRedo} onclick={() => act("redo")}>
			{@html SVG("redo")}
		</button>
		<button class="tb-btn" disabled={disabled} type="button" title="剪切 (Ctrl+X)" aria-label="剪切" onclick={() => act("cut")}>
			{@html SVG("cut")}
		</button>
		<button class="tb-btn" disabled={disabled} type="button" title="清除格式 (Ctrl+\)" aria-label="清除格式" onclick={() => act("clearFormat")}>
			{@html SVG("eraser")}
		</button>
		<button
			class="tb-btn tb-painter"
			class:tb-on={painterActive}
			type="button"
			disabled={disabled}
			title="格式刷：点击拾取格式，再点击目标文字应用"
			aria-label="格式刷"
			aria-pressed={painterActive}
			onclick={() => act("painter")}
		>
			{@html SVG("painter")}
		</button>
	</span>

	<span class="tb-group">
		<div class="tb-drop">
			<button
				class="tb-btn tb-select tb-select-block"
				class:tb-open={openMenu === "block"}
				type="button" disabled={disabled}
				title="段落样式"
				aria-label={`段落样式，当前${currentBlock()}`}
				aria-haspopup="listbox"
				aria-expanded={openMenu === "block"}
				onclick={() => toggleMenu("block")}
			>
				<span class="tb-select-label">{currentBlock()}</span>
				{@html SVG("chevronDown", 14)}
			</button>
			{#if openMenu === "block"}
				<div class="tb-panel tb-panel-block" role="listbox" aria-label="段落样式">
					<button
						class="tb-panel-item"
						class:tb-checked={active.paragraph}
						type="button"
						role="option"
						aria-selected={active.paragraph}
						onclick={() => act("paragraph")}
					>
						<span class="tb-check-slot">{#if active.paragraph}{@html SVG("check", 16)}{/if}</span>
						<span class="tb-block-preview tb-block-normal">正文</span>
						<span class="tb-kbd">Alt Ctrl 0</span>
					</button>
					{#each [1, 2, 3, 4, 5, 6] as level}
						<button
							class="tb-panel-item"
							class:tb-checked={active.headingLevel === level}
							type="button"
							role="option"
							aria-selected={active.headingLevel === level}
							onclick={() => act(`h${level}`)}
						>
							<span class="tb-check-slot">{#if active.headingLevel === level}{@html SVG("check", 16)}{/if}</span>
							<span class={`tb-block-preview tb-block-h${level}`}>标题{level}</span>
							<span class="tb-kbd">Alt Ctrl {level}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="tb-drop">
			<button
				class="tb-btn tb-select tb-select-size"
				class:tb-open={openMenu === "size"}
				type="button" disabled={disabled}
				title="字号"
				aria-label={`字号，当前${currentSize()}`}
				aria-haspopup="listbox"
				aria-expanded={openMenu === "size"}
				onclick={() => toggleMenu("size")}
			>
				<span class="tb-select-label">{currentSize()}</span>
				{@html SVG("chevronDown", 14)}
			</button>
			{#if openMenu === "size"}
				<div class="tb-panel tb-panel-scroll" role="listbox" aria-label="字号">
					{#each FONT_SIZES as size}
						<button
							class="tb-panel-item"
							class:tb-checked={isSizeActive(size)}
							type="button"
							role="option"
							aria-selected={isSizeActive(size)}
							onclick={() => act("fontSize", `${size}px`)}
						>
							<span class="tb-check-slot">{#if isSizeActive(size)}{@html SVG("check", 14)}{/if}</span>
							<span>{size}px</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</span>

	<span class="tb-group">
		<button class="tb-btn" disabled={disabled} class:tb-on={active.bold} type="button" title="加粗 (Ctrl+B)" aria-label="加粗" aria-pressed={active.bold} onclick={() => act("bold")}>
			<b class="tb-char">B</b>
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.italic} type="button" title="斜体 (Ctrl+I)" aria-label="斜体" aria-pressed={active.italic} onclick={() => act("italic")}>
			<i class="tb-char">I</i>
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.strike} type="button" title="删除线 (Ctrl+Shift+X)" aria-label="删除线" aria-pressed={active.strike} onclick={() => act("strike")}>
			<s class="tb-char">S</s>
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.underline} type="button" title="下划线 (Ctrl+U)" aria-label="下划线" aria-pressed={active.underline} onclick={() => act("underline")}>
			<u class="tb-char">U</u>
		</button>
	</span>

	<span class="tb-group">
		<div class="tb-drop">
			<button
				class="tb-btn"
				class:tb-on={active.superscript || active.subscript}
				class:tb-open={openMenu === "script"}
				type="button"
				disabled={disabled}
				title="上标 / 下标"
				aria-label="上标或下标"
				aria-haspopup="menu"
				aria-expanded={openMenu === "script"}
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
				class:tb-open={openMenu === "color"}
				type="button" disabled={disabled}
				title="字体颜色"
				aria-label="字体颜色"
				aria-haspopup="menu"
				aria-expanded={openMenu === "color"}
				onclick={() => toggleMenu("color")}
			>
				{@html SVG("colorText")}
				<span class="tb-color-bar" style="background:{active.color ?? 'var(--tb-content)'}"></span>
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
				class:tb-open={openMenu === "bg"}
				type="button" disabled={disabled}
				title="高亮颜色"
				aria-label="高亮颜色"
				aria-haspopup="menu"
				aria-expanded={openMenu === "bg"}
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
				class:tb-open={openMenu === "align"}
				type="button" disabled={disabled}
				title="对齐方式"
				aria-label="对齐方式"
				aria-haspopup="menu"
				aria-expanded={openMenu === "align"}
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
				class:tb-open={openMenu === "bullet"}
				type="button"
				disabled={disabled}
				title="无序列表"
				aria-label="无序列表"
				aria-haspopup="menu"
				aria-expanded={openMenu === "bullet"}
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
				class:tb-open={openMenu === "ordered"}
				type="button"
				disabled={disabled}
				title="有序列表"
				aria-label="有序列表"
				aria-haspopup="menu"
				aria-expanded={openMenu === "ordered"}
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
				class:tb-open={openMenu === "indent"}
				type="button" disabled={disabled}
				title="缩进"
				aria-label="缩进"
				aria-haspopup="menu"
				aria-expanded={openMenu === "indent"}
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

		<button class="tb-btn" disabled={disabled} type="button" title="插入表格" aria-label="插入表格" onclick={() => act("table")}>
			{@html SVG("table")}
		</button>
	</span>

	<span class="tb-group">
		<button class="tb-btn" disabled={disabled} class:tb-on={active.link} type="button" title="插入链接 (Ctrl+K)" aria-label="插入链接" aria-pressed={active.link} onclick={() => act("link")}>
			{@html SVG("link")}
		</button>
		<button class="tb-btn" disabled={disabled} class:tb-on={active.blockquote} type="button" title="引用" aria-label="引用" aria-pressed={active.blockquote} onclick={() => act("quote")}>
			{@html SVG("quote")}
		</button>
		<button class="tb-btn" disabled={disabled} type="button" title="分隔线" aria-label="分隔线" onclick={() => act("hr")}>
			{@html SVG("hr")}
		</button>
	</span>

	<div class="tb-drop">
		<button class="tb-btn" class:tb-open={openMenu === "more"} disabled={disabled} type="button" title="更多" aria-label="更多" aria-haspopup="menu" aria-expanded={openMenu === "more"} onclick={() => toggleMenu("more")}>
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
</div>

<style>
	.editor-toolbar {
		--tb-bg: var(--card-bg);
		--tb-panel-bg: var(--float-panel-bg, var(--card-bg));
		--tb-content: var(--btn-content);
		--tb-hover: var(--btn-plain-bg-hover);
		--tb-active: var(--btn-plain-bg-active);
		--tb-border: var(--line-divider);
		--tb-muted: var(--content-meta);
		--tb-primary: var(--primary);

		position: relative;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px;
		padding: 7px 10px;
		border: 1px solid var(--tb-border);
		border-radius: inherit;
		background: var(--tb-bg);
		color: var(--tb-content);
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
		min-width: 30px;
		height: 32px;
		padding: 0 6px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--tb-content);
		cursor: pointer;
		line-height: 1;
		gap: 4px;
		flex: none;
		font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}
	.tb-btn:hover:not(:disabled) {
		background: var(--tb-hover);
	}
	.tb-btn:active:not(:disabled) {
		background: var(--tb-active);
	}
	.tb-btn:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}
	.tb-btn:focus {
		outline: none;
	}
	.tb-btn:focus-visible,
	.tb-panel-item:focus-visible,
	.tb-swatch:focus-visible {
		outline: 2px solid var(--tb-primary);
		outline-offset: 1px;
	}
	.tb-btn.tb-on {
		background: color-mix(in srgb, var(--tb-primary) 13%, transparent);
		color: var(--tb-primary);
	}
	.tb-btn.tb-open {
		background: var(--tb-hover);
		color: var(--tb-content);
	}

	.tb-select {
		min-width: unset;
		justify-content: space-between;
		padding: 0 8px 0 10px;
		font-size: 14px;
		font-weight: 500;
		letter-spacing: 0;
	}
	.tb-select-block {
		width: 84px;
	}
	.tb-select-size {
		width: 72px;
	}
	.tb-select-label {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.tb-select :global(svg) {
		flex: none;
	}
	.tb-select.tb-open:focus-visible {
		outline: none;
	}

	.tb-char {
		font-size: 14px;
		font-weight: 600;
		font-style: normal;
	}

	.tb-painter.tb-on {
		background: color-mix(in srgb, var(--tb-primary) 13%, transparent);
		color: var(--tb-primary);
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
		background: var(--tb-panel-bg);
		border: 1px solid var(--tb-border);
		border-radius: 8px;
		box-shadow: 0 10px 28px color-mix(in srgb, var(--tb-content) 16%, transparent);
	}
	.tb-panel-block {
		top: calc(100% + 4px);
		width: min(280px, calc(100vw - 24px));
		padding: 8px;
	}
	.tb-panel-block .tb-panel-item {
		height: 40px;
		gap: 8px;
		padding: 0 12px;
	}
	.tb-panel-block .tb-panel-item.tb-checked {
		background: transparent;
		color: var(--tb-content);
	}
	.tb-panel-block .tb-panel-item:hover,
	.tb-panel-block .tb-panel-item.tb-checked:hover {
		background: var(--tb-hover);
	}
	.tb-panel-block .tb-check-slot {
		flex-basis: 24px;
		width: 24px;
		height: 24px;
		color: var(--tb-content);
	}
	.tb-block-preview {
		flex: 1;
		min-width: 0;
		line-height: 1;
		color: var(--tb-content);
	}
	.tb-block-normal {
		font-size: 14px;
		font-weight: 400;
	}
	.tb-block-h1 {
		font-size: 24px;
		font-weight: 700;
	}
	.tb-block-h2 {
		font-size: 20px;
		font-weight: 600;
	}
	.tb-block-h3 {
		font-size: 18px;
		font-weight: 600;
	}
	.tb-block-h4 {
		font-size: 16px;
		font-weight: 600;
	}
	.tb-block-h5 {
		font-size: 15px;
		font-weight: 500;
	}
	.tb-block-h6 {
		font-size: 14px;
		font-weight: 500;
	}
	.tb-panel-block .tb-kbd {
		flex: 0 0 72px;
		text-align: right;
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
		color: var(--tb-content);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}
	.tb-panel-item:hover {
		background: var(--tb-hover);
	}
	.tb-panel-item.tb-checked {
		background: color-mix(in srgb, var(--tb-primary) 9%, transparent);
		color: var(--tb-primary);
		font-weight: 600;
	}
	.tb-check-slot {
		display: inline-flex;
		flex: 0 0 14px;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
	}
	.tb-kbd {
		margin-left: auto;
		color: var(--tb-muted);
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
		outline: 2px solid var(--tb-primary);
		outline-offset: 1px;
	}
</style>
