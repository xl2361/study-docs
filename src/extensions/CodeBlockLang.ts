import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		codeBlockLang: {
			setCodeBlockLanguage: (language: string) => ReturnType;
		};
	}
}

export const CodeBlockLang = Extension.create({
	name: "codeBlockLang",

	addGlobalAttributes() {
		return [
			{
				types: ["codeBlock"],
				attributes: {
					language: {
						default: null,
						parseHTML: (element: HTMLElement) =>
							element.getAttribute("data-language"),
						renderHTML: (attributes: { language?: string | null }) =>
							attributes.language
								? { "data-language": attributes.language }
								: {},
					},
				},
			},
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
