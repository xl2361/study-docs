<script lang="ts">
import { onMount, tick } from "svelte";

export let slug: string;
export let title: string;

type Draft = {
	slug: string;
	title: string;
	content?: string;
	sha: string;
	path: string;
	delete?: boolean;
	previous?: Omit<Draft, "previous">;
};
type OutlineItem = { id: string; level: number; text: string };
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
	run: () => boolean;
};
type EditorLike = {
	chain: () => EditorChain;
	commands: {
		setContent: (content: string, options: Record<string, unknown>) => void;
	};
	getMarkdown: () => string;
	getJSON: () => JsonNode;
	destroy: () => void;
};

const draftsKey = "study-edit-drafts";
const editModeKey = "study-edit-mode";
let editing = false;
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
let hasDraft = false;
let markedForDeletion = false;
let sourceMode = false;
let editorReady = false;
let editorMount: HTMLElement;
let sourceValue = "";
let editor: EditorLike | null = null;
let outline: OutlineItem[] = [];

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

function buildArticle(body: string) {
	const lines = frontmatterSource.replace(/\r\n?/g, "\n").split("\n");
	setField(lines, "title", JSON.stringify(articleTitle.trim()));
	setField(lines, "published", published.trim());
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
	return JSON.parse(value) as Record<string, Draft>;
}

function validDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function slugify(text: string, index: number) {
	const base =
		text
			.toLowerCase()
			.trim()
			.replace(/[^\p{L}\p{N}]+/gu, "-")
			.replace(/^-|-$/g, "") || "heading";
	return `${base}-${index}`;
}

function updateOutline() {
	if (!editor) return;
	let index = 0;
	const items: OutlineItem[] = [];
	const walk = (node: JsonNode) => {
		if (
			node.type === "heading" &&
			node.attrs?.level >= 2 &&
			node.attrs.level <= 4
		) {
			const text = (node.content || [])
				.map((child) => child.text || "")
				.join("")
				.trim();
			const id = slugify(text, index++);
			items.push({ id, level: node.attrs.level, text: text || "无标题" });
		}
		for (const child of node.content || []) walk(child);
	};
	walk(editor.getJSON());
	outline = items;
	editorMount?.querySelectorAll("h2,h3,h4").forEach((heading, i) => {
		heading.id = items[i]?.id || `heading-${i}`;
	});
}

function markDirty(bodyChanged = false) {
	dirty = true;
	bodyDirty = bodyDirty || bodyChanged;
	savedMessage = "";
}

async function createEditor() {
	if (!editorMount || sourceMode || editor) return;
	editorReady = false;
	try {
		const [core, starter, markdown, table, image] = await Promise.all([
			import("@tiptap/core"),
			import("@tiptap/starter-kit"),
			import("@tiptap/markdown"),
			import("@tiptap/extension-table"),
			import("@tiptap/extension-image"),
		]);
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
				updateOutline();
			},
		});
		editor.commands.setContent(originalBody, {
			contentType: "markdown",
			emitUpdate: false,
			errorOnInvalidContent: true,
		});
		editorReady = true;
		updateOutline();
	} catch (reason) {
		editor?.destroy();
		editor = null;
		sourceMode = true;
		sourceValue = originalBody;
		editorReady = true;
		error = "本文包含富文本模式无法解析的原始 HTML/XML，已切换为源码模式";
	}
}

function destroyEditor() {
	editor?.destroy();
	editor = null;
	editorReady = false;
	outline = [];
}

