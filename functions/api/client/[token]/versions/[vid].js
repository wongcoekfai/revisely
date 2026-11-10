import { json, actOnVersion } from "../../../../_shared/db.mjs";

export async function onRequest(context) {
  const { request, params, env } = context;
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  const r = await actOnVersion(env, params.token, params.vid, body.action, body.comment);
  if (r.error) return json(r, 404);
  return json(r);
}
