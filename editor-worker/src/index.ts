interface GitHubContent {
	content?: string;
	encoding?: string;
	path?: string;
	sha?: string;
}

interface ArticleDraft {
	slug?: unknown;
	content?: unknown;
	sha?: unknown;
	create?: unknown;
	delete?: unknown;
}

type PendingArticle =
	| { kind: "create" | "update"; content: string }
	| { kind: "delete" };

interface GitHubDirectoryEntry {
	name?: string;
	path?: string;
	type?: string;
}

interface HitRecord {
	count: number;
	lastAt: number;
}

const API_ROOT = "https://api.github.com";
const ARTICLE_ROOT = "src/content/posts/";
const MAX_ARTICLE_BYTES = 1024 * 1024;
const SESSION_SECONDS = 400 * 24 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export default {
	async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
		const origin = request.headers.get("Origin");
		if (request.method === "OPTIONS") return handleOptions(origin, env);
		if (origin !== env.ALLOWED_ORIGIN)
			return json({ message: "不允许的请求来源" }, 403, origin, env);

		try {
			const url = new URL(request.url);
			if (url.pathname === "/api/login" && request.method === "POST") {
				return await login(request, env, origin);
			}
			if (url.pathname === "/api/session" && request.method === "GET") {
				await requireSession(request, env);
				return json({ authenticated: true }, 200, origin, env);
			}
			if (url.pathname === "/api/article" && request.method === "GET") {
				await requireSession(request, env);
				return await getArticle(url, env, origin);
			}
			if (url.pathname === "/api/articles" && request.method === "PUT") {
				await requireSession(request, env);
				return await updateArticles(request, env, origin);
			}
			if (url.pathname === "/api/upload" && request.method === "POST") {
				await requireSession(request, env);
				return await uploadImage(request, env, origin);
			}
			if (url.pathname === "/api/hits" && request.method === "GET") {
				return await listHits(env, origin);
			}
			if (url.pathname === "/api/hits" && request.method === "POST") {
				return await recordHit(request, env, origin);
			}
			return json({ message: "接口不存在" }, 404, origin, env);
		} catch (error) {
			if (error instanceof HttpError)
				return json({ message: error.message }, error.status, origin, env);
			console.error(
				JSON.stringify({
					event: "editor_error",
					message: error instanceof Error ? error.message : "unknown",
				}),
			);
			return json({ message: "服务暂时不可用" }, 500, origin, env);
		}
	},
};

class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

async function login(
	request: Request,
	env: Cloudflare.Env,
	origin: string,
): Promise<Response> {
	const contentLength = Number(request.headers.get("Content-Length") || 0);
	if (contentLength > 1024) throw new HttpError(413, "请求内容过大");

	const ip =
		request.headers.get("X-Client-IP") ||
		request.headers.get("CF-Connecting-IP") ||
		"unknown";
	const rateLimit = await env.LOGIN_RATE_LIMITER.limit({ key: ip });
	if (!rateLimit.success)
		throw new HttpError(429, "尝试次数过多，请一分钟后再试");

	const body = await readJson<{ username?: unknown; password?: unknown }>(
		request,
	);
	if (
		body.username !== "admin" ||
		typeof body.password !== "string" ||
		!(await secureEqual(body.password, env.ADMIN_PASSWORD))
	) {
		throw new HttpError(401, "账号或密码错误");
	}
	if (env.SESSION_SECRET.length < 32)
		throw new HttpError(500, "SESSION_SECRET 配置不安全");

	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
	const payload = toBase64Url(
		encoder.encode(JSON.stringify({ scope: "article:write" })),
	);
	const signature = await sign(payload, env.SESSION_SECRET);
	return json(
		{ token: `${payload}.${signature}`, expiresAt },
		200,
		origin,
		env,
	);
}

