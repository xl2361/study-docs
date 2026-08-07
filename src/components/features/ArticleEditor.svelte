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
	getJSON: () => JsonNode;
	can: () => {
		undo: () => boolean;
		redo: () => boolean;
	};
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
let hasDraft = false;
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
			syncEditorHeadingIds();
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
	requestAnimationFrame(syncEditorHeadingIds);
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

function destroyEditor() {
	editor?.destroy();
	editor = null;
	editorReady = false;
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
		hasDraft = Boolean(draft);
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

async function openEditor() {
	if (opening) return;
	const operation = ++openOperation;
	opening = true;
	try {
		if (!loaded) await loadArticle(operation);
		if (!mounted || operation !== openOperation || !loaded) return;
		const topbar = document.getElementById("editor-topbar");
		if (topbar) topbar.dataset.editorOwner = editorInstanceId;
		editing = true;
		document.documentElement.classList.add("study-editor-active");
		await tick();
		if (!mounted || operation !== openOperation || !editing) return;
		moveTopbar();
		setupInPlace();
		await createEditor(operation);
		if (!mounted || operation !== openOperation || !editing) return;
		hostIntoReadingBody();
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

function syncEditorHeadingIds() {
	if (!editorMount) return;
	import("github-slugger").then((mod) => {
		const Slugger = mod.default;
		const slugger = new Slugger();
		const headings = editorMount?.querySelectorAll<HTMLElement>("h1, h2, h3");
		if (!headings) return;
		headings.forEach((h) => {
			if (h.id) { slugger.slug(h.textContent || ""); return; }
			const text = (h.textContent || "").replace(/#+\s*$/, "").trim();
			if (!text) return;
			h.id = slugger.slug(text);
		});
		if ((window as any).SidebarTOC?.manager) {
			(window as any).SidebarTOC.manager.attach();
		}
	});
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
		hasDraft = true;
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
		!topbar ||
		!topbar.dataset.editorOwner ||
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

function undoDraft() {
	// 撤销本次所有修改：清空本轮草稿并回到编辑前的原始内容
	reverting = true;
	const drafts = readDrafts();
	delete drafts[slug];
	if (Object.keys(drafts).length)
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
	else sessionStorage.removeItem(draftsKey);
	location.reload();
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

function normalizeHeadingText(value: string) {
	return value.replace(/#+\s*$/, "").replace(/\s+/g, " ").trim();
}

function handleEditorTocClick(event: Event) {
	if (!editing || sourceMode) return;
	const eventTarget = event.target as Element | null;
	const tocAnchor = eventTarget?.closest<HTMLAnchorElement>(
		"#sidebar-toc-content a.toc-item",
	);
	if (!tocAnchor) return;

	const editorRoot = document.querySelector<HTMLElement>(
		".article-reading-body-editing .ProseMirror",
	);
	if (!editorRoot) return;

	const headings = Array.from(
		editorRoot.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
	);
	const headingId = decodeURIComponent(
		tocAnchor.getAttribute("href")?.replace(/^#/, "") || "",
	);
	const tocText = normalizeHeadingText(
		tocAnchor.getAttribute("aria-label") || tocAnchor.textContent || "",
	);
	let heading = headings.find((item) => item.id === headingId);
	if (!heading && tocText) {
		heading = headings.find(
			(item) => normalizeHeadingText(item.textContent || "") === tocText,
		);
	}
	if (!heading) {
		const tocItems = Array.from(
			document.querySelectorAll<HTMLAnchorElement>(
				"#sidebar-toc-content a.toc-item",
			),
		);
		const index = tocItems.indexOf(tocAnchor);
		if (index >= 0) heading = headings[index];
	}
	if (!heading) return;

	event.preventDefault();
	event.stopImmediatePropagation();
	const targetTop =
		heading.getBoundingClientRect().top + window.scrollY - 88;
	window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
	window.dispatchEvent(
		new CustomEvent("toc:navigate", {
			detail: {
				contentId: "sidebar-toc-content",
				headingId: headingId || heading.id,
			},
		}),
	);
}

onMount(() => {
	mounted = true;
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
	const onKeydown = (event: KeyboardEvent) => {
		if (!event.ctrlKey && !event.metaKey) return;
		if (event.key.toLowerCase() !== "s") return;
		event.preventDefault();
		if (editing) saveDraft();
	};
	window.addEventListener("study-edit-mode-change", modeChange);
	window.addEventListener("study-article-editor-open", onOpen);
	window.addEventListener("study-article-editor-flush", flush);
	window.addEventListener("beforeunload", beforeUnload);
	window.addEventListener("keydown", onKeydown);
	document.addEventListener("click", handleEditorTocClick, true);
	if (sessionStorage.getItem(editModeKey) === "1") void openEditor();
	emergency = loadEmergency();
	return () => {
		mounted = false;
		openOperation++;
		window.removeEventListener("study-edit-mode-change", modeChange);
		window.removeEventListener("study-article-editor-open", onOpen);
		window.removeEventListener("study-article-editor-flush", flush);
		window.removeEventListener("beforeunload", beforeUnload);
		window.removeEventListener("keydown", onKeydown);
		document.removeEventListener("click", handleEditorTocClick, true);
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
  <nav class="toolbar" bind:this={toolbarEl} aria-label="正文格式"><button title="后退一步" onclick={() => format("undo")} disabled={!editorReady || sourceMode || !canUndo}>↶</button><button title="前进一步" onclick={() => format("redo")} disabled={!editorReady || sourceMode || !canRedo}>↷</button><button title="一级标题" onclick={() => format("h1")} disabled={!editorReady || sourceMode}>H1</button><button title="二级标题" onclick={() => format("h2")} disabled={!editorReady || sourceMode}>H2</button><button title="三级标题" onclick={() => format("h3")} disabled={!editorReady || sourceMode}>H3</button><button title="粗体" onclick={() => format("bold")} disabled={!editorReady || sourceMode}><b>B</b></button><button title="斜体" onclick={() => format("italic")} disabled={!editorReady || sourceMode}><i>I</i></button><button title="删除线" onclick={() => format("strike")} disabled={!editorReady || sourceMode}><s>S</s></button><button title="无序列表" onclick={() => format("bullet")} disabled={!editorReady || sourceMode}>•</button><button title="有序列表" onclick={() => format("ordered")} disabled={!editorReady || sourceMode}>1.</button><button title="引用" onclick={() => format("quote")} disabled={!editorReady || sourceMode}>❝</button><button title="代码块" onclick={() => format("code")} disabled={!editorReady || sourceMode}>{"</>"}</button><button title="分隔线" onclick={() => format("hr")} disabled={!editorReady || sourceMode}>—</button><button class="revert-all" type="button" onclick={undoDraft} disabled={loading || !loaded || (!dirty && !hasDraft)}>撤销草稿</button></nav>
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
 :global(html.study-editor-active .article-reading-body:not(.article-reading-body-editing)) { display: none !important; }
 @media (max-width: 760px) { .toolbar { top: 3.6rem; } }
</style>
