import type { PagesEnv } from "./_lib/auth";
import {
	getSessionToken,
	SESSION_MAX_AGE,
	sessionCookie,
	validateSessionToken,
} from "./_lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/restore"];
const PUBLIC_PREFIXES = [
	"/_astro/",
	"/pagefind/pagefind",
	"/favicon",
	"/apple-touch-icon",
	"/robots.txt",
	"/site.webmanifest",
	"/manifest",
];

// 会话校验结果边缘缓存：命中后跳过对 editor-worker 的往返请求。
// 以 token 的 SHA-256 前 16 字节为键（不缓存原始 token），TTL 5 分钟。
// 登出仅清除浏览器 cookie，缓存条目最多滞后 5 分钟失效，个人站点可接受。
const SESSION_CACHE_TTL_SECONDS = 300;
const encoder = new TextEncoder();

interface EdgeCacheLike {
	match(request: string | Request): Promise<Response | undefined>;
	put(request: string | Request, response: Response): Promise<void>;
}

function edgeCache(): EdgeCacheLike | null {
	const c = (globalThis as { caches?: { default?: EdgeCacheLike } }).caches;
	return c?.default ?? null;
}

async function sessionCacheKey(
	request: Request,
	token: string,
): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
	let hex = "";
	for (const byte of new Uint8Array(digest).slice(0, 16)) {
		hex += byte.toString(16).padStart(2, "0");
	}
	return `${new URL(request.url).origin}/__session-cache/${hex}`;
}

async function isValidSessionCached(
	request: Request,
	token: string,
): Promise<boolean> {
	const cache = edgeCache();
	const key = await sessionCacheKey(request, token);
	if (cache) {
		try {
			const hit = await cache.match(key);
			if (hit) return true;
		} catch {
			/* 缓存读取失败按未命中处理 */
		}
	}
	const valid = await validateSessionToken(token);
	if (valid && cache) {
		try {
			await cache.put(
				key,
				new Response("1", {
					headers: {
						"Cache-Control": `public, max-age=${SESSION_CACHE_TTL_SECONDS}`,
					},
				}),
			);
		} catch {
			/* 缓存写入失败不影响鉴权 */
		}
	}
	return valid;
}

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
	const url = new URL(context.request.url);
	const pathname = url.pathname.replace(/\/$/, "") || "/";
	const isPublic =
		PUBLIC_PATHS.includes(pathname) ||
		PUBLIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

	if (isPublic) return context.next();
	// GET /api/hits 热度榜公开可读（首页排序依赖，避免无谓会话校验）
	if (context.request.method === "GET" && url.pathname === "/api/hits")
		return context.next();
	const renewSession = pathname !== "/api/auth/logout";
	const token = getSessionToken(context.request);
	const authenticated = token
		? await isValidSessionCached(context.request, token)
		: false;
	if (authenticated) {
		const response = await context.next();
		const headers = new Headers(response.headers);
		headers.set("Cache-Control", "private, no-store");
		if (renewSession && token) {
			headers.append("Set-Cookie", sessionCookie(token, SESSION_MAX_AGE));
		}
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