async function updateArticles(
	request: Request,
	env: Cloudflare.Env,
	origin: string,
): Promise<Response> {
	const body = await readJson<{
		articles?: unknown;
		categoryRenames?: unknown;
	}>(request);
	if (!Array.isArray(body.articles))
		throw new HttpError(400, "文章草稿格式不正确");
	if (body.articles.length > 50)
		throw new HttpError(400, "单次最多更新 50 篇文章");

	const renames = parseCategoryRenames(body.categoryRenames);
	const pending = new Map<string, PendingArticle>();
	const requestedPaths = new Set<string>();
	let totalBytes = 0;
	const head = await githubRequest<{ object?: { sha?: string } }>(
		env,
		`/repos/${repoPath(env)}/git/ref/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`,
	);
	const headSha = head.object?.sha;
	if (!headSha) throw new HttpError(502, "GitHub 分支缺少版本信息");

	for (const value of body.articles as ArticleDraft[]) {
		const path = articlePath(value.slug);
		if (requestedPaths.has(path))
			throw new HttpError(400, "单轮请求不能重复修改同一文章路径");
		requestedPaths.add(path);
		if (
			(value.create !== undefined && typeof value.create !== "boolean") ||
			(value.delete !== undefined && typeof value.delete !== "boolean") ||
			(value.create === true && value.delete === true)
		)
			throw new HttpError(400, "文章草稿操作类型不正确");

		if (value.delete === true) {
			if (value.content !== undefined || typeof value.sha !== "string")
				throw new HttpError(400, "删除文章必须提供版本信息且不能包含内容");
			const current = await fetchGitHubContent(path, env, headSha);
			if (!current.sha || current.sha !== value.sha)
				throw new HttpError(
					409,
					`${path.slice(ARTICLE_ROOT.length)} 已被其他操作修改，请重新读取`,
				);
			pending.set(path, { kind: "delete" });
			continue;
		}

		if (typeof value.content !== "string")
			throw new HttpError(400, "文章草稿缺少内容");
		const articleBytes = encoder.encode(value.content).byteLength;
		if (articleBytes === 0 || articleBytes > MAX_ARTICLE_BYTES)
			throw new HttpError(400, "单篇文章必须小于 1 MB 且不能为空");
		validateMarkdown(value.content);
		const content = updateFrontmatterDate(
			renameCategory(value.content, renames),
		);

		if (value.create === true) {
			if (value.sha !== undefined)
				throw new HttpError(400, "新增文章不能提供版本信息");
			const current = await fetchGitHubContentIfExists(path, env, headSha);
			if (current)
				throw new HttpError(
					409,
					`${path.slice(ARTICLE_ROOT.length)} 已存在，请重新读取`,
				);
			pending.set(path, { kind: "create", content });
		} else {
			if (typeof value.sha !== "string")
				throw new HttpError(400, "文章草稿缺少版本信息");
			const current = await fetchGitHubContent(path, env, headSha);
			if (!current.sha || current.sha !== value.sha)
				throw new HttpError(
					409,
					`${path.slice(ARTICLE_ROOT.length)} 已被其他操作修改，请重新读取`,
				);
			pending.set(path, { kind: "update", content });
		}
		totalBytes += encoder.encode(content).byteLength;
	}

	if (renames.size > 0) {
		const entries = await fetchArticleDirectory(env, headSha);
		for (const entry of entries) {
			if (entry.type !== "file" || !entry.path?.endsWith(".md")) continue;
			const path = entry.path;
			const existing = pending.get(path);
			if (existing) {
				if (existing.kind === "delete") continue;
				const renamed = renameCategory(existing.content, renames);
				pending.set(path, { ...existing, content: renamed });
				continue;
			}
			const current = await fetchGitHubContent(path, env, headSha);
			if (!current.sha || typeof current.content !== "string")
				throw new HttpError(502, `无法读取 ${entry.name || path}`);
			const original = decodeBase64(current.content.replace(/\s/g, ""));
			const renamed = renameCategory(original, renames);
			if (renamed !== original) {
				const content = updateFrontmatterDate(renamed);
				totalBytes += encoder.encode(content).byteLength;
				pending.set(path, { kind: "update", content });
			}
		}
	}

	if (pending.size === 0) throw new HttpError(400, "没有需要提交的修改");
	if (pending.size > 100 || totalBytes > 5 * 1024 * 1024)
		throw new HttpError(413, "本轮修改内容过多，请分批更新");

	// 取出暂存图片，与文章改动并入同一次 commit：
	// 这样"图片可见"和"文章可见"落在同一个构建周期，
	// 避免上传后立刻引用却 404（渲染成损坏图）的问题。
	const staged = await readStagedImages(env);

	const parent = await githubRequest<{ tree?: { sha?: string } }>(
		env,
		`/repos/${repoPath(env)}/git/commits/${headSha}`,
	);
	if (!parent.tree?.sha) throw new HttpError(502, "GitHub 提交缺少 Tree 信息");
	const tree = await githubRequest<{ sha?: string }>(
		env,
		`/repos/${repoPath(env)}/git/trees`,
		{
			method: "POST",
			body: JSON.stringify({
				base_tree: parent.tree.sha,
				tree: [
					...[...pending].map(([path, article]) =>
						article.kind === "delete"
							? { path, mode: "100644", type: "blob", sha: null }
							: {
									path,
									mode: "100644",
									type: "blob",
									content: article.content,
								},
					),
					...staged.map(({ image }) => ({
						path: image.path,
						mode: "100644",
						type: "blob",
						content: image.base64,
					})),
				],
			}),
		},
	);
	if (!tree.sha) throw new HttpError(502, "GitHub 创建 Tree 失败");
	const commitResult = await githubRequest<{ sha?: string }>(
		env,
		`/repos/${repoPath(env)}/git/commits`,
		{
			method: "POST",
			body: JSON.stringify({
				message: `docs: 在线批量更新 ${pending.size} 个文件${
					staged.length ? `（含 ${staged.length} 张图片）` : ""
				}`,
				tree: tree.sha,
				parents: [headSha],
			}),
		},
	);
	if (!commitResult.sha) throw new HttpError(502, "GitHub 创建 Commit 失败");
	await githubRequest(
		env,
		`/repos/${repoPath(env)}/git/refs/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`,
		{
			method: "PATCH",
			body: JSON.stringify({ sha: commitResult.sha, force: false }),
		},
		409,
	);

	const commit = commitResult.sha;
	const changed = pending.size;
	// 提交成功后再清理暂存，避免提交失败导致图片丢失。
	// 清理失败不影响本次保存结果（TTL 到期也会自动回收）。
	for (const { key } of staged) {
		try {
			await env.HITS_KV.delete(key);
		} catch {
			/* 忽略：TTL 会兜底回收 */
		}
	}
	console.log(
		JSON.stringify({
			event: "articles_saved",
			files: changed,
			images: staged.length,
			commit,
		}),
	);
	return json(
		{ changed, updated: changed, images: staged.length, commit },
		200,
		origin,
		env,
	);
}

