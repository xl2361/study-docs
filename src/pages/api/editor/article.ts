// 本地 dev mock：Cloudflare Pages Function functions/api/editor/article.ts
// 在本地 astro dev 不运行，编辑器打开文章时 404。
//
// Astro 静态输出下 dev 的 API route 是 prerendered：query/headers/cookie
// 全部不可用（session.ts 同款）。因此 slug 无法从请求获取 →
// 改用 import.meta.glob 编译期读入全部文章，按 query/任何能拿到的线索都
// 不可行 → 直接返回全部文章 map，前端 dev 模式自行挑选。
// 生产静态构建输出 404 占位，实际由 Pages Function 接管（带 query 正常工作）。
import type { APIRoute } from "astro";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// 本地静态构建（无 adapter）需静态化占位，否则 NoAdapterInstalled。
// dev 与部署构建（CF_WORKERS）按需渲染。
export const prerender = process.env.CF_WORKERS
	? false
	: import.meta.env.DEV
		? false
		: true;

const POSTS_DIR = path.join(process.cwd(), "src/content/posts");

export const GET: APIRoute = async () => {
	if (!import.meta.env.DEV) {
		return new Response("Not Found", { status: 404 });
	}
	// 编译期/运行时读全部文章（dev 每次请求现读，无需缓存）
	const names = await readdir(POSTS_DIR);
	const map: Record<string, string> = {};
	for (const name of names) {
		if (!name.toLowerCase().endsWith(".md")) continue;
		try {
			const raw = await readFile(path.join(POSTS_DIR, name), "utf-8");
			// key 用小写 entry.id（与编辑器 slug 一致）；去掉 frontmatter
			map[name.toLowerCase().replace(/\.md$/, "")] = raw.replace(
				/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
				"",
			);
		} catch {
			/* 单篇读取失败忽略 */
		}
	}
	return new Response(JSON.stringify({ posts: map }), {
		headers: { "Content-Type": "application/json" },
	});
};
