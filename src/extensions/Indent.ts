import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "prosemirror-state";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		indent: {
			indent: () => ReturnType;
			outdent: () => ReturnType;
		};
	}
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const Indent = Extension.create({
	name: "indent",

	addOptions() {
		return {
			types: ["paragraph", "listItem"],
			minIndent: 0,
			maxIndent: 8,
		};
	},

	addGlobalAttributes() {
		return [
			{
				types: this.options.types,
				attributes: {
					indent: {
						default: 0,
						parseHTML: (element) =>
							Number(element.getAttribute("data-indent") || 0),
						renderHTML: (attributes) =>
							attributes.indent > 0 ? { "data-indent": attributes.indent } : {},
					},
				},
			},
		];
	},

	addCommands() {
		const applyIndent =
			(delta: number) => (tr: Transaction, state: EditorState) => {
				const { from, to } = state.selection;
				let changed = false;
				state.doc.nodesBetween(
					from,
					to,
					(
						node: {
							type: { name: string };
							attrs: Record<string, unknown>;
						},
						pos: number,
					) => {
						if (this.options.types.includes(node.type.name)) {
							const current = Number(node.attrs.indent ?? 0);
							const next = clamp(
								current + delta,
								this.options.minIndent,
								this.options.maxIndent,
							);
							if (next !== current) {
								tr.setNodeMarkup(pos, undefined, {
									...node.attrs,
									indent: next,
								});
								changed = true;
							}
						}
					},
				);
				return changed;
			};
		return {
			indent:
				() =>
				({ tr, state }) =>
					applyIndent(1)(tr, state),
			outdent:
				() =>
				({ tr, state }) =>
					applyIndent(-1)(tr, state),
		};
	},
});
