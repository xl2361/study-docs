<script lang="ts">
import { onMount, tick } from "svelte";

export let slug: string;
export let title: string;

type PreviewBlock =
	| { type: "heading"; level: number; text: string }
	| { type: "paragraph"; text: string }
	| { type: "quote"; text: string }
	| { type: "list"; ordered: boolean; items: string[] }
	| { type: "code"; language: string; text: string }
	| { type: "rule" };

type Draft = {
	slug: string;
	title: string;
	content: string;
	sha: string;
	path: string;
};

let dialog: HTMLDialogElement;
let content = "";
let sha = "";
let path = "";
let loading = false;
let error = "";
let editing = false;
let mobilePanel: "edit" | "preview" = "edit";
let previousBodyOverflow = "";
const editModeKey = "study-edit-mode";
const draftsKey = "study-edit-drafts";

$: previewBlocks = parseMarkdown(content);
$: characterCount = content.length;

onMount(() => {
	editing = sessionStorage.getItem(editModeKey) === "1";
	const handleModeChange = (event: Event) => {
		editing = Boolean(
			(event as CustomEvent<{ editing?: boolean }>).detail?.editing,
		);
		if (!editing && dialog?.open) closeEditor();
	};
	window.addEventListener("study-edit-mode-change", handleModeChange);
	return () => {
		window.removeEventListener("study-edit-mode-change", handleModeChange);
		unlockPage();
	};
});

function parseMarkdown(source: string): PreviewBlock[] {
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	const blocks: PreviewBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];
		if (!line.trim()) {
			index++;
			continue;
		}

		const fence = line.match(/^\s*```\s*([^\s`]*)/);
		if (fence) {
			const code: string[] = [];
			index++;
			while (index < lines.length && !/^\s*```/.test(lines[index])) {
				code.push(lines[index]);
				index++;
			}
			if (index < lines.length) index++;
			blocks.push({
				type: "code",
				language: fence[1] || "text",
				text: code.join("\n"),
			});
			continue;
		}

		const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
		if (heading) {
			blocks.push({
				type: "heading",
				level: heading[1].length,
				text: heading[2].replace(/\s+#+\s*$/, ""),
			});
			index++;
			continue;
		}

		if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
			blocks.push({ type: "rule" });
			index++;
			continue;
		}

		const listItem = line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
		if (listItem) {
			const ordered = Boolean(listItem[2]);
			const items: string[] = [];
			while (index < lines.length) {
				const item = lines[index].match(
					ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/,
				);
				if (!item) break;
				items.push(item[1]);
				index++;
			}
			blocks.push({ type: "list", ordered, items });
			continue;
		}

		const quote = line.match(/^\s*>\s?(.*)$/);
		if (quote) {
			const quoteLines: string[] = [];
			while (index < lines.length) {
				const part = lines[index].match(/^\s*>\s?(.*)$/);
				if (!part) break;
				quoteLines.push(part[1]);
				index++;
			}
			blocks.push({ type: "quote", text: quoteLines.join("\n") });
			continue;
		}

		const paragraph: string[] = [line.trim()];
		index++;
		while (
			index < lines.length &&
			lines[index].trim() &&
			!/^\s*(?:#{1,6}\s+|```|>|(?:[-*_]\s*){3,}$|[-+*]\s+|\d+[.)]\s+)/.test(
				lines[index],
			)
		) {
			paragraph.push(lines[index].trim());
			index++;
		}
		blocks.push({ type: "paragraph", text: paragraph.join(" ") });
	}

	return blocks;
}

async function openEditor() {
	error = "";
	dialog.showModal();
	previousBodyOverflow = document.body.style.overflow;
	document.body.style.overflow = "hidden";
	await tick();
	await loadArticle();
}

function closeEditor() {
	dialog.close();
	unlockPage();
}

function unlockPage() {
	document.body.style.overflow = previousBodyOverflow;
}

function handleCancel(event: Event) {
	void event;
	unlockPage();
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
	error = "";
	try {
		const drafts = readDrafts();
		if (drafts[slug]) {
			({ content, sha, path } = drafts[slug]);
			return;
		}
		const response = await fetch(
			`/api/editor/article?slug=${encodeURIComponent(slug)}`,
		);
		if (response.status === 401) {
			redirectToLogin();
			return;
		}
		if (!response.ok)
			throw new Error(await readError(response, "文章读取失败"));
		const article = (await response.json()) as {
			content?: string;
			sha?: string;
			path?: string;
		};
		content = article.content ?? "";
		sha = article.sha ?? "";
		path = article.path ?? "";
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "文章读取失败";
	} finally {
		loading = false;
	}
}

