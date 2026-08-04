import type { PagesEnv } from "../../_lib/auth";
import { fetchEditor } from "../../_lib/auth";

export const onRequestPut: PagesFunction<PagesEnv> = async (context) => {
	const response = await fetchEditor(context, "/api/articles", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: context.request.body,
	});
	return new Response(response.body, {
		status: response.status,
		headers: {
			"Content-Type":
				response.headers.get("Content-Type") || "application/json",
			"Cache-Control": "no-store",
		},
	});
};
