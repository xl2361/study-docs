import { visit } from "unist-util-visit";

/**
 * 为文章正文中的 <img> 添加 loading="lazy" 与 decoding="async"：
 * 打开长文时不再一次性发起全部图片请求（此前 DBeaver 一页 25 张并发，
 * 门禁放行后依旧会占满带宽拖慢首屏），改为滚动到视口附近再加载。
 *
 * 跳过作者显式写了 loading 属性的图片（尊重手动控制 eager/fetchpriority），
 * 跳过 plantuml（由专门插件处理）。
 */
export default function rehypeLazyImages() {
	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "img") return;
			const props = node.properties;
			if (!props || props.loading) return;
			// 跳过 plantuml（由专门插件处理）
			const cls = props.className;
			const classNames = Array.isArray(cls)
				? cls
				: typeof cls === "string"
					? cls.split(/\s+/)
					: [];
			if (classNames.includes("plantuml-image")) return;
			props.loading = "lazy";
			props.decoding = "async";
		});
	};
}
