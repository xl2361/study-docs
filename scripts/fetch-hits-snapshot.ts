/**
 * 构建前拉取「文章热度快照」
 *
 * 背景：首页是构建期静态生成的，而热度（打开次数）是运行时数据，存在
 * editor-worker 的 KV 里、由 /api/hits 暴露。构建时必须先拿到快照，
 * 才能在构建期按热度排序。
 *
 * 输出：src/constants/hits-snapshot.json
 *   { "generatedAt": "<ISO>", "source": "remote" | "cache" | "empty",
 *     "hits": { "<slug>": <count> } }
 *
 * 降级策略（CI 里最重要）：
 *   1. 拉取成功 → 写快照
 *   2. 拉取失败但已有旧快照 → 保留旧快照继续构建（不中断 CI）
 *   3. 拉取失败且无旧快照 → 写空快照（排序退回标题序），构建仍可完成
 *
 * 注意：只在构建期跑，不参与运行时；不写入任何密钥。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT_PATH = "src/constants/hits-snapshot.json";
const HITS_URL = "https://dayu-study-editor.dayu2360.workers.dev/api/hits";
const TIMEOUT_MS = 20_000;
// 站点门禁要求同源 Origin，否则 worker 会 403
const ORIGIN = "https://dayu-study.pages.dev";

interface Snapshot {
	generatedAt: string;
	source: "remote" | "cache" | "empty";
	hits: Record<string, number>;
}

function writeSnapshot(snapshot: Snapshot): void {
	const dir = dirname(OUT_PATH);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(OUT_PATH, `${JSON.stringify(snapshot, null, "\t")}\n`, "utf8");
}

function readCache(): Snapshot | null {
	try {
		if (!existsSync(OUT_PATH)) return null;
		const parsed = JSON.parse(readFileSync(OUT_PATH, "utf8")) as Snapshot;
		if (parsed && typeof parsed === "object" && parsed.hits) return parsed;
		return null;
	} catch {
		return null;
	}
}

async function fetchHits(): Promise<Record<string, number> | null> {
	try {
		const response = await fetch(HITS_URL, {
			headers: { Accept: "application/json", Origin: ORIGIN },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) {
			console.warn(
				`[hits-snapshot] 接口返回 ${response.status}，改用旧快照/空快照`,
			);
			return null;
		}
		const data = (await response.json()) as {
			hits?: Array<{ slug?: unknown; count?: unknown }>;
		};
		const rows = Array.isArray(data?.hits) ? data.hits : [];
		const hits: Record<string, number> = {};
		for (const row of rows) {
			if (!row || typeof row.slug !== "string") continue;
			const count = Number(row.count);
			if (!Number.isFinite(count) || count <= 0) continue;
			hits[row.slug] = count;
		}
		return hits;
	} catch (error) {
		console.warn(
			`[hits-snapshot] 拉取失败：${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

async function main(): Promise<void> {
	const hits = await fetchHits();

	if (hits && Object.keys(hits).length > 0) {
		writeSnapshot({
			generatedAt: new Date().toISOString(),
			source: "remote",
			hits,
		});
		console.log(
			`[hits-snapshot] 已写入 ${Object.keys(hits).length} 条热度数据（remote）`,
		);
		return;
	}

	const cache = readCache();
	if (cache && Object.keys(cache.hits).length > 0) {
		console.log(
			`[hits-snapshot] 沿用旧快照（cache，生成于 ${cache.generatedAt}，${Object.keys(cache.hits).length} 条）`,
		);
		return;
	}

	writeSnapshot({
		generatedAt: new Date().toISOString(),
		source: "empty",
		hits: {},
	});
	console.warn(
		"[hits-snapshot] 无可用热度数据，写入空快照；首页将退回按标题排序",
	);
}

void main();
