import { SESSION_MAX_AGE, sessionCookie, validateToken } from "../../_lib/auth";

export const onRequestPost: PagesFunction = async (context) => {
	const contentLength = Number(
		context.request.headers.get("Content-Length") || 0,
	);
	if (contentLength > 4096) {
		return Response.json({ message: "请求内容过大" }, { status: 413 });
	}

	let token: unknown;
	try {
		({ token } = (await context.request.json()) as { token?: unknown });
	} catch {
		return Response.json({ message: "请求格式错误" }, { status: 400 });
	}
	if (
		typeof token !== "string" ||
		token.length > 2048 ||
		!(await validateToken(token))
	) {
		return Response.json(
			{ message: "登录恢复凭据无效" },
			{ status: 401, headers: { "Cache-Control": "no-store" } },
		);
	}

	return Response.json(
		{ authenticated: true },
		{
			headers: {
				"Cache-Control": "no-store",
				"Set-Cookie": sessionCookie(token, SESSION_MAX_AGE),
			},
		},
	);
};
