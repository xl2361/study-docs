import type { PagesEnv } from "../../_lib/auth";
import { fetchEditor, SESSION_MAX_AGE, sessionCookie } from "../../_lib/auth";

export const onRequestPost: PagesFunction<PagesEnv> = async (context) => {
	const contentType = context.request.headers.get("Content-Type") || "";
	const isForm = contentType.includes("application/x-www-form-urlencoded");
	let credentials: { username?: unknown; password?: unknown };
	let next = "/";
	if (isForm) {
		const form = await context.request.formData();
		credentials = {
			username: form.get("username"),
			password: form.get("password"),
		};
		const requestedNext = form.get("next");
		if (typeof requestedNext === "string") {
			try {
				const target = new URL(requestedNext, context.request.url);
				if (
					target.origin === new URL(context.request.url).origin &&
					target.pathname.startsWith("/") &&
					!target.pathname.startsWith("//")
				)
					next = `${target.pathname}${target.search}`;
			} catch {
				// 无效的 next 路径忽略，回落到默认主页。
			}
		}
	} else {
		credentials = (await context.request.json()) as {
			username?: unknown;
			password?: unknown;
		};
	}

	const response = await fetchEditor(context, "/api/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(credentials),
	});
	const result = (await response.json()) as {
		token?: string;
		expiresAt?: number;
		message?: string;
	};
	if (!response.ok || !result.token) {
		if (isForm) {
			const loginUrl = new URL("/login/", context.request.url);
			loginUrl.searchParams.set("error", result.message || "账号或密码错误");
			loginUrl.searchParams.set("next", next);
			return Response.redirect(loginUrl, 303);
		}
		return Response.json(
			{ message: result.message || "账号或密码错误" },
			{ status: response.status, headers: { "Cache-Control": "no-store" } },
		);
	}
	const maxAge = Math.max(
		0,
		Math.min(
			SESSION_MAX_AGE,
			(result.expiresAt || 0) - Math.floor(Date.now() / 1000),
		),
	);
	if (isForm) {
		const bootstrap = JSON.stringify({ token: result.token, next }).replace(
			/<\/script/gi,
			"<\\/script",
		);
		return new Response(
			`<!doctype html><meta charset="utf-8"><script>const data=${bootstrap};try{localStorage.setItem("study-auth-recovery",data.token)}catch{}location.replace(data.next)</script>`,
			{
				status: 200,
				headers: {
					"Cache-Control": "no-store",
					"Content-Type": "text/html; charset=utf-8",
					"Set-Cookie": sessionCookie(result.token, maxAge),
				},
			},
		);
	}
	return Response.json(
		{ authenticated: true },
		{
			headers: {
				"Cache-Control": "no-store",
				"Set-Cookie": sessionCookie(result.token, maxAge),
			},
		},
	);
};
