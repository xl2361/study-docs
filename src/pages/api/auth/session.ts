// 本地 dev mock：Cloudflare Pages Functions 在本地 astro dev 不运行，
// /api/auth/session 会 404 导致登出/编辑按钮不显示。
// 此路由在 dev 返回已登录让本地可直接测试编辑器；
// 生产构建（import.meta.env.DEV 为 false）输出 authenticated:false 的占位，
// 实际请求由 functions/api/auth/session.ts（Pages Function）接管。
// 静态构建下 API 路由的 query 会被 Astro 丢弃（request.js 对 prerender 请求
// 清空 search），因此本路由不依赖任何 query 参数。
import type { APIRoute } from "astro";

const DEV_AUTHENTICATED = import.meta.env.DEV;

export const GET: APIRoute = async () =>
	new Response(JSON.stringify({ authenticated: DEV_AUTHENTICATED }), {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
		},
	});