function readDrafts(): Record<string, Draft> {
	try {
		return JSON.parse(sessionStorage.getItem(draftsKey) || "{}") as Record<
			string,
			Draft
		>;
	} catch {
		return {};
	}
}

function saveArticle() {
	error = "";
	try {
		const drafts = readDrafts();
		drafts[slug] = { slug, title, content, sha, path };
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
		closeEditor();
	} catch (reason) {
		error =
			reason instanceof Error ? reason.message : "草稿保存失败，请稍后重试";
	}
}

function redirectToLogin() {
	location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
}
</script>

{#if editing}
	<div class="editor-entry">
		<button class="launch-button" type="button" onclick={openEditor} aria-haspopup="dialog">
			<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25Zm15.71-10.42a1 1 0 0 0 0-1.42l-1.12-1.12a1 1 0 0 0-1.42 0l-.88.88 2.75 2.75.67-.67Z" /></svg>
			<span>编辑本文</span>
		</button>
	</div>

	<dialog
	bind:this={dialog}
	class="editor-dialog"
	aria-labelledby="article-editor-title"
	oncancel={handleCancel}
	onclose={unlockPage}
>
	<div class="dialog-shell">
		<header class="editor-header">
			<div class="title-group">
				<span class="eyebrow">ARTICLE STUDIO</span>
				<h2 id="article-editor-title">{title}</h2>
				{#if path}<p>{path}</p>{/if}
			</div>
			<button class="icon-button" type="button" onclick={closeEditor} aria-label="关闭编辑器">
				<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg>
			</button>
		</header>

		<div class="editor-toolbar">
				<div class="mobile-tabs" aria-label="编辑器视图">
					<button class:active={mobilePanel === "edit"} type="button" onclick={() => (mobilePanel = "edit")}>编辑</button>
					<button class:active={mobilePanel === "preview"} type="button" onclick={() => (mobilePanel = "preview")}>预览</button>
				</div>
				<div class="document-meta" aria-live="polite">
					<span>{characterCount.toLocaleString()} 字符</span>
					{#if error}<span class="error" role="alert">● {error}</span>{/if}
				</div>
				<div class="toolbar-actions">
					<button class="secondary-button" type="button" onclick={loadArticle} disabled={loading}>重新读取</button>
					<button class="primary-button" type="button" onclick={saveArticle} disabled={loading}>
						保存到本轮
					</button>
				</div>
			</div>

			<div class="workspace" class:show-preview={mobilePanel === "preview"} aria-busy={loading}>
				<section class="edit-pane" aria-label="Markdown 编辑区">
					<div class="pane-label"><span>MARKDOWN</span><span>UTF-8</span></div>
					<textarea bind:value={content} aria-label={`编辑《${title}》的 Markdown 内容`} spellcheck="false" disabled={loading}></textarea>
					{#if loading}<div class="loading-layer">正在读取文章…</div>{/if}
				</section>
				<section class="preview-pane" aria-label="文章预览">
					<div class="pane-label"><span>PREVIEW</span><span>安全渲染</span></div>
					<article class="markdown-preview">
						{#if previewBlocks.length === 0}
							<p class="empty-preview">开始输入后，预览会出现在这里。</p>
						{/if}
						{#each previewBlocks as block}
							{#if block.type === "heading"}
								{#if block.level === 1}<h1>{block.text}</h1>
								{:else if block.level === 2}<h2>{block.text}</h2>
								{:else if block.level === 3}<h3>{block.text}</h3>
								{:else}<h4>{block.text}</h4>{/if}
							{:else if block.type === "paragraph"}
								<p>{block.text}</p>
							{:else if block.type === "quote"}
								<blockquote>{block.text}</blockquote>
							{:else if block.type === "list"}
								{#if block.ordered}<ol>{#each block.items as item}<li>{item}</li>{/each}</ol>
								{:else}<ul>{#each block.items as item}<li>{item}</li>{/each}</ul>{/if}
							{:else if block.type === "code"}
								<div class="code-block"><span>{block.language}</span><pre><code>{block.text}</code></pre></div>
							{:else}<hr />{/if}
						{/each}
					</article>
				</section>
			</div>
	</div>
</dialog>
{/if}

<style>
	.editor-entry { display: flex; justify-content: flex-end; margin: -.25rem 0 1rem; }
	button, textarea { font: inherit; }
	button { cursor: pointer; }
	button:disabled { cursor: not-allowed; opacity: .55; }
	.launch-button { display: inline-flex; align-items: center; gap: .42rem; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: 999px; padding: .42rem .72rem; color: color-mix(in srgb, var(--btn-content) 62%, transparent); background: color-mix(in srgb, var(--btn-regular-bg) 78%, transparent); font-size: .76rem; font-weight: 600; transition: color .2s, border-color .2s, background .2s, transform .2s; }
	.launch-button:hover { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 38%, transparent); background: color-mix(in srgb, var(--primary) 9%, var(--card-bg)); transform: translateY(-1px); }
	.launch-button:focus-visible, button:focus-visible, textarea:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
	.launch-button svg { width: .95rem; height: .95rem; fill: currentColor; }
	.editor-dialog { width: min(96vw, 1500px); max-width: none; height: min(92dvh, 980px); max-height: none; padding: 0; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: calc(var(--radius-large) + .25rem); color: var(--btn-content); background: var(--card-bg); box-shadow: 0 28px 90px rgb(0 0 0 / .28); overflow: hidden; }
	.editor-dialog::backdrop { background: rgb(10 15 24 / .66); backdrop-filter: blur(10px); }
	.dialog-shell { height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 12% -20%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 36%), var(--card-bg); }
	.editor-header { min-height: 5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1.25rem; border-bottom: 1px solid color-mix(in srgb, var(--btn-content) 10%, transparent); }
	.title-group { min-width: 0; }
	.eyebrow, .pane-label { color: var(--primary); font-size: .65rem; font-weight: 800; letter-spacing: .15em; }
	.title-group h2 { margin: .14rem 0 0; overflow: hidden; color: color-mix(in srgb, var(--btn-content) 92%, transparent); font-size: clamp(1rem, 2vw, 1.28rem); font-weight: 750; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
	.title-group p { margin: .18rem 0 0; color: color-mix(in srgb, var(--btn-content) 48%, transparent); font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: .7rem; }
	.icon-button { width: 2.5rem; height: 2.5rem; flex: 0 0 auto; display: grid; place-items: center; border: 0; border-radius: 50%; color: inherit; background: var(--btn-regular-bg); transition: background .2s, transform .2s; }
	.icon-button:hover { background: var(--btn-regular-bg-hover); transform: rotate(4deg); }
	.icon-button svg { width: 1.25rem; height: 1.25rem; fill: currentColor; }
	.primary-button, .secondary-button { min-height: 2.55rem; border-radius: .72rem; padding: .58rem 1rem; font-size: .8rem; font-weight: 750; transition: transform .16s, background .16s; }
	.primary-button { border: 1px solid var(--primary); color: white; background: var(--primary); }
	:global(.dark) .primary-button { color: rgb(0 0 0 / .75); }
	.primary-button:not(:disabled):hover, .secondary-button:not(:disabled):hover { transform: translateY(-1px); }
	.secondary-button { border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); color: inherit; background: var(--btn-regular-bg); }
	.error { color: #e05252 !important; }
	.success { color: #2d9b70; }
	.editor-toolbar { min-height: 3.65rem; display: flex; align-items: center; gap: 1rem; padding: .58rem 1rem; border-bottom: 1px solid color-mix(in srgb, var(--btn-content) 10%, transparent); }
	.mobile-tabs { display: none; }
	.document-meta { min-width: 0; display: flex; align-items: center; gap: .8rem; flex: 1; color: color-mix(in srgb, var(--btn-content) 48%, transparent); font-size: .72rem; }
	.document-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.toolbar-actions { display: flex; gap: .5rem; }
	.workspace { min-height: 0; flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
	.edit-pane, .preview-pane { min-width: 0; min-height: 0; position: relative; display: flex; flex-direction: column; }
	.edit-pane { border-right: 1px solid color-mix(in srgb, var(--btn-content) 10%, transparent); }
	.pane-label { height: 2.25rem; flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 0 1.1rem; border-bottom: 1px solid color-mix(in srgb, var(--btn-content) 8%, transparent); background: color-mix(in srgb, var(--btn-regular-bg) 45%, transparent); }
	.pane-label span:last-child { color: color-mix(in srgb, var(--btn-content) 38%, transparent); letter-spacing: .06em; }
	textarea { width: 100%; min-height: 0; flex: 1; resize: none; border: 0; padding: 1.35rem clamp(1rem, 2.3vw, 2rem); outline: 0; color: color-mix(in srgb, var(--btn-content) 88%, transparent); background: transparent; font-family: var(--font-jetbrains-mono), "Cascadia Code", ui-monospace, monospace; font-size: .86rem; line-height: 1.75; tab-size: 2; }
	textarea:focus-visible { outline: 2px solid color-mix(in srgb, var(--primary) 60%, transparent); outline-offset: -2px; }
	.loading-layer { position: absolute; inset: 2.25rem 0 0; display: grid; place-items: center; color: var(--primary); background: color-mix(in srgb, var(--card-bg) 82%, transparent); backdrop-filter: blur(3px); font-size: .82rem; font-weight: 700; }
	.preview-pane { overflow: hidden; background: color-mix(in srgb, var(--btn-regular-bg) 20%, transparent); }
	.markdown-preview { overflow: auto; flex: 1; padding: 1.4rem clamp(1.1rem, 3vw, 2.8rem) 4rem; color: color-mix(in srgb, var(--btn-content) 84%, transparent); font-size: .92rem; line-height: 1.8; }
	.markdown-preview h1, .markdown-preview h2, .markdown-preview h3, .markdown-preview h4 { color: color-mix(in srgb, var(--btn-content) 95%, transparent); font-weight: 760; line-height: 1.3; }
	.markdown-preview h1 { margin: .2rem 0 1.4rem; font-size: 2rem; }
	.markdown-preview h2 { margin: 2rem 0 .8rem; padding-bottom: .45rem; border-bottom: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); font-size: 1.5rem; }
	.markdown-preview h3 { margin: 1.5rem 0 .55rem; font-size: 1.2rem; }
	.markdown-preview h4 { margin: 1.3rem 0 .45rem; font-size: 1rem; }
	.markdown-preview p { margin: .65rem 0; white-space: pre-wrap; }
	.markdown-preview blockquote { margin: 1rem 0; border-left: 3px solid var(--primary); padding: .65rem 1rem; border-radius: 0 .6rem .6rem 0; color: color-mix(in srgb, var(--btn-content) 68%, transparent); background: color-mix(in srgb, var(--primary) 8%, transparent); white-space: pre-wrap; }
	.markdown-preview ul, .markdown-preview ol { margin: .8rem 0; padding-left: 1.4rem; }
	.markdown-preview ul { list-style: disc; }
	.markdown-preview ol { list-style: decimal; }
	.markdown-preview hr { margin: 2rem 0; border: 0; border-top: 1px dashed color-mix(in srgb, var(--btn-content) 20%, transparent); }
	.code-block { margin: 1rem 0; overflow: hidden; border: 1px solid color-mix(in srgb, var(--btn-content) 10%, transparent); border-radius: .8rem; background: color-mix(in srgb, var(--btn-regular-bg) 75%, transparent); }
	.code-block > span { display: block; padding: .35rem .8rem; border-bottom: 1px solid color-mix(in srgb, var(--btn-content) 8%, transparent); color: var(--primary); font-size: .64rem; font-weight: 800; text-transform: uppercase; }
	.code-block pre { overflow: auto; margin: 0; padding: 1rem; font-size: .78rem; line-height: 1.65; }
	.empty-preview { color: color-mix(in srgb, var(--btn-content) 40%, transparent); }

	@media (max-width: 767px) {
		.editor-entry { margin-top: -.1rem; }
		.editor-dialog { width: 100vw; height: 100dvh; border: 0; border-radius: 0; }
		.editor-header { min-height: 4.4rem; padding: .7rem .85rem; }
		.title-group .eyebrow, .title-group p { display: none; }
		.editor-toolbar { min-height: auto; flex-wrap: wrap; gap: .55rem; padding: .55rem .7rem; }
		.mobile-tabs { display: grid; grid-template-columns: 1fr 1fr; order: 1; width: 10rem; padding: .2rem; border-radius: .65rem; background: var(--btn-regular-bg); }
		.mobile-tabs button { border: 0; border-radius: .48rem; padding: .35rem .6rem; color: color-mix(in srgb, var(--btn-content) 56%, transparent); background: transparent; font-size: .75rem; font-weight: 700; }
		.mobile-tabs button.active { color: var(--primary); background: var(--card-bg); box-shadow: 0 2px 8px rgb(0 0 0 / .08); }
		.document-meta { order: 3; flex-basis: 100%; }
		.toolbar-actions { order: 2; margin-left: auto; }
		.primary-button, .secondary-button { min-height: 2.2rem; padding: .42rem .7rem; }
		.workspace { display: block; position: relative; }
		.edit-pane, .preview-pane { position: absolute; inset: 0; border: 0; }
		.preview-pane { display: none; }
		.workspace.show-preview .edit-pane { display: none; }
		.workspace.show-preview .preview-pane { display: flex; }
	}

	@media (prefers-reduced-motion: reduce) {
		.launch-button, .icon-button, .primary-button, .secondary-button { transition: none; }
	}
</style>
