<script lang="ts">
import { onMount } from "svelte";

const editModeKey = "study-edit-mode";
const draftsKey = "study-edit-drafts";
const categoryDraftsKey = "study-category-drafts";
const emergencyKey = "study-edit-emergency";

let authenticated = false;
let editing = false;
let submitting = false;
let message = "";

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

function discard() {
	// 点击“退出”：丢弃本轮全部修改，回到进入编辑模式前的状态
	for (let i = sessionStorage.length - 1; i >= 0; i--) {
		const key = sessionStorage.key(i);
		if (!key?.startsWith(emergencyKey)) continue;
		sessionStorage.removeItem(key);
	}
	sessionStorage.removeItem(draftsKey);
	sessionStorage.removeItem(categoryDraftsKey);
	window.dispatchEvent(new CustomEvent("study-article-editor-revert"));
	stopEditing();
	location.reload();
}

async function toggleEditing() {
	message = "";
	if (!editing) {
		editing = true;
		sessionStorage.setItem(editModeKey, "1");
		dispatchMode();
		return;
	}
	const flushDetail = { success: true };
	window.dispatchEvent(
		new CustomEvent("study-article-editor-flush", { detail: flushDetail }),
	);
	if (!flushDetail.success) {
		message = "当前文章草稿保存失败，请修正后重试";
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
		{#if editing}
			<button class="discard" type="button" onclick={discard} aria-label="退出编辑并放弃本轮修改" title="丢弃本轮全部修改，回到进入编辑前的状态">
				退出
			</button>
		{/if}
		<button class="edit-toggle" class:editing type="button" onclick={toggleEditing} disabled={submitting}>
			{submitting ? "提交中…" : editing ? "更新" : "编辑"}
		</button>
		{#if message}<span class:error={editing}>{message}</span>{/if}
	</div>
{/if}

<style>
	.global-editor { position: relative; display: flex; align-items: center; gap: .3rem; margin-right: .25rem; }
	button { height: 2.25rem; border: 1px solid color-mix(in srgb, var(--btn-content) 12%, transparent); border-radius: .7rem; padding: 0 .7rem; color: inherit; background: var(--btn-regular-bg); font: inherit; font-size: .75rem; font-weight: 750; cursor: pointer; transition: transform .16s, border-color .16s, background .16s; }
	button:hover { border-color: color-mix(in srgb, var(--primary) 45%, transparent); transform: translateY(-1px); }
	.edit-toggle { border-color: var(--primary); color: white; background: var(--primary); }
	button.editing { color: white; }
	button:disabled { cursor: wait; opacity: .65; }
	.discard { padding: 0 .5rem; color: color-mix(in srgb, #c74747 82%, transparent); }
	span { position: absolute; top: calc(100% + .4rem); right: 0; width: max-content; max-width: min(22rem, 80vw); border: 1px solid color-mix(in srgb, #2d9b70 24%, transparent); border-radius: .55rem; padding: .4rem .6rem; color: #23845e; background: var(--card-bg); box-shadow: 0 8px 24px rgb(0 0 0 / .12); font-size: .7rem; }
	span.error { color: #c74747; border-color: color-mix(in srgb, #e05252 25%, transparent); }
	@media (max-width: 640px) {
		.global-editor { gap: .2rem; }
		button { height: 2.1rem; padding: 0 .55rem; }
	}
</style>
