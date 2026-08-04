<script lang="ts">
import { onMount } from "svelte";

export let categories: Array<{ name: string; count: number }>;
export let totalPosts: number;

const editModeKey = "study-edit-mode";
const draftsKey = "study-category-drafts";
let host: HTMLSpanElement;
let editing = false;

function readDrafts(): Record<string, string> {
	try {
		const value = JSON.parse(sessionStorage.getItem(draftsKey) || "{}");
		return value && typeof value === "object"
			? (value as Record<string, string>)
			: {};
	} catch {
		return {};
	}
}

function saveDraft(originalName: string, newName: string) {
	const drafts = readDrafts();
	const normalizedName = newName.trim();
	if (!normalizedName || normalizedName === originalName) {
		delete drafts[originalName];
	} else {
		drafts[originalName] = normalizedName;
	}

	if (Object.keys(drafts).length === 0) {
		sessionStorage.removeItem(draftsKey);
	} else {
		sessionStorage.setItem(draftsKey, JSON.stringify(drafts));
	}
}

function render() {
	const bar = host?.closest<HTMLElement>("#category-bar");
	if (!bar) return;

	const drafts = readDrafts();
	for (const category of categories) {
		const pill = Array.from(
			bar.querySelectorAll<HTMLAnchorElement>(".category-pill"),
		).find((item) => item.dataset.categoryName === category.name);
		const label = pill?.querySelector<HTMLElement>(".category-name");
		if (!pill || !label) continue;

		pill.querySelector(".category-name-input")?.remove();
		label.hidden = editing;
		if (!editing) continue;

		const input = document.createElement("input");
		input.className = "category-name-input";
		input.type = "text";
		input.value = drafts[category.name] || category.name;
		input.setAttribute("aria-label", `编辑分类名称：${category.name}`);
		input.style.width = `${Math.max(3, input.value.length + 1)}em`;
		input.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		input.addEventListener("input", () => {
			input.style.width = `${Math.max(3, input.value.length + 1)}em`;
			saveDraft(category.name, input.value);
		});
		input.addEventListener("keydown", (event) => event.stopPropagation());
		label.after(input);
	}
}

onMount(() => {
	void totalPosts;
	editing = sessionStorage.getItem(editModeKey) === "1";
	render();

	const handleModeChange = (event: Event) => {
		editing = Boolean(
			(event as CustomEvent<{ editing?: boolean }>).detail?.editing,
		);
		render();
	};
	const handleNavigation = () => requestAnimationFrame(render);
	window.addEventListener("study-edit-mode-change", handleModeChange);
	document.addEventListener("swup:contentReplaced", handleNavigation);
	document.addEventListener("swup:page:view", handleNavigation);
	document.addEventListener("astro:page-load", handleNavigation);

	return () => {
		window.removeEventListener("study-edit-mode-change", handleModeChange);
		document.removeEventListener("swup:contentReplaced", handleNavigation);
		document.removeEventListener("swup:page:view", handleNavigation);
		document.removeEventListener("astro:page-load", handleNavigation);
	};
});
</script>

<span class="category-editor-host" bind:this={host} hidden aria-hidden="true"></span>

<style>
	.category-editor-host { display: none; }
	:global(.category-name-input) {
		min-width: 3em;
		max-width: 14em;
		border: 0;
		border-bottom: 1px solid color-mix(in srgb, var(--primary) 55%, transparent);
		padding: 0 .1rem;
		outline: 0;
		color: inherit;
		background: transparent;
		font: inherit;
		line-height: inherit;
	}
	:global(.category-name-input:focus) {
		border-bottom-color: var(--primary);
		box-shadow: 0 1px 0 var(--primary);
	}
</style>
