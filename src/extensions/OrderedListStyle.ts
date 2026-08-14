import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		orderedListStyle: {
			setOrderedListStyle: (style: string) => ReturnType;
		};
	}
}

export const OrderedListStyle = Extension.create({
	name: "orderedListStyle",

	addGlobalAttributes() {
		return [
			{
				types: ["orderedList"],
				attributes: {
					listStyle: {
						default: "mixed",
						parseHTML: (element: HTMLElement) =>
							element.getAttribute("data-list-style") ||
							element.style.listStyleType ||
							"mixed",
						renderHTML: (attributes: { listStyle?: string }) =>
							attributes.listStyle
								? { "data-list-style": attributes.listStyle }
								: {},
					},
				},
			},
		];
	},

	addCommands() {
		return {
			setOrderedListStyle:
				(style) =>
				({ chain, editor }) => {
					const c = chain() as unknown as {
						toggleOrderedList: () => void;
						updateAttributes: (
							name: string,
							attrs: Record<string, unknown>,
						) => { run: () => boolean };
					};
					if (!editor.isActive("orderedList")) c.toggleOrderedList();
					return c.updateAttributes("orderedList", { listStyle: style }).run();
				},
		};
	},
});
