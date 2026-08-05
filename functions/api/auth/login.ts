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
		if (
			typeof requestedNext === "string" &&
			requestedNext.startsWith("/") &&
			!requestedNext.startsWith("//")
		) {
			next = requestedNext;
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
		return new Response(null, {
			status: 303,
			headers: {
				"Cache-Control": "no-store",
				Location: new URL(next, context.request.url).toString(),
				"Set-Cookie": sessionCookie(result.token, maxAge),
			},
		});
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
