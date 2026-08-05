<script lang="ts">
import { onMount } from "svelte";

const editModeKey = "study-edit-mode";
const draftsKey = "study-edit-drafts";
const categoryDraftsKey = "study-category-drafts";

let authenticated = false;
let editing = false;
let submitting = false;
let message = "";
let createDialog: HTMLDialogElement;
let newSlug = "";
let newTitle = "";
let newPublished = new Date().toISOString().slice(0, 10);
let newCategory = "";
let newTags = "";
let newContent = "";

function dispatchMode() {
	window.dispatchEvent(
		new CustomEvent("study-edit-mode-change", { detail: { editing } }),
	);
}

function restoreMode() {
	editing = sessionStorage.getItem(editModeKey) === "1";
	dispatchMode();
}

async function checkSession() {
	try {
		const response = await fetch("/api/auth/session");
		authenticated = response.ok;
		if (authenticated) restoreMode();
	} catch {
		authenticated = false;
	}
}

function stopEditing() {
	editing = false;
	sessionStorage.removeItem(editModeKey);
	dispatchMode();
}

function openCreateDialog() {
	message = "";
	createDialog.showModal();
}

function saveNewArticle() {
	const slug = newSlug.trim().replace(/\.md$/i, "");
	const title = newTitle.trim();
	if (!slug || !title || !newPublished) {
		message = "新文章的文件名、标题和发布日期不能为空";
		return;
	}
	if (!/^[^\\/\0\r\n]+$/.test(slug)) {
		message = "文件名不能包含路径分隔符或换行";
		return;
	}
	const tags = newTags
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
	const content = `---\ntitle: ${JSON.stringify(title)}\npublished: ${newPublished}\ncategory: ${JSON.stringify(newCategory.trim())}\ntags: ${JSON.stringify(tags)}\n---\n\n${newContent.replace(/^\n+/, "")}`;
	try {
		const drafts = JSON.parse(
			sessionStorage.getItem(draftsKey) || "{}",
		) as Record<string, unknown>;
		if (Object.hasOwn(drafts, slug)) {
			message = "本轮已有同名文章草稿，请更换文件名";
			return;
		}
		drafts[slug] = {
			slug,
			title,
			content,
			create: true,
		};
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
		createDialog.close();
		newSlug = "";
		newTitle = "";
		newPublished = new Date().toISOString().slice(0, 10);
		newCategory = "";
		newTags = "";
		newContent = "";
		message = "新文章已保存到本轮，点击更新后提交";
	} catch (reason) {
		message = reason instanceof Error ? reason.message : "新文章草稿保存失败";
	}
}

async function toggleEditing() {
	message = "";
	if (!editing) {
		editing = true;
		sessionStorage.setItem(editModeKey, "1");
		dispatchMode();
		return;
	}

	let drafts: Record<string, unknown> = {};
	let categoryRenames: Record<string, string> = {};
	try {
		drafts = JSON.parse(sessionStorage.getItem(draftsKey) || "{}") as Record<
			string,
			unknown
		>;
		categoryRenames = JSON.parse(
			sessionStorage.getItem(categoryDraftsKey) || "{}",
		) as Record<string, string>;
	} catch {
		message = "草稿数据损坏，请重新保存编辑内容";
		return;
	}

	const articles = Object.values(drafts);
	if (articles.length === 0 && Object.keys(categoryRenames).length === 0) {
		stopEditing();
		return;
	}

	submitting = true;
	try {
		const response = await fetch("/api/editor/articles", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ articles, categoryRenames }),
		});
		if (response.status === 401) {
			location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
			return;
		}
		if (!response.ok) {
			let errorMessage = "提交失败，请稍后重试";
			try {
				const body = (await response.json()) as { message?: string };
				errorMessage = body.message || errorMessage;
			} catch {
				// 非 JSON 错误响应使用默认提示。
			}
			throw new Error(errorMessage);
		}
		sessionStorage.removeItem(draftsKey);
		sessionStorage.removeItem(categoryDraftsKey);
		stopEditing();
		message = "已提交，等待网站重新部署";
	} catch (reason) {
		message = reason instanceof Error ? reason.message : "提交失败，请稍后重试";
	} finally {
		submitting = false;
	}
}

async function logout() {
	await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
	localStorage.removeItem("study-auth-recovery");
	location.href = "/login/";
}

onMount(() => {
	void checkSession();
	const resendMode = () => {
		if (authenticated) restoreMode();
	};
	document.addEventListener("swup:page:view", resendMode);
	return () => document.removeEventListener("swup:page:view", resendMode);
});
</script>

