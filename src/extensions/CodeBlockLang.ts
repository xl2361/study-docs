import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		codeBlockLang: {
			setCodeBlockLanguage: (language: string) => ReturnType;
		};
	}
}

export const CodeBlockLang = Node.create({
	name: "codeBlock",

	group: "block",

	content: "text*",

	marks: "",

	code: true,

	addAttributes() {
		return {
			language: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-language"),
				renderHTML: (attributes) => {
					if (!attributes.language) return {};
					return {
						"data-language": attributes.language,
					};
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: "pre",
				preserveWhitespace: "full",
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			"pre",
			mergeAttributes(HTMLAttributes, {
				"data-language": node.attrs.language || "",
			}),
			["code", 0],
		];
	},

	addCommands() {
		return {
			setCodeBlockLanguage:
				(language) =>
				({ commands }) =>
					commands.updateAttributes("codeBlock", { language }),
		};
	},
});
