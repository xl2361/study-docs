import { visit } from "unist-util-visit";
import { readFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 为文章正文中的 <img>（src 指向 public/uploads 或 src/assets）补充
 * width/height 属性，让浏览器在图片加载前就预留占位高度，消除图片懒
 * 加载撑开容器导致的布局跳动。
 *
 * 仅处理无 width/height 的 <img>；跳过已有尺寸的（如 astro:assets 输出）。
 * 从文件头读取 PNG/JPEG/WebP/GIF 的真实宽高，不依赖第三方库。
 */
export default function rehypeImageDimensions() {
	const projectRoot = resolve(fileURLToPath(import.meta.url), "../../..");
	const publicDir = join(projectRoot, "public");

	// 简易尺寸缓存，同一图片只读一次
	const dimCache = new Map();

	function readImageDimensions(src) {
		if (dimCache.has(src)) return dimCache.get(src);
		let result = null;
		try {
			let filePath;
			if (src.startsWith("/uploads/") || src.startsWith("/images/")) {
				filePath = join(publicDir, src);
			} else if (src.startsWith("/")) {
				filePath = join(publicDir, src);
			} else {
				filePath = null; // 外链图片无法本地读取
			}
			if (filePath) {
				const ext = extname(filePath).toLowerCase();
				const buf = readFileSync(filePath);
				const dim = parseDimensions(buf, ext);
				if (dim) result = dim;
			}
		} catch (e) {
			// 读不到就跳过，不阻塞构建
		}
		dimCache.set(src, result);
		return result;
	}

	function parseDimensions(buf, ext) {
		// PNG: bytes 16-24 = width/height (big-endian uint32)
		if (ext === ".png" && buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
			return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
		}
		// JPEG: 扫描 SOF0/SOF2 标记
		if (ext === ".jpg" || ext === ".jpeg") {
			return parseJpeg(buf);
		}
		// GIF: bytes 6-9 = width/height (little-endian uint16)
		if (ext === ".gif" && buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49) {
			return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
		}
		// WebP: RIFF....WEBP, 不同格式解析
		if (ext === ".webp" && buf.length >= 30 && buf[0] === 0x52 && buf[8] === 0x57) {
			return parseWebp(buf);
		}
		return null;
	}

	function parseJpeg(buf) {
		let i = 2;
		while (i < buf.length) {
			if (buf[i] !== 0xff) { i++; continue; }
			const marker = buf[i + 1];
			// SOF0 (0xC0) ~ SOF15 (0xCF)，排除 SOF4/8/12（差分）
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
				const height = buf.readUInt16BE(i + 5);
				const width = buf.readUInt16BE(i + 7);
				return { width, height };
			}
			// 跳到下一个标记
			const len = buf.readUInt16BE(i + 2);
			i += 2 + len;
		}
		return null;
	}

	function parseWebp(buf) {
		const fourcc = buf.toString("ascii", 12, 16);
		if (fourcc === "VP8 ") {
			// VP8 (lossy): 26-29 width, 30-33 height (little-endian uint16 + flag)
			return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
		}
		if (fourcc === "VP8L") {
			// VP8L (lossless): 21-24 含 14 bit width, 14 bit height
			const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
			const width = 1 + ((b1 & 0x3f) << 8 | b0);
			const height = 1 + ((b3 & 0x0f) << 10 | b2 << 2 | (b1 >> 6));
			return { width, height };
		}
		if (fourcc === "VP8X") {
			// VP8X (extended): 24-27 width-1, 28-31 height-1 (24-bit little-endian)
			const width = 1 + (buf[24] | buf[25] << 8 | buf[26] << 16);
			const height = 1 + (buf[27] | buf[28] << 8 | buf[29] << 16);
			return { width, height };
		}
		return null;
	}

	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "img") return;
			// 跳过已有 width/height 的图片
			if (node.properties?.width && node.properties?.height) return;
			const src = node.properties?.src;
			if (!src || typeof src !== "string") return;
			// 只处理本地 / 开头的图片
			if (!src.startsWith("/")) return;
			// 跳过 plantuml（由专门插件处理）
			const cls = node.properties?.className;
			const classNames = Array.isArray(cls) ? cls : typeof cls === "string" ? cls.split(/\s+/) : [];
			if (classNames.includes("plantuml-image")) return;

			const dim = readImageDimensions(src);
			if (dim) {
				node.properties.width = dim.width;
				node.properties.height = dim.height;
			}
		});
	};
}
