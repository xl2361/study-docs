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
let searchVersion = 0;
let history: string[] = [];
let showHistory = false;
const STORAGE_KEY = "search_history";

// --- Search History ---
function loadHistory(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveHistory(list: string[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch {}
}

function addHistory(keyword: string) {
	const normalizedKeyword = keyword.trim();
	if (!normalizedKeyword) return;
	history = [
		normalizedKeyword,
		...history.filter((h) => h !== normalizedKeyword),
	].slice(0, 10);
	saveHistory(history);
}

function removeHistory(keyword: string, e?: Event) {
	e?.preventDefault();
	e?.stopPropagation();
	history = history.filter((h) => h !== keyword);
	saveHistory(history);
}

function clearHistory(e?: Event) {
	e?.preventDefault();
	e?.stopPropagation();
	history = [];
	saveHistory(history);
}

function onHistoryClick(keyword: string) {
	keywordDesktop = keyword;
	keywordMobile = keyword;
	addHistory(keyword);
	navigateToPage(getSearchUrl(keyword));
	closeSearchPanel();
}

// --- UI Logic ---
const togglePanel = () => {
	const panel = document.getElementById("search-panel");
	if (!panel) return;
	const opening = panel.classList.contains("float-panel-closed");
	panel.classList.toggle("float-panel-closed");
	if (opening && !keywordMobile) {
		history = loadHistory();
		showHistory = history.length > 0;
		requestAnimationFrame(() =>
			document
				.querySelector<HTMLInputElement>("#search-bar-inside input")
				?.focus(),
		);
	}
};

const setPanelVisibility = (show: boolean): void => {
	const panel = document.getElementById("search-panel");
	if (!panel) return;
	show
		? panel.classList.remove("float-panel-closed")
		: panel.classList.add("float-panel-closed");
};

const closeSearchPanel = (): void => {
	searchVersion++;
	clearTimeout(debounceTimer);
	document.getElementById("search-panel")?.classList.add("float-panel-closed");
	keywordDesktop = "";
	keywordMobile = "";
	result = [];
	isSearching = false;
	showHistory = false;
};

const handleResultClick = (event: Event, url: string): void => {
	event.preventDefault();
	closeSearchPanel();
	navigateToPage(url);
};

function doSearch(keyword: string) {
	const normalizedKeyword = keyword.trim();
	if (!normalizedKeyword) {
		clearTimeout(debounceTimer);
		searchVersion++;
		result = [];
		isSearching = false;
		showHistory = history.length > 0;
		setPanelVisibility(showHistory);
		return;
	}
	showHistory = false;
	if (!initialized) return;
	isSearching = true;
	clearTimeout(debounceTimer);
	const version = ++searchVersion;
	debounceTimer = setTimeout(async () => {
		try {
			let searchResults: SearchResult[] = [];
			if (import.meta.env.PROD && window.pagefind) {
				const response = await window.pagefind.search(normalizedKeyword);
				searchResults = await Promise.all(
					response.results.map((item) => item.data()),
				);
			}
			if (version !== searchVersion) return;
			result = searchResults;
			setPanelVisibility(true);
		} catch {
			if (version !== searchVersion) return;
			result = [];
		} finally {
			if (version === searchVersion) isSearching = false;
		}
	}, 300);
}

function onDesktopEnter(e: KeyboardEvent) {
	if (e.key === "Enter") {
		e.preventDefault();
		const kw = keywordDesktop.trim();
		if (kw) {
			addHistory(kw);
			navigateToPage(getSearchUrl(kw));
			closeSearchPanel();
		}
	}
}

function onMobileEnter(e: KeyboardEvent) {
	if (e.key === "Enter") {
		e.preventDefault();
		const kw = keywordMobile.trim();
		if (kw) {
			addHistory(kw);
			navigateToPage(getSearchUrl(kw));
			closeSearchPanel();
		}
	}
}

function onDesktopFocus() {
	history = loadHistory();
	if (!keywordDesktop) {
		showHistory = history.length > 0;
		setPanelVisibility(showHistory);
	} else doSearch(keywordDesktop);
}

function onDesktopInput() {
	keywordMobile = keywordDesktop;
	doSearch(keywordDesktop);
}
function onMobileInput() {
	keywordDesktop = keywordMobile;
	doSearch(keywordMobile);
}
function clearSearchInput(mobile: boolean) {
	searchVersion++;
	clearTimeout(debounceTimer);
	keywordDesktop = "";
	keywordMobile = "";
	result = [];
	isSearching = false;
	history = loadHistory();
	showHistory = history.length > 0;
	setPanelVisibility(mobile || showHistory);
	requestAnimationFrame(() => {
		const selector = mobile ? "#search-bar-inside input" : "#search-bar input";
		document.querySelector<HTMLInputElement>(selector)?.focus();
	});
}

// --- Initialization ---
onMount(() => {
	history = loadHistory();
	const init = () => {
		initialized = true;
		const pendingKeyword = keywordDesktop || keywordMobile;
		if (pendingKeyword) doSearch(pendingKeyword);
	};
	if (import.meta.env.DEV) init();
	else if (window.pagefind) init();
	else {
		document.addEventListener("pagefindready", init, { once: true });
		document.addEventListener("pagefindloaderror", init, { once: true });
	}
	return () => {
		clearTimeout(debounceTimer);
		searchVersion++;
		document.removeEventListener("pagefindready", init);
		document.removeEventListener("pagefindloaderror", init);
	};
});
</script>

<div class="contents lg:block lg:relative lg:w-60 lg:mr-2">
    <!-- desktop search bar -->
    <div id="search-bar" class="hidden lg:flex items-center h-11 w-full rounded-lg
          bg-black/4 hover:bg-black/6 focus-within:bg-black/6
          dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
    ">
        <Icon icon="material-symbols:search"
              class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
        <input placeholder={i18n(I18nKey.search)} bind:value={keywordDesktop}
               on:focus={onDesktopFocus}
               on:input={onDesktopInput}
               on:keydown={onDesktopEnter}
               class="pl-10 pr-8 text-sm bg-transparent outline-0 h-full w-full text-black/50 dark:text-white/50"
        >
        {#if keywordDesktop}
            <button type="button" on:click={() => clearSearchInput(false)} aria-label="清空搜索" class="absolute right-2 flex items-center justify-center text-black/30 dark:text-white/30 hover:text-(--primary) transition-colors">
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"></path></svg>
            </button>
        {/if}
    </div>

    <!-- mobile toggle btn -->
    <button on:click={togglePanel} aria-label="Search Panel" id="search-switch"
            class="btn-plain scale-animation lg:hidden! rounded-lg w-9 h-9 md:w-11 md:h-11 active:scale-90">
        <Icon icon="material-symbols:search" class="text-[1.25rem]"></Icon>
    </button>

    <!-- search panel -->
    <div id="search-panel" class="float-panel float-panel-closed search-panel absolute
    top-20 left-4 right-4 md:left-auto md:w-80 lg:top-[calc(100%+0.25rem)] lg:left-0 lg:right-auto lg:w-full
    shadow-2xl rounded-xl p-2">

    <!-- mobile search bar -->
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/4 hover:bg-black/6 focus-within:bg-black/6
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
    ">
        <Icon icon="material-symbols:search"
              class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
        <input placeholder={i18n(I18nKey.search)} bind:value={keywordMobile}
               on:focus={() => {
                   history = loadHistory();
                   if (!keywordMobile) showHistory = history.length > 0;
               }}
               on:input={onMobileInput}
               on:keydown={onMobileEnter}
               class="pl-10 pr-9 absolute inset-0 text-sm bg-transparent outline-0 text-black/50 dark:text-white/50"
        >
        {#if keywordMobile}
            <button type="button" on:click={() => clearSearchInput(true)} aria-label="清空搜索" class="absolute right-2 z-10 flex items-center justify-center text-black/30 dark:text-white/30 hover:text-(--primary) transition-colors">
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"></path></svg>
            </button>
        {/if}
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
        <div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-lg text-sm px-2.5 py-1.5 text-50">
            {i18n(I18nKey.searchLoading)}
        </div>
    {:else if result.length > 0}
        {#each result.slice(0, 5) as item}
            <a href={item.url}
               on:click={(e) => handleResultClick(e, item.url)}
               class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block rounded-lg text-sm px-2.5 py-1.5 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active)">
                <div class="transition text-90 flex items-center min-w-0 font-semibold group-hover:text-(--primary)">
                    <span class="block min-w-0 flex-1 truncate">{@html item.meta.title}</span>
                    <Icon icon="fa7-solid:chevron-right" class="shrink-0 transition text-[0.75rem] ml-1 my-auto text-(--primary)"></Icon>
                </div>
                {#if item.excerpt?.includes('<mark>')}
                    <div class="transition text-xs text-50 mt-0.5 line-clamp-2">{@html item.excerpt}</div>
                {/if}
            </a>
        {/each}
        {#if result.length > 5}
            <a href={getSearchUrl(keywordDesktop || keywordMobile)}
               on:click={(e) => handleResultClick(e, getSearchUrl(keywordDesktop || keywordMobile))}
               class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block rounded-lg text-sm px-2.5 py-1.5 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) text-(--primary) font-semibold text-center">
                <span class="inline-flex items-center">
                    {i18n(I18nKey.searchViewMore).replace('{count}', (result.length - 5).toString())}
                    <Icon icon="fa7-solid:arrow-right" class="transition text-[0.75rem] ml-1"></Icon>
                </span>
            </a>
        {/if}
    {:else if !showHistory && (keywordDesktop || keywordMobile)}
        <div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-lg text-sm px-2.5 py-1.5 text-50">
            {result.length === 0 ? i18n(I18nKey.searchNoResults) : i18n(I18nKey.searchTypeSomething)}
        </div>
    {/if}
    </div>
</div>

<style>
    input:focus { outline: 0; }
    .search-panel {
        max-height: min(22rem, calc(100vh - 100px));
        overflow-y: scroll;
        scrollbar-width: thin;
        scrollbar-color: rgba(128, 128, 128, 0.55) transparent;
    }
    .search-panel::-webkit-scrollbar { width: 4px; }
    .search-panel::-webkit-scrollbar-track { background: transparent; }
    .search-panel::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.55);
        border-radius: 999px;
    }
</style>
