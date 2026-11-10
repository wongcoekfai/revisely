import { json, addVersion, abToBase64 } from "../../_shared/db.mjs";

export async function onRequest(context) {
  const { request, params, env } = context;
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "invalid form data" }, 400);
  }
  const file = form.get("image");
  const type = ["initial", "revision", "newrequest"].includes(form.get("type")) ? form.get("type") : "revision";
  const note = form.get("note") || "";
  let dataUrl = null;
  if (file && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return json({ error: "image too large (max 5MB)" }, 400);
    const buf = await file.arrayBuffer();
    dataUrl = `data:${file.type || "image/png"};base64,${abToBase64(buf)}`;
  }
  const c = await addVersion(env, params.id, { dataUrl, note, type });
  if (!c) return json({ error: "not found" }, 404);
  return json(c);
}
