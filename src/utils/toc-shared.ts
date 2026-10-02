/**
 * TOC 共享逻辑（无 DOM 依赖，服务端/客户端通用）
 *
 * 服务端：SidebarTOC.astro / FloatingTOC.astro 用 Astro 的 headings 计算目录项。
 * 客户端：TOCManager 用 DOM 遍历得到的 headings 计算目录项。
 * 两端都调用 computeTocItems，保证结构完全一致。
 */

export interface TocInput {
	/** 标题层级（h1=1, h2=2, ...） */
	depth: number;
	/** 标题锚点 id（等于渲染后 heading 的 id） */
	slug: string;
	/** 标题纯文本 */
	text: string;
}

export interface TocItem {
	headingId: string;
	href: string;
	/** 0=最浅层, 1=次层, 2=更深层，对应 .toc-level-* */
	depthLevel: 0 | 1 | 2;
	/** index=编号徽章, dot=圆点, dot-sm=小圆点 */
	badgeKind: "index" | "dot" | "dot-sm";
	/** badgeKind 为 index 时的编号（从 1 递增） */
	badgeIndex?: number;
	text: string;
	labelPrimary: boolean;
}

/**
 * 阿拉伯数字转中文数字（用于 h2 级目录编号，与正文 cjk-ideographic 对齐）。
 * 例：1→一 10→十 11→十一 20→二十 21→二十一 100→一百
 */
export function toChineseNumber(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return String(n);
	const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
	if (n < 10) return digits[n];
	if (n < 20) return n === 10 ? "十" : `十${digits[n % 10]}`;
	if (n < 100) {
		const tens = Math.floor(n / 10);
		const ones = n % 10;
		return `${digits[tens]}十${ones ? digits[ones] : ""}`;
	}
	if (n < 1000) {
		const hundreds = Math.floor(n / 100);
		const rest = n % 100;
		if (rest === 0) return `${digits[hundreds]}百`;
		if (rest < 10) return `${digits[hundreds]}百零${digits[rest]}`;
		/* 110 → 一百一十（不是"一百十"），与中文习惯一致 */
		if (rest < 20)
			return `${digits[hundreds]}百一十${rest % 10 ? digits[rest % 10] : ""}`;
		return `${digits[hundreds]}百${toChineseNumber(rest)}`;
	}
	return String(n);
}

/**
 * 根据标题列表计算目录项。
 * 复刻 TOCManager 里的 calculateMinDepth + filterHeadings + 深度/徽章逻辑。
 *
 * 编号：正文标题的手写序号已剥离，改由 CSS counter 生成（main.css）：
 *   h2 → 一、二、（cjk-ideographic）
 *   h3 → 1、2、（每个 h2 重置）
 *   h4 → {h3序号}.{h4序号} （每个 h3 重置）
 * TOC 是纯文本渲染拿不到伪元素，故在此按【绝对层级】复刻同一套计数规则，
 * 保证与正文编号完全一致（文章从 h3 起步时也不偏移）。
 */
export function computeTocItems(
	headings: TocInput[],
	opts: { maxLevel: number },
): TocItem[] {
	if (!headings || headings.length === 0) return [];

	// 计算最小深度
	let minDepth = 10;
	for (const h of headings) {
		minDepth = Math.min(minDepth, h.depth);
	}

	// 过滤：depth < minDepth + maxLevel
	const filtered = headings.filter((h) => h.depth < minDepth + opts.maxLevel);

	const items: TocItem[] = [];
	// 徽章序号（视觉层用，保留旧语义）
	let indexCount = 1;
	// 与正文 CSS counter 完全同构的绝对层级计数器
	let h2Count = 0;
	let h3Count = 0;
	let h4Count = 0;

	for (const h of filtered) {
		const depth = h.depth;
		// 先按文档顺序推进 CSS 同构计数器——无锚点的标题在正文里同样计数，
		// 跳过它会让后续编号整体偏移
		let prefix: string;
		if (depth <= 2) {
			h2Count++;
			h3Count = 0;
			h4Count = 0;
			prefix = depth === 2 ? `${toChineseNumber(h2Count)}、` : "";
		} else if (depth === 3) {
			h3Count++;
			h4Count = 0;
			prefix = `${h3Count}、`;
		} else if (depth === 4) {
			h4Count++;
			prefix = `${h3Count}.${h4Count} `;
		} else {
			// h5/h6：正文 CSS 不编号，目录同样不加前缀
			prefix = "";
		}

		// 跳过没有锚点的标题（计数已在上面完成，不参与列表项）
		if (!h.slug) continue;

		const depthLevel: 0 | 1 | 2 =
			depth === minDepth ? 0 : depth === minDepth + 1 ? 1 : 2;

		let badgeKind: "index" | "dot" | "dot-sm";
		let badgeIndex: number | undefined;
		if (depth === minDepth) {
			badgeKind = "index";
			badgeIndex = indexCount;
			indexCount++;
		} else if (depth === minDepth + 1) {
			badgeKind = "dot";
		} else {
			badgeKind = "dot-sm";
		}

		// 空文本回退成 slug；去掉 rehypeAutolinkHeadings 追加的尾部 "#"
		const raw = (h.text || "").replace(/#+\s*$/, "").trim() || h.slug;
		const text = `${prefix}${raw}`;

		items.push({
			headingId: h.slug,
			href: `#${h.slug}`,
			depthLevel,
			badgeKind,
			badgeIndex,
			text,
			labelPrimary: depth <= minDepth + 1,
		});
	}

	return items;
}

/**
 * 转义 HTML 属性值，避免标题中的引号破坏属性
 */
export function escapeHtmlAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * 徽章内部 HTML（客户端字符串拼接用）
 */
export function renderBadgeInnerHTML(item: TocItem): string {
	if (item.badgeKind === "index") return String(item.badgeIndex ?? "");
	if (item.badgeKind === "dot") return '<span class="toc-badge-dot"></span>';
	return '<span class="toc-badge-dot toc-badge-dot-sm"></span>';
}

/**
 * 生成单个目录项 HTML（客户端 fallback 路径用）。
 * 结构与 SidebarTOC.astro / FloatingTOC.astro 的 SSR 输出保持一致。
 */
export function renderTocItemHTML(item: TocItem): string {
	const escapedText = escapeHtmlAttr(item.text);
	const escapedHeadingId = escapeHtmlAttr(item.headingId);
	const escapedHref = escapeHtmlAttr(item.href);
	return `
        <a
		  href="${escapedHref}"
		  class="toc-item toc-level-${item.depthLevel}"
		  data-heading-id="${escapedHeadingId}"
		  aria-label="${escapedText}"
		  title="${escapedText}"
        >
			  <div class="toc-badge ${item.badgeKind === "index" ? "toc-badge-index" : ""}">
            ${renderBadgeInnerHTML(item)}
          </div>
			  <div class="toc-label ${item.labelPrimary ? "toc-label-primary" : "toc-label-secondary"}">${escapedText}</div>
        </a>
      `;
}
