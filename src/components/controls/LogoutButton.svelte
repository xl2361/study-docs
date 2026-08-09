<script lang="ts">
import { onMount } from "svelte";

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
		class="btn-plain scale-animation rounded-lg h-9 md:h-11 px-2.5 text-sm font-semibold active:scale-90"
		onclick={logout}
		aria-label="退出登录"
		title="退出登录"
	>
		登出
	</button>
{/if}
