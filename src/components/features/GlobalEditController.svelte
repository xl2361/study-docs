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
// 提交后轮询后台部署，部署完成（页面构建标记变化）时自动刷新
// 超时设为 20 分钟：GitHub Actions 排队 + 构建部署实际常需 12-15 分钟，
// 原 10 分钟会在部署完成前超时导致不自动刷新
const deployPollInterval = 15_000;
const deployPollTimeout = 20 * 60 * 1000;
let deployTimer: ReturnType<typeof setInterval> | null = null;
let deployStopTimer: ReturnType<typeof setTimeout> | null = null;
let deployPendingReload = false;

function initialBuildCommit(): string {
	return (
		document
			.querySelector('meta[name="build-commit"]')
			?.getAttribute("content") || ""
	);
}

function stopDeployWatch(note?: string) {
	if (deployTimer) {
		clearInterval(deployTimer);
		deployTimer = null;
	}
	if (deployStopTimer) {
		clearTimeout(deployStopTimer);
		deployStopTimer = null;
	}
	if (note) message = note;
}

async function checkDeployOnce(baseline: string): Promise<boolean> {
	try {
		const response = await fetch(location.pathname + location.search, {
			cache: "no-store",
		});
		if (!response.ok) return false;
		const html = await response.text();
		const doc = new DOMParser().parseFromString(html, "text/html");
		const marker =
			doc.querySelector('meta[name="build-commit"]')?.getAttribute("content") ||
			"";
		return marker !== "" && marker !== baseline;
	} catch {
		return false;
	}
}

function watchDeploy(commit: unknown) {
	const baseline = initialBuildCommit();
	// 本地构建或拿不到基线标记时不轮询，避免误刷新
	if (!commit || !baseline || deployTimer) return;
	deployPendingReload = false;
	deployTimer = setInterval(() => {
		void checkDeployOnce(baseline).then((changed) => {
			if (!changed) return;
			if (editing) {
				// 正在编辑时暂缓刷新，等退出编辑后下一轮再刷新，避免丢失编辑内容
				deployPendingReload = true;
				return;
			}
			location.reload();
		});
	}, deployPollInterval);
	deployStopTimer = setTimeout(() => {
		stopDeployWatch(
			deployPendingReload
				? "新版本已就绪，刷新页面即可查看"
				: "部署等待超时，请稍后手动刷新查看最新内容",
		);
	}, deployPollTimeout);
}

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
	// 点击“退出”：丢弃本轮全部修改，回到进入编辑模式前的状态。
	// 草稿清空后由 study-edit-mode-change 事件驱动编辑器平滑还原阅读视图，
	// 不做整页刷新，避免页面跳动与滚动位置丢失。
	for (let i = sessionStorage.length - 1; i >= 0; i--) {
		const key = sessionStorage.key(i);
		if (!key?.startsWith(emergencyKey)) continue;
		sessionStorage.removeItem(key);
	}
	sessionStorage.removeItem(draftsKey);
	sessionStorage.removeItem(categoryDraftsKey);
	window.dispatchEvent(new CustomEvent("study-article-editor-revert"));
	stopEditing();
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
		// 草稿为空说明没有任何“已保存到本轮”的修改：明确提示并留在编辑模式，
		// 避免用户误以为已提交成功而线上却毫无变化。
		message =
			"没有可提交的修改：请先在文章内保存修改（Ctrl+S 或“保存”按钮），再点“更新”；若要放弃请点“退出”";
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
		let commit: unknown = null;
		let changed = 0;
		try {
			const body = (await response.json()) as {
				commit?: unknown;
				changed?: number;
			};
			commit = body?.commit ?? null;
			changed = typeof body?.changed === "number" ? body.changed : 0;
		} catch {
			// 无响应体时不做部署轮询。
		}
		sessionStorage.removeItem(draftsKey);
		sessionStorage.removeItem(categoryDraftsKey);
		stopEditing();
		message =
			changed > 0
				? `已提交 ${changed} 个文件，正在等待后台部署，完成后自动刷新`
				: "已提交，正在等待后台部署，完成后自动刷新";
		watchDeploy(commit);
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
	return () => {
		document.removeEventListener("swup:page:view", resendMode);
		stopDeployWatch();
	};
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
	.global-editor { position: relative; display: flex; align-items: center; gap: .3rem; margin-right: .25rem; align-self: center; }
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
