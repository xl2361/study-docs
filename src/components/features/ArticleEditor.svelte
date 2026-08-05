<script lang="ts">
import type { Editor } from "@tiptap/core";
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

let editorOpen = false;
let editing = false;
let loading = false;
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
let markedForDeletion = false;
let dirty = false;
let bodyDirty = false;
let loaded = false;
let hasDraft = false;
let autoOpened = false;
let container: HTMLElement | null = null;
let body: HTMLElement | null = null;
let editor: Editor | null = null;
let editorMount: HTMLElement | null = null;
let editorReady = false;
let ssrBodyDisplay = "";
let categorySnapshot = "";
let tagsSnapshot = "";
let editableNodes: HTMLElement[] = [];
let editorLoadId = 0;
const editModeKey = "study-edit-mode";
const draftsKey = "study-edit-drafts";

onMount(() => {
	const setEditMode = async (enabled: boolean) => {
		if (enabled && !autoOpened) {
			editing = true;
			autoOpened = true;
			await openEditor();
		} else if (!enabled) {
			if (!closeEditor()) return;
			editing = false;
			autoOpened = false;
		}
	};

	void setEditMode(sessionStorage.getItem(editModeKey) === "1");
	const handleModeChange = (event: Event) => {
		void setEditMode(
			Boolean((event as CustomEvent<{ editing?: boolean }>).detail?.editing),
		);
	};
	const handleOpen = () => {
		editing = true;
		void openEditor();
	};
	const handleFlush = (event: Event) => {
		const detail = (event as CustomEvent<{ success: boolean }>).detail;
		if (dirty) detail.success = saveArticle();
	};
	const saveBeforeLeaving = () => {
		if (dirty) saveArticle();
	};
	const saveBeforeNavigation = (event: MouseEvent) => {
		if (!dirty || !(event.target instanceof Element)) return;
		if (!event.target.closest("a[href]")) return;
		if (!saveArticle()) event.preventDefault();
	};
	window.addEventListener("study-edit-mode-change", handleModeChange);
	window.addEventListener("study-article-editor-open", handleOpen);
	window.addEventListener("study-article-editor-flush", handleFlush);
	window.addEventListener("beforeunload", saveBeforeLeaving);
	document.addEventListener("click", saveBeforeNavigation, true);
	return () => {
		window.removeEventListener("study-edit-mode-change", handleModeChange);
		window.removeEventListener("study-article-editor-open", handleOpen);
		window.removeEventListener("study-article-editor-flush", handleFlush);
		window.removeEventListener("beforeunload", saveBeforeLeaving);
		document.removeEventListener("click", saveBeforeNavigation, true);
		if (dirty) saveArticle();
		disableInlineEditing();
	};
});

function decodeYamlScalar(value: string) {
	const trimmed = value.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		try {
			return JSON.parse(trimmed) as string;
		} catch {
			return trimmed.slice(1, -1);
		}
	}
	if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
		return trimmed.slice(1, -1).replace(/''/g, "'");
	}
	return trimmed;
}