// 图片上传：先暂存到 KV，等保存文章时并进同一次 commit。
//
// 为什么不在上传时直接提交 GitHub：
//   1) 每次上传都会产生一次 commit，并触发一次 Cloudflare Pages 构建；
//   2) 构建完成前该文件对外是 404，而编辑器此时已把 <img> 插进正文，
//      浏览器请求到 404 会渲染成"损坏图"且不会自动重试；
//   3) 上传越频繁，仓库历史噪音越大。
//
// 改为暂存后：图片随「保存文章」这一次 commit 一起落库，
// "图片可见"与"文章可见"对齐到同一个构建周期，上面的问题自然消失。
//
// KV 键：staged:<uuid>  →  { path, bytes(base64), type, at }
// 写入即返回最终公开路径，前端可直接写进 markdown。
const UPLOAD_ROOT = "public/uploads/images/";
const STAGED_PREFIX = "staged:";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// 暂存有效期：超过则视为已放弃（避免 KV 里堆孤儿数据）
const STAGED_TTL_SECONDS = 60 * 60 * 24;
// 只允许位图；不含 svg（可含脚本，作为静态资源直出有 XSS 风险）
const IMAGE_MIME_EXT: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/avif": "avif",
};

interface StagedImage {
	path: string;
	base64: string;
	type: string;
	at: number;
}

