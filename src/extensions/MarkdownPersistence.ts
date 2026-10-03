import type { JSONContent } from "@tiptap/core";
import { OrderedList } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import { TextStyle } from "@tiptap/extension-text-style";

/**
 * 让「字号 / 颜色 / 段落行高 / 有序列表样式」能持久化到 markdown。
 *
 * 背景：这些样式原本只写进节点/mark 属性（渲染为 HTML 内联样式），
 * 而 @tiptap/markdown 对没有 renderMarkdown 的类型会直接丢弃 → 保存后丢失。
 *
 * 编码方式：序列化为内联 HTML（阅读端 Astro 会原样输出原始 HTML，
 * 已验证 <span style> / <p style> / <ol style> 均可正常渲染）：
 *   textStyle(fontSize/color) → <span style="font-size:..;color:..">
 *   paragraph(lineHeight)     → <p style="line-height:..">
 *   orderedList(listStyle)    → <ol data-list-style=".." style="list-style-type:.."><li>..</li></ol>
 *
 * 回读：编辑器各扩展的 parseHTML 已能从这些内联样式/属性还原对应属性，
 * 因此保存→重新打开可完整往返。
 *
 * 注意：标题（heading）行高不做 HTML 持久化——阅读端无 rehype-raw，
 * 原始 HTML 里的 <h2> 拿不到锚点 id，会破坏目录。故 LineHeight 类型已收敛为仅 paragraph。
 */

type MarkdownHelpers = {
	renderChildren: (
		nodes: JSONContent | JSONContent[],
		separator?: string,
	) => string;
};

type MarkdownContext = {
	previousNode?: JSONContent | null;
};

const EMPTY_PARAGRAPH_MARKDOWN = "&nbsp;";

/** textStyle 标记：把字号 / 颜色序列化为内联 <span style> */
export const StyledTextStyle = TextStyle.extend({
	renderMarkdown: (node: JSONContent, h: MarkdownHelpers) => {
		const attrs = node.attrs ?? {};
		const styles: string[] = [];
		if (typeof attrs.fontSize === "string" && attrs.fontSize)
			styles.push(`font-size:${attrs.fontSize}`);
		if (typeof attrs.color === "string" && attrs.color)
			styles.push(`color:${attrs.color}`);
		const inner = h.renderChildren(node.content ?? []);
		if (styles.length === 0) return inner;
		return `<span style="${styles.join(";")}">${inner}</span>`;
	},
});

/** 段落：行高序列化为 <p style="line-height:..">；无行高时保持默认行为 */
export const StyledParagraph = Paragraph.extend({
	renderMarkdown: (
		node: JSONContent,
		h: MarkdownHelpers,
		ctx?: MarkdownContext,
	) => {
		if (!node) return "";
		const content = Array.isArray(node.content) ? node.content : [];
		const lineHeight = node.attrs?.lineHeight;

		if (content.length === 0) {
			const prevContent = Array.isArray(ctx?.previousNode?.content)
				? (ctx?.previousNode?.content as JSONContent[])
				: [];
			const prevIsEmptyParagraph =
				ctx?.previousNode?.type === "paragraph" && prevContent.length === 0;
			const empty = prevIsEmptyParagraph ? EMPTY_PARAGRAPH_MARKDOWN : "";
			return lineHeight
				? `<p style="line-height:${lineHeight}">${empty || "&nbsp;"}</p>`
				: empty;
		}

		const inner = h.renderChildren(content);
		return lineHeight
			? `<p style="line-height:${lineHeight}">${inner}</p>`
			: inner;
	},
});

/** 有序列表样式 → 阅读端 list-style-type（hierarchical 用 CSS 计数器，见 markdown.css） */
const LIST_STYLE_CSS: Record<string, string> = {
	mixed: "decimal",
	cjk: "cjk-ideographic",
	hierarchical: "", // 由 markdown.css 的 counter 规则渲染，不能写内联 list-style-type
};

/** 有序列表：非默认样式序列化为 <ol data-list-style=.. style=..> + <li> 项 */
export const StyledOrderedList = OrderedList.extend({
	renderMarkdown: (node: JSONContent, h: MarkdownHelpers) => {
		if (!node.content) return "";
		const listStyle =
			typeof node.attrs?.listStyle === "string" ? node.attrs.listStyle : "";
		const css = LIST_STYLE_CSS[listStyle];
		if (css === undefined || listStyle === "mixed") {
			// mixed 是默认样式，走原生 markdown 列表，保证兼容与嵌套
			return h.renderChildren(node.content, "\n");
		}
		const styleAttr = css ? ` style="list-style-type:${css}"` : "";
		const items = (node.content as JSONContent[]).map((item) => {
			const inner = h.renderChildren(item.content ?? [], "\n").trim();
			return `<li>${inner}</li>`;
		});
		return [
			`<ol data-list-style="${listStyle}"${styleAttr}>`,
			...items,
			"</ol>",
		].join("\n");
	},
});
