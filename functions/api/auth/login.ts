import type { PagesEnv } from "../../_lib/auth";
import { fetchEditor, sessionCookie } from "../../_lib/auth";

export const onRequestPost: PagesFunction<PagesEnv> = async (context) => {
	const response = await fetchEditor(context, "/api/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: context.request.body,
	});
	const result = (await response.json()) as {
		token?: string;
		expiresAt?: number;
		message?: string;
	};
	if (!response.ok || !result.token) {
		return Response.json(
			{ message: result.message || "账号或密码错误" },
			{ status: response.status, headers: { "Cache-Control": "no-store" } },
		);
	}
	const maxAge = Math.max(
		0,
		Math.min(
			30 * 24 * 60 * 60,
			(result.expiresAt || 0) - Math.floor(Date.now() / 1000),
		),
	);
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
