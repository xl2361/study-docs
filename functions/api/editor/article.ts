import type { PagesEnv } from "../../_lib/auth";
import { fetchEditor } from "../../_lib/auth";

export const onRequestGet: PagesFunction<PagesEnv> = async (context) => {
	const source = new URL(context.request.url);
	const target = `/api/article${source.search}`;
	const response = await fetchEditor(context, target);
	return new Response(response.body, {
		status: response.status,
		headers: {
			"Content-Type":
				response.headers.get("Content-Type") || "application/json",
			"Cache-Control": "no-store",
		},
	});
};