function splitYamlList(value: string) {
	const source = value.trim().replace(/^\[/, "").replace(/\]$/, "");
	const values: string[] = [];
	let item = "";
	let quote = "";
	for (const character of source) {
		if (
			(character === '"' || character === "'") &&
			(!quote || quote === character)
		) {
			quote = quote ? "" : character;
			item += character;
		} else if (character === "," && !quote) {
			if (item.trim()) values.push(decodeYamlScalar(item));
			item = "";
		} else item += character;
	}
	if (item.trim()) values.push(decodeYamlScalar(item));
	return values;
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

function readFrontmatterField(lines: string[], key: string) {
	const range = fieldRange(lines, key);
	return range
		? lines[range[0]].replace(new RegExp(`^${key}\\s*:\\s*`), "")
		: "";
}

function readTags(lines: string[]) {
	const range = fieldRange(lines, "tags");
	if (!range) return "";
	const inline = readFrontmatterField(lines, "tags").trim();
	if (inline) return splitYamlList(inline).join(", ");
	return lines
		.slice(range[0] + 1, range[1])
		.map((line) => line.match(/^\s*-\s*(.+)$/)?.[1])
		.filter((value): value is string => Boolean(value))
		.map(decodeYamlScalar)
		.join(", ");
}

function parseArticle(source: string) {
	const normalized = source.replace(/\r\n?/g, "\n");
	const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	const lines = match ? match[1].split("\n") : [];
	frontmatterSource = lines.join("\n");
	originalBody = match ? normalized.slice(match[0].length) : normalized;
	articleTitle =
		decodeYamlScalar(readFrontmatterField(lines, "title")) || title;
	published = decodeYamlScalar(readFrontmatterField(lines, "published"));
	category = decodeYamlScalar(readFrontmatterField(lines, "category"));
	tags = readTags(lines);
}

function setFrontmatterField(lines: string[], key: string, value: string) {
	const range = fieldRange(lines, key);
	const replacement = `${key}: ${value}`;
	if (range) lines.splice(range[0], range[1] - range[0], replacement);
	else lines.push(replacement);
}

function buildArticle(markdownBody: string) {
	const lines = frontmatterSource.replace(/\r\n?/g, "\n").split("\n");
	setFrontmatterField(lines, "title", JSON.stringify(articleTitle.trim()));
	setFrontmatterField(lines, "published", published.trim());
	setFrontmatterField(lines, "category", JSON.stringify(category.trim()));
	setFrontmatterField(
		lines,
		"tags",
		JSON.stringify(
			tags
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	);
	return `---\n${lines.join("\n")}\n---\n\n${markdownBody.replace(/^\n+/, "")}`;
}

function readDrafts(): Record<string, Draft> {
	return JSON.parse(sessionStorage.getItem(draftsKey) || "{}") as Record<
		string,
		Draft
	>;
}

function getEditableNodes() {
	container = document.querySelector<HTMLElement>("#post-container");
	if (!container) return null;
	const visibleMeta = [
		...container.querySelectorAll<HTMLElement>("[data-article-meta]"),
	].find((node) => node.offsetParent !== null);
	body = container.querySelector<HTMLElement>(
		".markdown-content:not(.tiptap-mount)",
	);
	const visibleTitle = [
		...container.querySelectorAll<HTMLElement>("[data-article-title]"),
	].find((node) => node.offsetParent !== null);
	return {
		visibleTitle,
		published: visibleMeta?.querySelector<HTMLElement>(
			"[data-article-published]",
		),
		category: visibleMeta?.querySelector<HTMLElement>(
			"[data-article-category]",
		),
		tags: visibleMeta?.querySelector<HTMLElement>("[data-article-tags]"),
	};
}

function setDomValues() {
	const nodes = getEditableNodes();
	if (!nodes) return;
	if (nodes.visibleTitle) nodes.visibleTitle.textContent = articleTitle;
	if (nodes.published) nodes.published.textContent = published;
	if (nodes.category) nodes.category.textContent = category;
	if (nodes.tags) nodes.tags.textContent = tags;
}

function forcePlainTextPaste(event: ClipboardEvent) {
	event.preventDefault();
	document.execCommand(
		"insertText",
		false,
		event.clipboardData?.getData("text/plain") ?? "",
	);
}

function markDirty(_event?: Event) {
	dirty = true;
	savedMessage = "";
}

function preventEditableNavigation(event: Event) {
	if (editorOpen) event.preventDefault();
}

function runFormat(
	action:
		| "undo"
		| "redo"
		| "bold"
		| "italic"
		| "strike"
		| "heading2"
		| "heading3"
		| "bulletList"
		| "orderedList"
		| "blockquote"
		| "codeBlock"
		| "horizontalRule",
) {
	if (!editorReady || !editor) return;
	const chain = editor.chain().focus();
	switch (action) {
		case "undo":
			chain.undo().run();
			break;
		case "redo":
			chain.redo().run();
			break;
		case "bold":
			chain.toggleBold().run();
			break;
		case "italic":
			chain.toggleItalic().run();
			break;
		case "strike":
			chain.toggleStrike().run();
			break;
		case "heading2":
			chain.toggleHeading({ level: 2 }).run();
			break;
		case "heading3":
			chain.toggleHeading({ level: 3 }).run();
			break;
		case "bulletList":
			chain.toggleBulletList().run();
			break;
		case "orderedList":
			chain.toggleOrderedList().run();
			break;
		case "blockquote":
			chain.toggleBlockquote().run();
			break;
		case "codeBlock":
			chain.toggleCodeBlock().run();
			break;
		case "horizontalRule":
			chain.setHorizontalRule().run();
			break;
	}
}

async function createBodyEditor(markdown: string) {
	if (!body || editor || editorMount) return;
	const loadId = ++editorLoadId;
	ssrBodyDisplay = body.style.display;
	editorMount = document.createElement("div");
	editorMount.className = `${body.className} tiptap-mount`;
	editorMount.setAttribute("aria-label", "文章正文编辑器");
	body.insertAdjacentElement("afterend", editorMount);
	body.style.display = "none";
	editorReady = false;
	try {
		const [
			core,
			starterKit,
			markdownExtension,
			tableExtension,
			imageExtension,
		] = await Promise.all([
			import("@tiptap/core"),
			import("@tiptap/starter-kit"),
			import("@tiptap/markdown"),
			import("@tiptap/extension-table"),
			import("@tiptap/extension-image"),
		]);
		if (loadId !== editorLoadId || !editorMount) return;
		editor = new core.Editor({
			element: editorMount,
			extensions: [
				starterKit.default,
				markdownExtension.Markdown,
				tableExtension.TableKit,
				imageExtension.default,
			],
			content: "",
			onUpdate: () => {
				bodyDirty = true;
				markDirty();
			},
		});
		editor.commands.setContent(markdown, {
			contentType: "markdown",
			emitUpdate: false,
			errorOnInvalidContent: true,
		});
		editorReady = true;
	} catch (reason) {
		error = `正文 Markdown 无法载入 Tiptap，已禁止保存：${reason instanceof Error ? reason.message : "包含不支持的语法"}`;
	}
}

function destroyBodyEditor() {
	editorLoadId++;
	editor?.destroy();
	editor = null;
	editorMount?.remove();
	editorMount = null;
	editorReady = false;
	if (body) body.style.display = ssrBodyDisplay;
}

function enableInlineEditing() {
	const nodes = getEditableNodes();
	if (!nodes) {
		error = "未找到文章阅读区域";
		return;
	}
	if (!body) {
		error = "请先解锁文章后再编辑正文";
		return;
	}
	if (!categorySnapshot && nodes.category)
		categorySnapshot = nodes.category.innerHTML;
	if (!tagsSnapshot && nodes.tags) tagsSnapshot = nodes.tags.innerHTML;
	if (!dirty) setDomValues();
	container?.classList.add("article-editing");
	editableNodes = [
		nodes.visibleTitle,
		nodes.published,
		nodes.category,
		nodes.tags,
	].filter((node): node is HTMLElement => Boolean(node));
	for (const node of editableNodes) {
		node.contentEditable = "true";
		node.spellcheck = false;
		node.addEventListener("input", markDirty);
		node.addEventListener("paste", forcePlainTextPaste);
	}
	nodes.category?.addEventListener("click", preventEditableNavigation);
	nodes.tags?.addEventListener("click", preventEditableNavigation);
	void createBodyEditor(originalBody);
}

function disableInlineEditing() {
	const nodes = getEditableNodes();
	for (const node of editableNodes) {
		node.removeEventListener("input", markDirty);
		node.removeEventListener("paste", forcePlainTextPaste);
		node.contentEditable = "false";
		node.removeAttribute("spellcheck");
	}
	nodes?.category?.removeEventListener("click", preventEditableNavigation);
	nodes?.tags?.removeEventListener("click", preventEditableNavigation);
	destroyBodyEditor();
	if (nodes?.category && categorySnapshot)
		nodes.category.innerHTML = categorySnapshot;
	if (nodes?.tags && tagsSnapshot) nodes.tags.innerHTML = tagsSnapshot;
	editableNodes = [];
	container?.classList.remove("article-editing");
}

async function openEditor() {
	if (editorOpen) {
		enableInlineEditing();
		return;
	}
	editorOpen = true;
	error = "";
	await tick();
	if (!loaded) await loadArticle();
	else enableInlineEditing();
}

function closeEditor(): boolean {
	if (dirty && !saveArticle()) return false;
	disableInlineEditing();
	editorOpen = false;
	return true;
}

async function readError(response: Response, fallback: string) {
	try {
		const body = (await response.json()) as {
			error?: string;
			message?: string;
		};
		return body.message || body.error || fallback;
	} catch {
		return fallback;
	}
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
		if (!response.ok)
			throw new Error(await readError(response, "文章读取失败"));
		const article = (await response.json()) as {
			content?: string;
			sha?: string;
			path?: string;
		};
		parseArticle(article.content ?? "");
		sha = article.sha ?? "";
		path = article.path ?? "";

		const drafts = readDrafts();
		const draft = drafts[slug];
		hasDraft = Boolean(draft);
		if (draft) {
			sha = draft.sha || sha;
			path = draft.path || path;
			markedForDeletion = Boolean(draft.delete);
			if (!draft.delete && draft.content) {
				parseArticle(draft.content);
			}
		}
		loaded = true;
		dirty = false;
		bodyDirty = false;
		enableInlineEditing();
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "文章读取失败";
	} finally {
		loading = false;
	}
}

function readDomValues() {
	const nodes = getEditableNodes();
	if (!nodes) throw new Error("未找到文章阅读区域");
	articleTitle = nodes.visibleTitle?.textContent?.trim() || "";
	published = nodes.published?.textContent?.trim() || "";
	category = nodes.category?.textContent?.trim() || "";
	tags = (nodes.tags?.textContent || nodes.tags?.dataset.articleTags || "")
		.split(/[,，]/)
		.map((tag) => tag.trim())
		.filter(Boolean)
		.join(", ");
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

function saveArticle(): boolean {
	error = "";
	savedMessage = "";
	try {
		readDomValues();
		if (!loaded || !sha || !path) throw new Error("文章尚未成功加载，无法保存");
		if (!editor || !editorReady)
			throw new Error("正文编辑器未成功加载，无法保存");
		if (!articleTitle) throw new Error("标题不能为空");
		if (!validDate(published))
			throw new Error("发布日期必须是真实的 YYYY-MM-DD");
		if (/\r|\n/.test(category) || category.length > 50)
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
		const markdownBody = bodyDirty ? editor.getMarkdown() : originalBody;
		const drafts = readDrafts();
		const previous = drafts[slug];
		const savedContent = buildArticle(markdownBody);
		drafts[slug] = {
			slug,
			title: articleTitle,
			content: savedContent,
			sha,
			path,
			previous: previous?.delete ? previous.previous : previous,
		};
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
		originalBody = markdownBody;
		markedForDeletion = false;
		dirty = false;
		bodyDirty = false;
		hasDraft = true;
		savedMessage = "已保存到本轮，点击顶部“更新”后提交";
		return true;
	} catch (reason) {
		error =
			reason instanceof Error ? reason.message : "草稿保存失败，请稍后重试";
		return false;
	}
}

function undoDraft() {
	const drafts = readDrafts();
	if (!drafts[slug]) return;
	const previous = drafts[slug]?.previous;
	if (previous) drafts[slug] = previous;
	else delete drafts[slug];
	if (Object.keys(drafts).length)
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
	else sessionStorage.removeItem(draftsKey);
	location.reload();
}

function deleteArticle() {
	error = "";
	if (!loaded || !sha || !path) {
		error = "文章尚未成功加载，无法删除";
		return;
	}
	if (dirty && !confirm("当前未保存编辑将被删除，仍要继续吗？")) return;
	const drafts = readDrafts();
	if (markedForDeletion) {
		undoDraft();
		return;
	}
	readDomValues();
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
	bodyDirty = false;
	closeEditor();
}
</script>

{#if editing && editorOpen}
	<section class="edit-bar" aria-label="文章原地编辑操作条" aria-busy={loading}>
		<div class="actions">
			<button class="primary" type="button" onclick={saveArticle} disabled={loading || !loaded || !sha || !path || !editorReady}>保存到本轮</button>
			<button type="button" onclick={markedForDeletion ? deleteArticle : undoDraft} disabled={loading || (!markedForDeletion && !hasDraft)}>
				{markedForDeletion ? "撤销删除" : "撤销草稿"}
			</button>
			<button class="danger" type="button" onclick={deleteArticle} disabled={loading || markedForDeletion || !loaded || !sha || !path}>删除</button>
			<button type="button" onclick={closeEditor}>完成</button>
		</div>
		<div class="format-actions" aria-label="正文格式">
			<button type="button" title="撤销" onclick={() => runFormat("undo")} disabled={!editorReady}>↶</button>
			<button type="button" title="重做" onclick={() => runFormat("redo")} disabled={!editorReady}>↷</button>
			<button type="button" title="粗体" onclick={() => runFormat("bold")} disabled={!editorReady}><b>B</b></button>
			<button type="button" title="斜体" onclick={() => runFormat("italic")} disabled={!editorReady}><i>I</i></button>
			<button type="button" title="删除线" onclick={() => runFormat("strike")} disabled={!editorReady}><s>S</s></button>
			<button type="button" title="二级标题" onclick={() => runFormat("heading2")} disabled={!editorReady}>H2</button>
			<button type="button" title="三级标题" onclick={() => runFormat("heading3")} disabled={!editorReady}>H3</button>
			<button type="button" title="无序列表" onclick={() => runFormat("bulletList")} disabled={!editorReady}>• 列表</button>
			<button type="button" title="有序列表" onclick={() => runFormat("orderedList")} disabled={!editorReady}>1. 列表</button>
			<button type="button" title="引用" onclick={() => runFormat("blockquote")} disabled={!editorReady}>❝</button>
			<button type="button" title="代码块" onclick={() => runFormat("codeBlock")} disabled={!editorReady}>{"</>"}</button>
			<button type="button" title="分隔线" onclick={() => runFormat("horizontalRule")} disabled={!editorReady}>—</button>
		</div>
		{#if loading}<span>正在读取文章…</span>{/if}
		{#if error}<span class="error" role="alert">{error}</span>{/if}
		{#if savedMessage}<span class="success">{savedMessage}</span>{/if}
		<details>
			<summary>完整 Frontmatter（高级）</summary>
			<textarea bind:value={frontmatterSource} oninput={markDirty} rows="8" spellcheck="false" disabled={loading}></textarea>
		</details>
	</section>
{/if}

<style>
	.edit-bar {
		position: sticky;
		top: 4.5rem;
		z-index: 30;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		border: 1px solid color-mix(in srgb, var(--btn-content) 14%, transparent);
		border-radius: 0.75rem;
		padding: 0.55rem;
		color: var(--btn-content);
		background: color-mix(in srgb, var(--card-bg) 92%, transparent);
		box-shadow: 0 0.3rem 1.2rem rgb(0 0 0 / 0.08);
		backdrop-filter: blur(10px);
	}
	.actions, .format-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.format-actions { width: 100%; border-top: 1px solid color-mix(in srgb, var(--btn-content) 10%, transparent); padding-top: 0.45rem; }
	.format-actions button { min-width: 2rem; padding-inline: 0.5rem; }
	button { border: 1px solid color-mix(in srgb, var(--btn-content) 14%, transparent); border-radius: 0.55rem; padding: 0.42rem 0.7rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
	button:disabled { cursor: not-allowed; opacity: 0.55; }
	button.primary { border-color: var(--primary); color: white; background: var(--primary); }
	button.danger, .error { color: #d84b4b; }
	.success { color: #27845f; }
	.edit-bar > span { font-size: 0.75rem; }
	details { width: 100%; font-size: 0.75rem; }
	summary { cursor: pointer; color: color-mix(in srgb, var(--btn-content) 65%, transparent); }
	textarea { width: 100%; margin-top: 0.5rem; border: 1px solid color-mix(in srgb, var(--btn-content) 14%, transparent); border-radius: 0.55rem; padding: 0.65rem; resize: vertical; color: inherit; background: var(--card-bg); font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: 0.75rem; line-height: 1.5; }
	:global(#post-container.article-editing [contenteditable="true"]) { outline: 1px dashed color-mix(in srgb, var(--primary) 48%, transparent); outline-offset: 0.2rem; }
	:global(#post-container.article-editing [contenteditable="true"]:focus) { outline: 2px solid color-mix(in srgb, var(--primary) 55%, transparent); }
	:global(.tiptap-mount) { width: 100%; }
	:global(.tiptap-mount .tiptap.ProseMirror) { min-height: 16rem; outline: 1px dashed color-mix(in srgb, var(--primary) 38%, transparent); outline-offset: 0.35rem; }
	:global(.tiptap-mount .tiptap.ProseMirror:focus) { outline: 2px solid color-mix(in srgb, var(--primary) 50%, transparent); }
	:global(.tiptap-mount .tiptap.ProseMirror pre) { overflow-x: auto; border-radius: 0.65rem; padding: 0.9rem 1rem; background: color-mix(in srgb, var(--btn-content) 9%, var(--card-bg)); }
	:global(.tiptap-mount .tiptap.ProseMirror code) { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
	:global(.tiptap-mount .tiptap.ProseMirror table) { display: block; max-width: 100%; overflow-x: auto; }
	@media (max-width: 767px) { .edit-bar { top: 3.75rem; max-height: 48vh; overflow-y: auto; } .format-actions { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 0.15rem; } .format-actions button { flex: 0 0 auto; } }
</style>
