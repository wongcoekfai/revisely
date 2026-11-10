import { json, setDeposit } from "../../_shared/db.mjs";

export async function onRequest(context) {
  const { request, params, env } = context;
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  const c = await setDeposit(env, params.id, body.status || "paid");
  if (!c) return json({ error: "not found" }, 404);
  return json(c);
}
