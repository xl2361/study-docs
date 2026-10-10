import { Extension } from "@tiptap/core";

/**
 * 代码块内的 Ctrl+A / Cmd+A：只选中当前代码块的文本内容（两级全选的第一级）。
 * 光标不在代码块内、或已经全选了代码块内容时返回 false，
 * 放行给默认行为（第二级 = 全选整篇文档）。
 */
export const SelectAllInCodeBlock = Extension.create({
	name: "selectAllInCodeBlock",

	addKeyboardShortcuts() {
		return {
			"Mod-a": () => {
				const { state } = this.editor;
				const { $from } = state.selection;
				for (let d = $from.depth; d > 0; d--) {
					if ($from.node(d).type.name !== "codeBlock") continue;
					// 代码块文本范围：节点内容位于 before+1 与 after-1 之间
					const start = $from.before(d) + 1;
					const end = $from.after(d) - 1;
					if (state.selection.from === start && state.selection.to === end) {
						// 已全选代码块 → 让默认行为接管（全选全文）
						return false;
					}
					return this.editor.commands.setTextSelection({
						from: start,
						to: end,
					});
				}
				return false;
			},
		};
	},
});