async function loadArticle() {
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
		parseArticle(article.content || "");
		sha = article.sha || "";
		path = article.path || "";
		const draft = readDrafts()[slug];
		hasDraft = Boolean(draft);
		if (draft) {
			sha = draft.sha || sha;
			path = draft.path || path;
			markedForDeletion = Boolean(draft.delete);
			if (!draft.delete && draft.content) parseArticle(draft.content);
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

async function openEditor() {
	if (!loaded) await loadArticle();
	if (!loaded) return;
	editing = true;
	document.documentElement.classList.add("study-editor-active");
	await tick();
	await createEditor();
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
		if (!validDate(published))
			throw new Error("发布日期必须是真实的 YYYY-MM-DD");
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
		const previous = drafts[slug];
		drafts[slug] = {
			slug,
			title: articleTitle,
			content: buildArticle(body),
			sha,
			path,
			previous: previous?.delete ? previous.previous : previous,
		};
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
		originalBody = body;
		sourceValue = body;
		dirty = false;
		bodyDirty = false;
		hasDraft = true;
		markedForDeletion = false;
		savedMessage = "已保存到本轮，点击顶部“更新”后提交";
		return true;
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "草稿保存失败";
		return false;
	}
}

function leaveEditor() {
	destroyEditor();
	editing = false;
	document.documentElement.classList.remove("study-editor-active");
}

function complete() {
	if (dirty && !saveDraft()) return;
	leaveEditor();
}
function undoDraft() {
	const drafts = readDrafts();
	const previous = drafts[slug]?.previous;
	if (previous) drafts[slug] = previous;
	else delete drafts[slug];
	if (Object.keys(drafts).length)
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
	else sessionStorage.removeItem(draftsKey);
	location.reload();
}
function deleteArticle() {
	if (!loaded || !sha || !path) {
		error = "文章尚未成功加载，无法删除";
		return;
	}
	const drafts = readDrafts();
	if (markedForDeletion) {
		undoDraft();
		return;
	}
	if (!confirm(`确认将《${articleTitle || title}》加入删除列表？`)) return;
	drafts[slug] = {
		slug,
		title: articleTitle || title,
		sha,
		path,
		delete: true,
		previous: drafts[slug]?.delete ? drafts[slug].previous : drafts[slug],
	};
	sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
	markedForDeletion = true;
	hasDraft = true;
	dirty = false;
	leaveEditor();
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
	const setMode = (enabled: boolean) => {
		if (enabled) void openEditor();
		else complete();
	};
	const flush = (event: Event) => {
		const detail = (event as CustomEvent<{ success: boolean }>).detail;
		if (editing && dirty) detail.success = saveDraft();
	};
	const beforeUnload = () => {
		if (dirty) saveDraft();
	};
	const modeChange = (event: Event) =>
		setMode(
			Boolean((event as CustomEvent<{ editing?: boolean }>).detail?.editing),
		);
	window.addEventListener("study-edit-mode-change", modeChange);
	window.addEventListener("study-article-editor-open", () => void openEditor());
	window.addEventListener("study-article-editor-flush", flush);
	window.addEventListener("beforeunload", beforeUnload);
	if (sessionStorage.getItem(editModeKey) === "1") void openEditor();
	return () => {
		window.removeEventListener("study-edit-mode-change", modeChange);
		window.removeEventListener("study-article-editor-flush", flush);
		window.removeEventListener("beforeunload", beforeUnload);
		if (dirty) saveDraft();
		destroyEditor();
		document.documentElement.classList.remove("study-editor-active");
	};
});
</script>

