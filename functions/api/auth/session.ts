export const onRequestGet: PagesFunction = async () =>
	Response.json(
		{ authenticated: true },
		{ headers: { "Cache-Control": "no-store" } },
	);
