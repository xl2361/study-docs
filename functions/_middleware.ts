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
	// 文章图片等公开静态媒体：必须绕过会话中间件。
	// 否则①每张图都做会话校验（边缘缓存过期后并发冲击 editor-worker），
	// ②被强制加 private,no-store 逐张回源、浏览器不缓存——
	// 多图文章（如 DBeaver 25 张图）会把页面 load 事件拖到 80s+。
	"/uploads/",
];

// 会话校验结果边缘缓存：命中后跳过对 editor-worker 的往返请求。
// 以 token 的 SHA-256 前 16 字节为键（不缓存原始 token）。
// 5 分钟太短：浏览一页文章超过 5 分钟后，下一次切页就会冷回源（实测 TTFB 3.5s），
// 表现为"点进文章后整页空白好几秒"。延长到 30 分钟。
// 登出仅清除浏览器 cookie，缓存条目最多滞后 30 分钟失效，个人站点可接受。
const SESSION_CACHE_TTL_SECONDS = 1800;
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
	// 页面级浏览器缓存时长：HTML 仍每次过门禁（见上方 authenticated 分支），
	// 但校验通过后允许当前浏览器短时复用，避免切页时重新下载整份 HTML。
	// private = 只进当前用户浏览器缓存，不进任何共享/CDN 缓存，未登录者不可能拿到。
	if (authenticated) {
		const response = await context.next();
		const headers = new Headers(response.headers);
		const isHtml = (response.headers.get("content-type") || "").includes(
			"text/html",
		);
		// 正文页面（含文章）允许浏览器缓存 30 秒；非 HTML 资源不在这里久留。
		headers.set(
			"Cache-Control",
			isHtml ? "private, max-age=30, must-revalidate" : "private, no-store",
		);
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
