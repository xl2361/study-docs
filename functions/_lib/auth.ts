export type PagesEnv = Record<string, never>;

export const SESSION_COOKIE = "study_session";
export const SESSION_MAX_AGE = 400 * 24 * 60 * 60;
const EDITOR_URL = "https://dayu-study-editor.dayu2360.workers.dev";

export function getSessionToken(request: Request): string | null {
	const cookie = request.headers.get("Cookie") || "";
	for (const part of cookie.split(";")) {
		const [name, ...value] = part.trim().split("=");
		if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
	}
	return null;
}

export function editorRequest(
	context: { request: Request },
	path: string,
	init: RequestInit = {},
): Request {
	const token = getSessionToken(context.request);
	const headers = new Headers(init.headers);
	headers.set("Origin", "https://dayu-study.pages.dev");
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return new Request(`https://editor.internal${path}`, { ...init, headers });
}

export function fetchEditor(
	context: { request: Request },
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const request = editorRequest(context, path, init);
	const url = new URL(request.url);
	return fetch(
		new Request(`${EDITOR_URL}${url.pathname}${url.search}`, {
			method: request.method,
			headers: request.headers,
			body: request.body,
			signal: AbortSignal.timeout(15_000),
		}),
	);
}

export async function validateSession(context: {
	request: Request;
	env: PagesEnv;
}): Promise<boolean> {
	if (!getSessionToken(context.request)) return false;
	try {
		const response = await fetchEditor(context, "/api/session");
		return response.ok;
	} catch {
		return false;
	}
}

export function sessionCookie(token: string, maxAge: number): string {
	const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
	return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Expires=${expires}; Priority=High`;
}

export function clearSessionCookie(): string {
	return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
