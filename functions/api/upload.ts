import type { PagesEnv } from "../_lib/auth";
import { fetchEditor } from "../_lib/auth";

// 图片上传的同域代理：前端 POST JSON { dataUrl } 到这里，
// 由本函数带上会话 Cookie 转发给 editor-worker 的 /api/upload。
// 之所以需要这层：浏览器只能对同源发起带 Cookie 的请求，
// 而 worker 在另一个域上（参见 functions/api/hits.ts 的同类做法）。
export const onRequestPost: PagesFunction<PagesEnv> = async (context) => {
	const response = await fetchEditor(context, "/api/upload", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: context.request.body,
	});
	return new Response(response.body, {
		status: response.status,
		headers: {
			"Content-Type":
				response.headers.get("Content-Type") || "application/json",
			"Cache-Control": "no-store",
		},
	});
};