function dataUrlToImage(value: unknown): {
	bytes: Uint8Array;
	ext: string;
	base64: string;
	type: string;
} {
	if (typeof value !== "string")
		throw new HttpError(400, "图片数据格式不正确");
	const match = /^data:([a-z0-9.+/-]+);base64,([\s\S]+)$/i.exec(value.trim());
	if (!match)
		throw new HttpError(400, "仅支持 base64 编码的 data URL 图片");
	const type = match[1].toLowerCase();
	const ext = IMAGE_MIME_EXT[type];
	if (!ext)
		throw new HttpError(
			400,
			"仅支持 png / jpg / gif / webp / avif 格式的图片",
		);

	const base64 = match[2].replace(/\s/g, "");
	let binary: string;
	try {
		binary = atob(base64);
	} catch {
		throw new HttpError(400, "图片 base64 解码失败");
	}
	const bytes = Uint8Array.from(binary, (character) =>
		character.charCodeAt(0),
	);
	if (bytes.byteLength === 0) throw new HttpError(400, "图片内容为空");
	if (bytes.byteLength > MAX_IMAGE_BYTES)
		throw new HttpError(413, "单张图片不能超过 8 MB");
	return { bytes, ext, base64, type };
}

async function uploadImage(
	request: Request,
	env: Cloudflare.Env,
	origin: string,
): Promise<Response> {
	const body = await readJson<{ dataUrl?: unknown }>(request);
	const { bytes, ext, base64, type } = dataUrlToImage(body.dataUrl);

	const day = new Date().toISOString().slice(0, 10);
	// 路径全部由服务端生成，不含用户输入，因此不存在路径穿越问题
	const path = `${UPLOAD_ROOT}${day}/${crypto.randomUUID()}.${ext}`;

	await env.HITS_KV.put(
		`${STAGED_PREFIX}${crypto.randomUUID()}`,
		JSON.stringify({ path, base64, type, at: Date.now() } satisfies StagedImage),
		{ expirationTtl: STAGED_TTL_SECONDS },
	);

	// 对外暴露的是站点路径（去掉 public/ 前缀），与既有 markdown 里的
	// /uploads/images/... 引用形式一致
	const publicPath = `/${path.replace(/^public\//, "")}`;
	console.log(
		JSON.stringify({
			event: "image_staged",
			path,
			bytes: bytes.byteLength,
		}),
	);
	return json({ url: publicPath, bytes: bytes.byteLength }, 200, origin, env);
}

/**
 * 取出所有暂存图片（供保存文章时并入同一次 commit）。
 * 只返回 KV 中带 staged: 前缀的键；读取失败的单条跳过，不阻塞保存。
 * KV list 默认每页上限 1000 条，这里按 cursor 翻页取全，避免漏图。
 */
async function readStagedImages(
	env: Cloudflare.Env,
): Promise<Array<{ key: string; image: StagedImage }>> {
	const out: Array<{ key: string; image: StagedImage }> = [];
	let cursor: string | undefined;
	do {
		const list = await env.HITS_KV.list({
			prefix: STAGED_PREFIX,
			cursor,
		});
		for (const entry of list.keys) {
			try {
				const raw = await env.HITS_KV.get<StagedImage>(entry.name, "json");
				if (raw?.path && raw?.base64) out.push({ key: entry.name, image: raw });
			} catch {
				/* 单条读取失败：跳过，不影响文章保存 */
			}
		}
		cursor = list.list_complete ? undefined : list.cursor;
	} while (cursor);
	return out;
}

function parseCategoryRenames(value: unknown): Map<string, string> {
	if (value === undefined) return new Map();
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new HttpError(400, "分类修改格式不正确");
	const renames = new Map<string, string>();
	for (const [from, target] of Object.entries(value)) {
		if (typeof target !== "string")
			throw new HttpError(400, "分类名称格式不正确");
		const oldName = from.trim();
		const newName = target.trim();
		if (
			!oldName ||
			!newName ||
			oldName.length > 50 ||
			newName.length > 50 ||
			/[\r\n]/.test(newName)
		)
			throw new HttpError(400, "分类名称不能为空且不能超过 50 个字符");
		if (oldName !== newName) renames.set(oldName, newName);
	}
	return renames;
}