{#if editing}
 <section class="ha-editor" aria-busy={loading} aria-label="文章编辑器">
  <header class="editor-header">
   <div class="header-row"><input class="title-input" bind:value={articleTitle} oninput={() => markDirty()} placeholder="请输入标题" aria-label="文章标题" disabled={!loaded} /><span class="status">{loading ? "正在读取…" : error ? "无法保存" : dirty ? "未保存" : "已保存"}</span><button class="primary" type="button" onclick={saveDraft} disabled={loading || !loaded || !editorReady}>保存</button><button type="button" onclick={complete} disabled={loading || !loaded}>完成</button></div>
   <details><summary>文档属性</summary><div class="properties"><label>发布日期<input type="date" bind:value={published} oninput={() => markDirty()} disabled={!loaded} /></label><label>分类<input bind:value={category} oninput={() => markDirty()} maxlength="50" disabled={!loaded} /></label><label class="wide">标签<input bind:value={tags} oninput={() => markDirty()} placeholder="逗号分隔，最多 30 项" disabled={!loaded} /></label></div></details>
   <div class="header-row secondary"><button type="button" onclick={markedForDeletion ? deleteArticle : undoDraft} disabled={loading || (!markedForDeletion && !hasDraft)}>{markedForDeletion ? "撤销删除" : "撤销草稿"}</button><button class="danger" type="button" onclick={deleteArticle} disabled={loading || markedForDeletion || !loaded || !sha || !path}>删除</button>{#if error}<span class="error" role="alert">{error}</span>{/if}{#if savedMessage}<span class="success">{savedMessage}</span>{/if}</div>
   <details class="advanced"><summary>完整 Frontmatter（高级）</summary><textarea bind:value={frontmatterSource} oninput={() => markDirty()} rows="7" disabled={!loaded}></textarea></details>
  </header>
  <nav class="toolbar" aria-label="正文格式"><button title="撤销" onclick={() => format("undo")} disabled={!editorReady || sourceMode}>↶</button><button title="重做" onclick={() => format("redo")} disabled={!editorReady || sourceMode}>↷</button><button title="一级标题" onclick={() => format("h1")} disabled={!editorReady || sourceMode}>H1</button><button title="二级标题" onclick={() => format("h2")} disabled={!editorReady || sourceMode}>H2</button><button title="三级标题" onclick={() => format("h3")} disabled={!editorReady || sourceMode}>H3</button><button title="粗体" onclick={() => format("bold")} disabled={!editorReady || sourceMode}><b>B</b></button><button title="斜体" onclick={() => format("italic")} disabled={!editorReady || sourceMode}><i>I</i></button><button title="删除线" onclick={() => format("strike")} disabled={!editorReady || sourceMode}><s>S</s></button><button title="无序列表" onclick={() => format("bullet")} disabled={!editorReady || sourceMode}>•</button><button title="有序列表" onclick={() => format("ordered")} disabled={!editorReady || sourceMode}>1.</button><button title="引用" onclick={() => format("quote")} disabled={!editorReady || sourceMode}>❝</button><button title="代码块" onclick={() => format("code")} disabled={!editorReady || sourceMode}>{"</>"}</button><button title="分隔线" onclick={() => format("hr")} disabled={!editorReady || sourceMode}>—</button></nav>
  <div class="editor-shell"><main class="document"><div class="paper">{#if sourceMode}<p class="source-note">源码模式：当前 Markdown 含有富文本编辑器无法解析的原始内容。</p><textarea class="source-editor" bind:value={sourceValue} oninput={() => markDirty(true)} aria-label="Markdown 正文源码编辑器" spellcheck="false" disabled={!loaded}></textarea>{:else}<div class="tiptap-host" bind:this={editorMount}></div>{/if}</div></main>{#if outline.length}<aside class="outline"><h2>大纲</h2>{#each outline as item}<button class:indent={item.level > 2} type="button" onclick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{item.text}</button>{/each}</aside>{/if}</div>
 </section>
{/if}

<style>
 .ha-editor { color: var(--btn-content); } .editor-header { display: grid; gap: .65rem; margin-bottom: .75rem; } .header-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; } .title-input { min-width: 12rem; flex: 1; border: 0; border-bottom: 2px solid color-mix(in srgb, var(--primary) 35%, transparent); padding: .55rem .1rem; color: inherit; background: transparent; font-size: 1.35rem; font-weight: 750; } .status { color: color-mix(in srgb, var(--btn-content) 58%, transparent); font-size: .75rem; } button { border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .45rem; padding: .4rem .62rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .78rem; cursor: pointer; } button:disabled { cursor: not-allowed; opacity: .5; } .primary { border-color: var(--primary); color: white; background: var(--primary); } .danger,.error { color: #c74747; } .success { color: #27845f; font-size: .75rem; } details { font-size: .78rem; } summary { cursor: pointer; color: color-mix(in srgb, var(--btn-content) 65%, transparent); } .properties { display: grid; grid-template-columns: repeat(2, 1fr); gap: .6rem; padding: .65rem 0; } label { display: grid; gap: .25rem; } label.wide { grid-column: 1 / -1; } input, textarea { border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .4rem; padding: .5rem .6rem; color: inherit; background: var(--card-bg); font: inherit; } .advanced textarea { width: 100%; margin-top: .4rem; font-family: var(--font-jetbrains-mono), monospace; } .toolbar { position: sticky; top: 4.5rem; z-index: 20; display: flex; gap: .25rem; overflow-x: auto; margin: 0 -.2rem .8rem; border-block: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); padding: .45rem .2rem; background: color-mix(in srgb, var(--card-bg) 94%, transparent); backdrop-filter: blur(10px); } .toolbar button { flex: 0 0 auto; min-width: 2.1rem; } .editor-shell { display: grid; grid-template-columns: minmax(0, 1fr) 12rem; gap: 1rem; } .paper { min-height: 28rem; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: .5rem; padding: clamp(1rem, 3vw, 2.25rem); background: var(--card-bg); box-shadow: 0 .4rem 1.4rem rgb(0 0 0 / .05); } .tiptap-host :global(.ProseMirror) { min-height: 30rem; outline: none; line-height: 1.75; } .tiptap-host :global(.ProseMirror h1), .tiptap-host :global(.ProseMirror h2), .tiptap-host :global(.ProseMirror h3) { scroll-margin-top: 8rem; } .tiptap-host :global(.ProseMirror pre) { overflow-x: auto; border-radius: .4rem; padding: .8rem; background: color-mix(in srgb, var(--btn-content) 8%, var(--card-bg)); } .tiptap-host :global(.ProseMirror table) { display: block; max-width: 100%; overflow-x: auto; } .source-note { margin-top: 0; color: color-mix(in srgb, var(--btn-content) 65%, transparent); font-size: .8rem; } .source-editor { display: block; width: 100%; min-height: 30rem; resize: vertical; font-family: var(--font-jetbrains-mono), monospace; font-size: .86rem; line-height: 1.65; } .outline { position: sticky; top: 8rem; align-self: start; max-height: 60vh; overflow-y: auto; border-left: 1px solid color-mix(in srgb, var(--btn-content) 13%, transparent); padding-left: .7rem; } .outline h2 { margin: 0 0 .5rem; font-size: .85rem; } .outline button { display: block; width: 100%; border: 0; padding: .3rem 0; text-align: left; background: transparent; font-size: .75rem; } .outline button.indent { padding-left: .65rem; }
 @media (max-width: 760px) { .editor-shell { display: block; } .outline { display: none; } .properties { grid-template-columns: 1fr; } label.wide { grid-column: auto; } .toolbar { top: 3.7rem; } }
 :global(html.study-editor-active .article-reading-body), :global(html.study-editor-active .post-view-header), :global(html.study-editor-active .post-view-title), :global(html.study-editor-active .post-view-metadata), :global(html.study-editor-active #post-cover) { display: none !important; }
</style>
