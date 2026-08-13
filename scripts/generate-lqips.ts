// LQIP 方案来源: https://blog.cosine.ren/post/astro-lqip-implementation

import crypto from "node:crypto";
import sharp from "sharp";
import { glob } from "glob";
import fs from "fs/promises";
import path from "path";

const SRC_DIR = "src";
const PUBLIC_DIR = "public";
const OUTPUT_FILE = "src/constants/lqips.json";
const HASH_FILE = "src/constants/lqips.hash.json";
// 需要忽略的目录（相对于项目根目录）
const IGNORE_DIRS = [
	"public/favicon/**",
	"public/pio/**",
	"public/assets/images/effects/**",
	"public/assets/music/**",
];

interface RgbColor {
	r: number;
	g: number;
	b: number;
}

type LqipMap = Record<string, string>;
type HashMap = Record<string, string>;

function fileHash(content: Buffer): string {
	return crypto.createHash("sha1").update(content).digest("hex");
}

function rgbToHex(color: RgbColor): string {
	const hex = (n: number) => n.toString(16).padStart(2, "0");
	return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

async function processImage(imagePath: string): Promise<string | null> {
	try {
		const { data, info } = await sharp(imagePath)
			.resize(2, 2, { fit: "fill" })
			.raw()
			.toBuffer({ resolveWithObject: true });

		const channels = info.channels;
		const colors: RgbColor[] = [];

		for (let i = 0; i < 4; i++) {
			const offset = i * channels;
			colors.push({
				r: data[offset],
				g: data[offset + 1],
				b: data[offset + 2],
			});
		}

		// 使用 corners[0], [1], [3] 生成 135deg 斜向渐变
		const compact = `${rgbToHex(colors[0]).slice(1)}${rgbToHex(colors[1]).slice(1)}${rgbToHex(colors[3]).slice(1)}`;
		return compact;
	} catch (error) {
		console.error(`Error processing ${imagePath}:`, error);
		return null;
	}
}

function filePathToKey(filePath: string): string {
	if (filePath.startsWith(PUBLIC_DIR)) {
		return `public:${path.relative(PUBLIC_DIR, filePath).replace(/\\/g, "/")}`;
	}
	return `src:${path.relative(SRC_DIR, filePath).replace(/\\/g, "/")}`;
}

async function main() {
	// 读取已有的 lqips.json
	let existingLqips: LqipMap = {};
	try {
		const content = await fs.readFile(OUTPUT_FILE, "utf-8");
		existingLqips = JSON.parse(content);
		console.log(
			`Loaded ${Object.keys(existingLqips).length} existing entries from ${OUTPUT_FILE}`,
		);
	} catch {
		console.log(`No existing ${OUTPUT_FILE} found, will create new.`);
	}

	// 读取已有的内容哈希（跨构建检测图片文件是否变更）
	let existingHashes: HashMap = {};
	try {
		const content = await fs.readFile(HASH_FILE, "utf-8");
		existingHashes = JSON.parse(content);
		console.log(
			`Loaded ${Object.keys(existingHashes).length} hashes from ${HASH_FILE}`,
		);
	} catch {
		console.log(`No existing ${HASH_FILE} found, will re-check all images.`);
	}

	const files = await glob("{src,public}/**/*.{png,jpg,jpeg,webp,avif}", {
		ignore: IGNORE_DIRS,
	});

	if (files.length === 0) {
		console.log("No image files found.");
		return;
	}

	// 移除已不存在的图片数据
	const currentKeys = new Set(files.map((file) => filePathToKey(file)));
	const removedKeys = Object.keys(existingLqips).filter(
		(key) => !currentKeys.has(key),
	);
	for (const key of removedKeys) {
		delete existingLqips[key];
		delete existingHashes[key];
	}
	if (removedKeys.length > 0) {
		console.log(
			`Removed ${removedKeys.length} stale entries: ${removedKeys.join(", ")}`,
		);
	}

	// 只处理新增或内容发生变化的图片，其余复用现有数据
	const newFiles: string[] = [];
	let unchanged = 0;
	for (const file of files) {
		const key = filePathToKey(file);
		if (!(key in existingLqips)) {
			newFiles.push(file);
			continue;
		}
		let hash: string | null = null;
		try {
			hash = fileHash(await fs.readFile(file));
		} catch {
			newFiles.push(file);
			continue;
		}
		if (existingHashes[key] === hash) {
			unchanged++;
		} else {
			newFiles.push(file);
		}
	}

	console.log(
		`Found ${files.length} images, ${newFiles.length} new to process, ${unchanged} unchanged.`,
	);

	const lqips: LqipMap = { ...existingLqips };
	const hashes: HashMap = { ...existingHashes };
	let processed = 0;

	if (newFiles.length > 0) {
		for (const file of newFiles) {
			const filePath = path.resolve(file);
			process.stdout.write(
				`\rProcessing ${processed + 1}/${newFiles.length}...`,
			);
			const compact = await processImage(filePath);
			if (compact !== null) {
				const key = filePathToKey(file);
				lqips[key] = compact;
				try {
					hashes[key] = fileHash(await fs.readFile(filePath));
				} catch {
					hashes[key] = "";
				}
				processed++;
			}
		}
	}

	const dir = path.dirname(OUTPUT_FILE);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(OUTPUT_FILE, JSON.stringify(lqips, null, 2), "utf-8");
	await fs.writeFile(HASH_FILE, JSON.stringify(hashes, null, 2), "utf-8");

	console.log(
		`\nDone! Processed ${processed}/${newFiles.length} new images. Total: ${Object.keys(lqips).length}. Output: ${OUTPUT_FILE}`,
	);
}

main();