function renameCategory(content: string, renames: Map<string, string>): string {
	if (renames.size === 0) return content;
	const normalized = content.replace(/\r\n/g, "\n");
	const end = normalized.indexOf("\n---", 4);
	if (end < 0) return content;
	const frontmatter = normalized.slice(4, end);
	const match = frontmatter.match(/^category\s*:\s*(.*?)\s*$/m);
	if (!match) return content;
	const quote =
		match[1].startsWith('"') && match[1].endsWith('"')
			? '"'
			: match[1].startsWith("'") && match[1].endsWith("'")
				? "'"
				: "";
	const current = quote ? match[1].slice(1, -1) : match[1];
	const target = renames.get(current.trim());
	if (!target) return content;
	const next = normalized.replace(
		/^category\s*:.*$/m,
		`category: ${JSON.stringify(target)}`,
	);
	return content.includes("\r\n") ? next.replace(/\n/g, "\r\n") : next;
}

async function fetchArticleDirectory(
	env: Cloudflare.Env,
	ref: string,
): Promise<GitHubDirectoryEntry[]> {
	const result = await githubRequest<GitHubDirectoryEntry[]>(
		env,
		`${githubContentPath(ARTICLE_ROOT.replace(/\/$/, ""), env)}?ref=${encodeURIComponent(ref)}`,
	);
	if (!Array.isArray(result)) throw new HttpError(502, "无法读取文章目录");
	return result;
}

async function requireSession(
	request: Request,
	env: Cloudflare.Env,
): Promise<void> {
	const authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer "))
		throw new HttpError(401, "请先登录");
	const [payload, signature, extra] = authorization.slice(7).split(".");
	if (
		!payload ||
		!signature ||
		extra ||
		!(await secureEqual(signature, await sign(payload, env.SESSION_SECRET)))
	) {
		throw new HttpError(401, "登录已失效");
	}

	try {
		const session = JSON.parse(decoder.decode(fromBase64Url(payload))) as {
			scope?: unknown;
		};
		if (session.scope !== "article:write") throw new Error("invalid scope");
	} catch {
		throw new HttpError(401, "登录已失效");
	}
}

const HITS_KEY = "hits:v1";

// 热度排序：按"累计量 + 近期活跃"综合加权，避免老文章靠累计量永久霸榜，
// 同时避免"最后一次阅读时间"完全压过累计量。
//
// 采用 Hacker News 的 gravity 形态：
//   score = max(count - 1, 0) / (ageHours + 2) ^ GRAVITY
//
// - ageHours 用 lastAt（最后一次被阅读）而非发布时间：老文章被重新阅读也能复活。
// - +2 是 HN 的平滑项，防止刚读过的文章出现除零/爆分。
// - GRAVITY 决定时间衰减强度。**不要照搬 Reddit 的 45000 秒槽位**：
//   Reddit 那套面向秒级活跃的新闻流，12.5 小时就 +1 分，
//   而 count 的 log10 量程只有 0~3，套到博客上会让"昨天读过 1 次"压过
//   "今天读过 1000 次"，票数几乎失效（排序退化成纯按 lastAt 排）。
//   取 GRAVITY=0.8 使时间差与票数量程匹配：
//     1 天未读 ≈ 需 4.4 倍票数追平；3 天 ≈ 12 倍；7 天 ≈ 28 倍。
//   即高票文章仍有分量，但被冷落一周后会被近期活跃文章超越。
//
// 参考：http://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html
// 注意：只影响返回列表的顺序，不改动 KV 里的 count 累计值，
// 因此前端显示的"总阅读量"语义不变，且本改动可随时回滚。
const GRAVITY = 0.8;
const HOUR_MS = 3600000;

function hotScore(hit: HitRecord): number {
	const votes = Math.max(hit.count - 1, 0);
	const ageHours = Math.max((Date.now() - hit.lastAt) / HOUR_MS, 0);
	return votes / Math.pow(ageHours + 2, GRAVITY);
}
function hitSlug(raw: unknown): string {
	if (typeof raw !== "string") throw new HttpError(400, "缺少文章标识");
	const slug = raw.trim();
	if (
		!slug ||
		slug.length > 240 ||
		/[\x00-\x1f\x7f/\\]/.test(slug) ||
		slug.includes("..")
	)
		throw new HttpError(400, "文章标识不合法");
	return slug;
}

async function readHits(env: Cloudflare.Env): Promise<Record<string, HitRecord>> {
	const raw = await env.HITS_KV.get(HITS_KEY, "json");
	return raw && typeof raw === "object" ? (raw as Record<string, HitRecord>) : {};
}

