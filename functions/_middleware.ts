import type { PagesEnv } from "./_lib/auth";
import {
	getSessionToken,
	SESSION_MAX_AGE,
	sessionCookie,
	validateSession,
} from "./_lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/restore"];

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
	const url = new URL(context.request.url);
	const pathname = url.pathname.replace(/\/$/, "") || "/";
	const isPublic = PUBLIC_PATHS.includes(pathname);

	if (isPublic) return context.next();
	if (await validateSession(context)) {
		const response = await context.next();
		const headers = new Headers(response.headers);
		headers.set("Cache-Control", "private, no-store");
		const token = getSessionToken(context.request);
		if (token)
			headers.append("Set-Cookie", sessionCookie(token, SESSION_MAX_AGE));
		return new Response(response.body, { status: response.status, headers });
	}

	if (url.pathname.startsWith("/api/")) {
		return Response.json(
			{ message: "登录已失效" },
			{ status: 401, headers: { "Cache-Control": "no-store" } },
		);
	}
	const next = `${url.pathname}${url.search}`;
	return Response.redirect(
		new URL(`/login/?next=${encodeURIComponent(next)}`, url.origin),
		302,
	);
};
