<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";

let authenticated = false;

async function checkSession() {
	try {
		const response = await fetch("/api/auth/session");
		authenticated = response.ok;
	} catch {
		authenticated = false;
	}
}

async function logout() {
	await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
	localStorage.removeItem("study-auth-recovery");
	location.href = "/login/";
}

onMount(() => {
	void checkSession();
	const resend = () => void checkSession();
	document.addEventListener("swup:page:view", resend);
	return () => document.removeEventListener("swup:page:view", resend);
});
</script>

{#if authenticated}
	<button
		type="button"
		class="btn-plain scale-animation rounded-lg h-9 w-9 md:h-11 md:w-11 active:scale-90"
		onclick={logout}
		aria-label="退出登录"
		title="退出登录"
	>
		<Icon
			icon="material-symbols:logout-rounded"
			class="text-[1.25rem] text-red-500"
		></Icon>
	</button>
{/if}

<style>
	button {
		align-self: center;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	button:hover :global(svg) {
		color: color-mix(in srgb, #ef4444 75%, #000);
	}
	:global(html.dark) button:hover :global(svg) {
		color: color-mix(in srgb, #ef4444 75%, #fff);
	}
</style>