{#if authenticated}
	<div class="global-editor" aria-live="polite">
		{#if editing}<button class="create" type="button" onclick={openCreateDialog}>新建</button>{/if}
		{#if editing}<button class="continue" type="button" onclick={() => window.dispatchEvent(new CustomEvent("study-article-editor-open"))}>继续</button>{/if}
		<button class="edit-toggle" class:editing type="button" onclick={toggleEditing} disabled={submitting}>
			{submitting ? "提交中…" : editing ? "更新" : "编辑"}
		</button>
		<button class="logout" type="button" onclick={logout} aria-label="退出登录" title="退出登录">
			退出
		</button>
		{#if message}<span class:error={editing}>{message}</span>{/if}
	</div>
	<dialog bind:this={createDialog} class="create-dialog">
		<form method="dialog" onsubmit={(event) => { event.preventDefault(); saveNewArticle(); }}>
			<header><h2>新建文章</h2><button class="close" type="button" onclick={() => createDialog.close()} aria-label="关闭">×</button></header>
			<div class="fields">
				<label><b>文件名</b><input bind:value={newSlug} placeholder="例如：如何写一个接口" required /></label>
				<label><b>标题</b><input bind:value={newTitle} required /></label>
				<label><b>发布日期</b><input bind:value={newPublished} type="date" required /></label>
				<label><b>分类</b><input bind:value={newCategory} /></label>
				<label class="wide"><b>标签（逗号分隔）</b><input bind:value={newTags} /></label>
				<label class="wide"><b>正文（Markdown）</b><textarea bind:value={newContent} rows="12" placeholder="## 第一个目录"></textarea></label>
			</div>
			<footer><button type="button" onclick={() => createDialog.close()}>取消</button><button class="save" type="submit">保存到本轮</button></footer>
		</form>
	</dialog>
{/if}

<style>
	.global-editor { position: relative; display: flex; align-items: center; gap: .3rem; margin-right: .25rem; }
	button { height: 2.25rem; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: .7rem; padding: 0 .7rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .75rem; font-weight: 750; cursor: pointer; transition: transform .16s, border-color .16s, background .16s; }
	button:hover { border-color: color-mix(in srgb, var(--primary) 45%, transparent); transform: translateY(-1px); }
	.edit-toggle { border-color: var(--primary); color: white; background: var(--primary); }
	button.editing { color: white; }
	button:disabled { cursor: wait; opacity: .65; }
	.create { color: var(--primary); }
	.continue { color: var(--primary); }
	.logout { padding: 0 .5rem; color: color-mix(in srgb, var(--btn-content) 58%, transparent); }
	span { position: absolute; top: calc(100% + .4rem); right: 0; width: max-content; max-width: min(22rem, 80vw); border: 1px solid color-mix(in srgb, #2d9b70 24%, transparent); border-radius: .55rem; padding: .4rem .6rem; color: #23845e; background: var(--card-bg); box-shadow: 0 8px 24px rgb(0 0 0 / .12); font-size: .7rem; }
	span.error { color: #c74747; border-color: color-mix(in srgb, #e05252 25%, transparent); }
	.create-dialog { width: min(92vw, 48rem); max-width: none; border: 1px solid color-mix(in srgb, var(--btn-content) 14%, transparent); border-radius: 1rem; padding: 0; color: var(--btn-content); background: var(--card-bg); box-shadow: 0 28px 80px rgb(0 0 0 / .3); }
	.create-dialog::backdrop { background: rgb(10 15 24 / .65); backdrop-filter: blur(6px); }
	.create-dialog form { padding: 1rem; }
	.create-dialog header, .create-dialog footer { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
	.create-dialog h2 { margin: 0; font-size: 1.15rem; }
	.create-dialog .close { border: 0; padding: 0; width: 2rem; font-size: 1.4rem; background: transparent; }
	.fields { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin: 1rem 0; }
	.fields label { display: grid; gap: .35rem; font-size: .75rem; }
	.fields b { font-weight: 700; }
	.fields input, .fields textarea { width: 100%; border: 1px solid color-mix(in srgb, var(--btn-content) 15%, transparent); border-radius: .65rem; padding: .65rem .75rem; color: inherit; background: var(--btn-regular-bg); font: inherit; }
	.fields textarea { resize: vertical; font-family: var(--font-jetbrains-mono), ui-monospace, monospace; line-height: 1.6; }
	.fields .wide { grid-column: 1 / -1; }
	.create-dialog footer { justify-content: flex-end; }
	.create-dialog .save { border-color: var(--primary); color: white; background: var(--primary); }
	@media (max-width: 640px) {
		.global-editor { gap: .2rem; }
		button { height: 2.1rem; padding: 0 .55rem; }
		.create-dialog { width: 100vw; height: 100dvh; border: 0; border-radius: 0; }
		.fields { grid-template-columns: 1fr; }
		.fields .wide { grid-column: auto; }
	}
</style>
