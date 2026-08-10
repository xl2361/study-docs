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
		class="btn-plain scale-animation rounded-lg active:scale-90"
		onclick={logout}
		aria-label="退出登录"
		title="退出登录"
	>
		登出
	</button>
{/if}

<style>
	button {
		align-self: center;
		height: 2.25rem;
		border: 1px solid var(--primary);
		border-radius: 0.7rem;
		padding: 0 0.7rem;
		background: var(--primary);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 750;
	}
	button:hover {
		background: color-mix(in srgb, var(--primary) 85%, #000);
	}
	@media (max-width: 640px) {
		button {
			height: 2.1rem;
			padding: 0 0.55rem;
		}
	}
</style>
