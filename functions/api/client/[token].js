import { json, getClientCommission } from "../../_shared/db.mjs";

export async function onRequest(context) {
  const { params, env } = context;
  if (context.request.method === "OPTIONS") return json({}, 204);
  const c = await getClientCommission(env, params.token);
  if (!c) return json({ error: "not found" }, 404);
  return json(c);
}
