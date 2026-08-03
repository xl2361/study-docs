<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { navigateToPage } from "@utils/navigation-utils";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import { url as formatUrl, getSearchUrl } from "@/utils/url-utils";

// --- State ---
let keywordDesktop = "";
let keywordMobile = "";
let result: SearchResult[] = [];
let isSearching = false;
let initialized = false;
let debounceTimer: NodeJS.Timeout;
let history: string[] = [];
let showHistory = false;
const STORAGE_KEY = "search_history";

// --- Search History ---
function loadHistory(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch { return []; }
}

function saveHistory(list: string[]) {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

function addHistory(keyword: string) {
	keyword = keyword.trim();
	if (!keyword) return;
	history = [keyword, ...history.filter(h => h !== keyword)].slice(0, 10);
	saveHistory(history);
}

function removeHistory(keyword: string, e?: Event) {
	e?.preventDefault();
	e?.stopPropagation();
	history = history.filter(h => h !== keyword);
	saveHistory(history);
}

function clearHistory(e?: Event) {
	e?.preventDefault();
	e?.stopPropagation();
	history = [];
	saveHistory(history);
}

function onHistoryClick(keyword: string) {
	addHistory(keyword);
	navigateToPage(getSearchUrl(keyword));
	closeSearchPanel();
}

// --- UI Logic ---
const togglePanel = () => {
	document.getElementById("search-panel")?.classList.toggle("float-panel-closed");
};

const setPanelVisibility = (show: boolean, isDesktop: boolean): void => {
	const panel = document.getElementById("search-panel");
	if (!panel) return;
	show ? panel.classList.remove("float-panel-closed") : panel.classList.add("float-panel-closed");
};

const closeSearchPanel = (): void => {
	document.getElementById("search-panel")?.classList.add("float-panel-closed");
	keywordDesktop = "";
	keywordMobile = "";
	result = [];
	showHistory = false;
};

const handleResultClick = (event: Event, url: string): void => {
	event.preventDefault();
	closeSearchPanel();
	navigateToPage(url);
};

function doSearch(keyword: string, isDesktop: boolean) {
	if (!keyword) {
		result = [];
		showHistory = history.length > 0;
		setPanelVisibility(showHistory, isDesktop);
		return;
	}
	showHistory = false;
	if (!initialized) return;
	isSearching = true;
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(async () => {
		try {
			let searchResults: SearchResult[] = [];
			if (import.meta.env.PROD && window.pagefind) {
				const response = await window.pagefind.search(keyword);
				searchResults = await Promise.all(response.results.map((item) => item.data()));
			}
			result = searchResults;
			setPanelVisibility(true, isDesktop);
		} catch { result = []; }
		finally { isSearching = false; }
	}, 300);
}

function onDesktopEnter(e: KeyboardEvent) {
	if (e.key === 'Enter') {
		e.preventDefault();
		const kw = keywordDesktop.trim();
		if (kw) { addHistory(kw); navigateToPage(getSearchUrl(kw)); }
	}
}

function onMobileEnter(e: KeyboardEvent) {
	if (e.key === 'Enter') {
		e.preventDefault();
		const kw = keywordMobile.trim();
		if (kw) { addHistory(kw); navigateToPage(getSearchUrl(kw)); }
	}
}

function onDesktopFocus() {
	history = loadHistory();
	if (!keywordDesktop) { showHistory = history.length > 0; setPanelVisibility(showHistory, true); }
	else doSearch(keywordDesktop, true);
}

// --- Initialization ---
onMount(() => {
	history = loadHistory();
	const init = () => {
		initialized = true;
		if (keywordDesktop) doSearch(keywordDesktop, true);
	};
	if (import.meta.env.DEV) init();
	else if (window.pagefind) init();
	else {
		document.addEventListener("pagefindready", init, { once: true });
		document.addEventListener("pagefindloaderror", init, { once: true });
	}
});

// --- Reactive ---
$: if (initialized && (keywordDesktop || keywordDesktop === "")) doSearch(keywordDesktop, true);
$: if (initialized && (keywordMobile || keywordMobile === "")) doSearch(keywordMobile, false);
</script>

<!-- desktop search bar -->
<div id="search-bar" class="hidden lg:flex transition-all items-center h-11 mr-2 rounded-lg
      bg-black/4 hover:bg-black/6 focus-within:bg-black/6
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
">
    <Icon icon="material-symbols:search"
          class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
    <input placeholder={i18n(I18nKey.search)} bind:value={keywordDesktop}
           on:focus={onDesktopFocus}
           on:keydown={onDesktopEnter}
           class="transition-all pl-10 text-sm bg-transparent outline-0 h-full w-40 active:w-60 focus:w-60 text-black/50 dark:text-white/50"
    >
</div>

<!-- mobile toggle btn -->
<button on:click={togglePanel} aria-label="Search Panel" id="search-switch"
        class="btn-plain scale-animation lg:hidden! rounded-lg w-9 h-9 md:w-11 md:h-11 active:scale-90">
    <Icon icon="material-symbols:search" class="text-[1.25rem]"></Icon>
</button>

<!-- search panel -->
<div id="search-panel" class="float-panel float-panel-closed search-panel absolute md:w-120
top-20 left-4 md:left-[unset] right-4 shadow-2xl rounded-2xl p-2">

    <!-- mobile search bar -->
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/4 hover:bg-black/6 focus-within:bg-black/6
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
    ">
        <Icon icon="material-symbols:search"
              class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
        <input placeholder={i18n(I18nKey.search)} bind:value={keywordMobile}
               on:keydown={onMobileEnter}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0 focus:w-60 text-black/50 dark:text-white/50"
        >
    </div>

    <!-- search history -->
    {#if showHistory && history.length > 0}
        <div class="mt-2 px-3 py-1 flex items-center justify-between">
            <span class="text-xs text-black/40 dark:text-white/40 font-medium">搜索记录</span>
            <button on:click={clearHistory} class="text-xs text-black/40 dark:text-white/40 hover:text-red-500 transition">清空</button>
        </div>
        {#each history as item}
            <div class="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-black/4 dark:hover:bg-white/5 cursor-pointer transition group" on:click={() => onHistoryClick(item)}>
                <span class="text-sm text-black/60 dark:text-white/60 truncate flex-1">{item}</span>
                <button on:click={(e) => removeHistory(item, e)} class="opacity-0 group-hover:opacity-100 text-black/30 hover:text-red-500 transition shrink-0 ml-2">
                    <Icon icon="material-symbols:close" class="text-[0.875rem]"></Icon>
                </button>
            </div>
        {/each}
    {/if}

    <!-- search results -->
    {#if isSearching}
        <div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-xl text-lg px-3 py-2 text-50">
            {i18n(I18nKey.searchLoading)}
        </div>
    {:else if result.length > 0}
        {#each result.slice(0, 5) as item}
            <a href={item.url}
               on:click={(e) => handleResultClick(e, item.url)}
               class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active)">
                <div class="transition text-90 inline-flex font-bold group-hover:text-(--primary)">
                    {@html item.meta.title}
                    <Icon icon="fa7-solid:chevron-right" class="transition text-[0.75rem] translate-x-1 my-auto text-(--primary)"></Icon>
                </div>
                {#if item.excerpt?.includes('<mark>')}
                    <div class="transition text-sm text-50" style="margin-top: 0.1rem">{@html item.excerpt}</div>
                {/if}
            </a>
        {/each}
        {#if result.length > 5}
            <a href={getSearchUrl(keywordDesktop || keywordMobile)}
               on:click={(e) => handleResultClick(e, getSearchUrl(keywordDesktop || keywordMobile))}
               class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) text-(--primary) font-bold text-center">
                <span class="inline-flex items-center">
                    {i18n(I18nKey.searchViewMore).replace('{count}', (result.length - 5).toString())}
                    <Icon icon="fa7-solid:arrow-right" class="transition text-[0.75rem] ml-1"></Icon>
                </span>
            </a>
        {/if}
    {:else if !showHistory && (keywordDesktop || keywordMobile)}
        <div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-xl text-lg px-3 py-2 text-50">
            {result.length === 0 ? i18n(I18nKey.searchNoResults) : i18n(I18nKey.searchTypeSomething)}
        </div>
    {/if}
</div>

<style>
    input:focus { outline: 0; }
    .search-panel { max-height: calc(100vh - 100px); overflow-y: auto; }
</style>