async function recordHit(
	request: Request,
	env: Cloudflare.Env,
	origin: string,
): Promise<Response> {
	const body = await readJson<{ slug?: string }>(request);
	const slug = hitSlug(body.slug ?? "");
	const hits = await readHits(env);
	const current = hits[slug] ?? { count: 0, lastAt: 0 };
	current.count += 1;
	current.lastAt = Date.now();
	hits[slug] = current;
	await env.HITS_KV.put(HITS_KEY, JSON.stringify(hits));
	return json({ count: current.count }, 200, origin, env);
}

async function listHits(env: Cloudflare.Env, origin: string): Promise<Response> {
	const hits = await readHits(env);
	// 返回体里保留 score：前端「热门文章」榜单必须用同一个排序键，
	// 否则前端只能拿 count 重排，会丢掉时间衰减（老文章靠累计量霸榜）。
	// 排序键与显示值分离：score 用于排序，count 仍是对外的"总阅读量"。
	const rows = Object.entries(hits)
		.map(([slug, hit]) => ({ slug, ...hit, score: hotScore(hit) }))
		.sort((a, b) => b.score - a.score || b.lastAt - a.lastAt);
	return json({ hits: rows }, 200, origin, env);
}

async function getArticle(
	url: URL,
	env: Cloudflare.Env,
	origin: string,
): Promise<Response> {
	const path = articlePath(url.searchParams.get("slug"));
	const article = await fetchGitHubContent(path, env, env.GITHUB_BRANCH);
	if (Array.isArray(article))
		throw new HttpError(404, "没有找到对应的文章文件");
	if (!article.sha || typeof article.content !== "string")
		throw new HttpError(502, "GitHub 返回的文章缺少内容或版本信息");
	const content = decodeBase64(article.content.replace(/\s/g, ""));
	return json({ content, sha: article.sha, path }, 200, origin, env);
}

async function fetchGitHubContent(
	path: string,
	env: Cloudflare.Env,
	ref: string,
): Promise<GitHubContent> {
	return githubRequest<GitHubContent>(
		env,
		`${githubContentPath(path, env)}?ref=${encodeURIComponent(ref)}`,
	);
}

async function fetchGitHubContentIfExists(
	path: string,
	env: Cloudflare.Env,
	ref: string,
): Promise<GitHubContent | null> {
	try {
		return await fetchGitHubContent(path, env, ref);
	} catch (error) {
		if (error instanceof HttpError && error.status === 404) return null;
		throw error;
	}
}

function articlePath(slug: unknown): string {
	if (typeof slug !== "string") throw new HttpError(400, "缺少文章标识");
	let normalized = slug
		.normalize("NFC")
		.replace(/\\/g, "/")
		.replace(/^\/+/, "");
	if (!normalized.endsWith(".md")) normalized += ".md";
	const segments = normalized.split("/");
	if (
		normalized.length > 240 ||
		segments.some(
			(segment) =>
				!segment ||
				segment === "." ||
				segment === ".." ||
				/[\0\r\n]/.test(segment),
		) ||
		!normalized.endsWith(".md") ||
		normalized.endsWith(".mdx")
	) {
		throw new HttpError(400, "文章路径不合法");
	}
	return `${ARTICLE_ROOT}${normalized}`;
}

function validateMarkdown(content: string): void {
	if (!content.startsWith("---\n") && !content.startsWith("---\r\n"))
		throw new HttpError(400, "文章必须包含 Frontmatter");
	const normalized = content.replace(/\r\n/g, "\n");
	const end = normalized.indexOf("\n---", 4);
	if (end < 0 || end > 20_000)
		throw new HttpError(400, "Frontmatter 格式不正确");
	if (!/^title\s*:/m.test(normalized.slice(4, end)))
		throw new HttpError(400, "Frontmatter 缺少 title");
	// 兜底：blob: 地址只在单个浏览器会话内有效，写进文章即成死链
	// （历史上曾因此导致"粘贴图片保存后消失"）。服务端最终防线，
	// 防止任何前端漏网路径把 blob: 带进仓库。
	if (/!\[[^\]]*\]\(blob:/m.test(normalized))
		throw new HttpError(
			400,
			"文章中包含 blob: 临时图片地址（本会话预览用，无法长期访问）。请刷新编辑器后重新粘贴图片再保存。",
		);
}

