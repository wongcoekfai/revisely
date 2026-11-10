import { json, createCommission, listCommissions } from "../_shared/db.mjs";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.clientName || !body.title) return json({ error: "clientName and title required" }, 400);
    const c = await createCommission(env, body);
    return json(c, 201);
  }
  if (request.method === "GET") {
    const artistEmail = new URL(request.url).searchParams.get("artistEmail");
    return json(await listCommissions(env, artistEmail));
  }
  return json({ error: "method not allowed" }, 405);
}
