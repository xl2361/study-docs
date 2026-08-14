import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "prosemirror-state";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		lineHeight: {
			setLineHeight: (lineHeight: string) => ReturnType;
			unsetLineHeight: () => ReturnType;
		};
	}
}

export const LineHeight = Extension.create({
	name: "lineHeight",

	addOptions() {
		return {
			types: ["paragraph", "heading"],
		};
	},

	addGlobalAttributes() {
		return [
			{
				types: this.options.types,
				attributes: {
					lineHeight: {
						default: null,
						parseHTML: (element: HTMLElement) =>
							element.style.lineHeight || null,
						renderHTML: (attributes: { lineHeight?: string | null }) =>
							attributes.lineHeight
								? { style: `line-height: ${attributes.lineHeight}` }
								: {},
					},
				},
			},
		];
	},

	addCommands() {
		const apply =
			(lineHeight: string | null) => (tr: Transaction, state: EditorState) => {
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
						if (!this.options.types.includes(node.type.name)) return;
						if ((node.attrs.lineHeight ?? null) === lineHeight) return;
						tr.setNodeMarkup(pos, undefined, {
							...node.attrs,
							lineHeight,
						});
						changed = true;
					},
				);
				return changed;
			};

		return {
			setLineHeight:
				(lineHeight) =>
				({ tr, state }) =>
					apply(lineHeight)(tr, state),
			unsetLineHeight:
				() =>
				({ tr, state }) =>
					apply(null)(tr, state),
		};
	},
});
