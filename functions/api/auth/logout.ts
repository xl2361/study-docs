import { clearSessionCookie } from "../../_lib/auth";

export const onRequestPost: PagesFunction = async () =>
	Response.json(
		{ authenticated: false },
		{
			headers: {
				"Cache-Control": "no-store",
				"Set-Cookie": clearSessionCookie(),
			},
		},
	);