function updateFrontmatterDate(content: string): string {
	const newline = content.includes("\r\n") ? "\r\n" : "\n";
	const normalized = content.replace(/\r\n/g, "\n");
	const end = normalized.indexOf("\n---", 4);
	const date = new Date().toISOString().slice(0, 10);
	let frontmatter = normalized.slice(4, end);
	if (/^updated\s*:/m.test(frontmatter))
		frontmatter = frontmatter.replace(/^updated\s*:.*$/m, `updated: ${date}`);
	else frontmatter = `${frontmatter.replace(/\n$/, "")}\nupdated: ${date}`;
	return `---\n${frontmatter}${normalized.slice(end)}`.replace(/\n/g, newline);
}

function githubContentPath(path: string, env: Cloudflare.Env): string {
	const encodedPath = path.split("/").map(encodeURIComponent).join("/");
	return `/repos/${repoPath(env)}/contents/${encodedPath}`;
}

function repoPath(env: Cloudflare.Env): string {
	return `${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`;
}

async function githubRequest<T = unknown>(
	env: Cloudflare.Env,
	path: string,
	init: RequestInit = {},
	conflictStatus?: number,
): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set("Accept", "application/vnd.github+json");
	headers.set("Authorization", `Bearer ${env.GITHUB_TOKEN}`);
	headers.set("User-Agent", "dayu-study-editor/1.0");
	headers.set("X-GitHub-Api-Version", "2022-11-28");
	if (init.body) headers.set("Content-Type", "application/json");
	const response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
	const text = await response.text();
	let result: T & { message?: string };
	try {
		result = JSON.parse(text) as T & { message?: string };
	} catch {
		throw new HttpError(
			502,
			`GitHub 返回了无法解析的数据（status=${response.status}, type=${response.headers.get("Content-Type") || "none"}, body=${JSON.stringify(text.slice(0, 300))}）`,
		);
	}
	if (!response.ok) {
		const status =
			response.status === 404
				? 404
				: conflictStatus && [409, 422].includes(response.status)
					? conflictStatus
					: 502;
		throw new HttpError(
			status,
			status === 409
				? "远端分支已发生变化，请重新读取后再更新"
				: result.message || "GitHub 请求失败",
		);
	}
	return result;
}

async function readJson<T>(request: Request): Promise<T> {
	if (
		!request.headers
			.get("Content-Type")
			?.toLowerCase()
			.startsWith("application/json")
	)
		throw new HttpError(415, "仅支持 JSON 请求");
	try {
		return (await request.json()) as T;
	} catch {
		throw new HttpError(400, "JSON 格式不正确");
	}
}

async function sign(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return toBase64Url(
		new Uint8Array(
			await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
		),
	);
}

async function secureEqual(left: string, right: string): Promise<boolean> {
	const [leftHash, rightHash] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(left)),
		crypto.subtle.digest("SHA-256", encoder.encode(right)),
	]);
	const a = new Uint8Array(leftHash);
	const b = new Uint8Array(rightHash);
	let difference = a.length ^ b.length;
	for (let index = 0; index < Math.max(a.length, b.length); index++)
		difference |= (a[index] || 0) ^ (b[index] || 0);
	return difference === 0;
}

function decodeBase64(value: string): string {
	try {
		const binary = atob(value);
		const bytes = Uint8Array.from(binary, (character) =>
			character.charCodeAt(0),
		);
		return decoder.decode(bytes);
	} catch {
		throw new HttpError(502, "文章编码无效");
	}
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
	const base64 = value
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function handleOptions(origin: string | null, env: Cloudflare.Env): Response {
	if (origin !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403 });
	return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(
	data: unknown,
	status: number,
	origin: string | null,
	env: Cloudflare.Env,
): Response {
	const headers = new Headers({
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
	});
	if (origin === env.ALLOWED_ORIGIN)
		for (const [name, value] of Object.entries(corsHeaders(origin)))
			headers.set(name, value);
	return Response.json(data, { status, headers });
}

function corsHeaders(origin: string): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
		"Access-Control-Allow-Headers": "Authorization,Content-Type",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}
