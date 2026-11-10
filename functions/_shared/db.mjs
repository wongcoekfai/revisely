// Shared data layer for Revisely — runs on Cloudflare Pages Functions with a D1 (SQLite) binding.
// No filesystem is used; uploaded images are stored as base64 data URLs inside D1.
// The schema is created on first use (per cold start), so no separate migration step is needed
// for local dev or production.

let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS commissions (
          id TEXT PRIMARY KEY, token TEXT UNIQUE, artist_name TEXT, client_name TEXT,
          title TEXT, brief TEXT, deposit REAL, deposit_status TEXT,
          delivery_status TEXT, status TEXT, created_at INTEGER
        )`
      ).run();
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS versions (
          id TEXT PRIMARY KEY, commission_id TEXT, vnum INTEGER, image_base64 TEXT,
          note TEXT, type TEXT, status TEXT, client_comment TEXT, created_at INTEGER
        )`
      ).run();
      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_versions_commission ON versions(commission_id)`
      ).run();
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function abToBase64(ab) {
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function rid(len = 16) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toCommissionView(c, vs) {
  return {
    id: c.id,
    token: c.token,
    artistName: c.artist_name,
    clientName: c.client_name,
    title: c.title,
    brief: c.brief,
    deposit: c.deposit,
    depositStatus: c.deposit_status,
    deliveryStatus: c.delivery_status,
    status: c.status,
    versions: (vs || []).map((v) => ({
      id: v.id,
      vnum: v.vnum,
      dataUrl: v.image_base64 || null,
      note: v.note,
      type: v.type,
      status: v.status,
      clientComment: v.client_comment,
      createdAt: v.created_at,
    })),
  };
}

export async function createCommission(env, body) {
  await ensureSchema(env);
  const id = rid(8);
  const token = rid(10);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO commissions
       (id, token, artist_name, client_name, title, brief, deposit, deposit_status, delivery_status, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(id, token, body.artistName || "Artist", body.clientName, body.title, body.brief || "",
      body.deposit ? Number(body.deposit) : 0, "unpaid", "pending", "brief", now)
    .run();
  return getCommission(env, id);
}

export async function listCommissions(env, artistEmail) {
  await ensureSchema(env);
  const base = `SELECT id, token, client_name, title, status, deposit, deposit_status,
                       delivery_status, created_at,
                       (SELECT COUNT(*) FROM versions v WHERE v.commission_id = commissions.id) AS version_count
                FROM commissions`;
  const rows = artistEmail
    ? await env.DB.prepare(base + ` WHERE artist_name = ? ORDER BY created_at DESC`).bind(artistEmail).all()
    : await env.DB.prepare(base + ` ORDER BY created_at DESC`).all();
  return (rows.results || []).map((r) => ({
    id: r.id, token: r.token, clientName: r.client_name, title: r.title,
    status: r.status, versions: r.version_count, createdAt: r.created_at,
    deposit: r.deposit, depositStatus: r.deposit_status, deliveryStatus: r.delivery_status,
  }));
}

export async function getCommission(env, id) {
  await ensureSchema(env);
  const c = await env.DB.prepare(`SELECT * FROM commissions WHERE id = ?`).bind(id).first();
  if (!c) return null;
  const vs = await env.DB.prepare(`SELECT * FROM versions WHERE commission_id = ? ORDER BY vnum ASC`).bind(id).all();
  return toCommissionView(c, vs.results || []);
}

export async function addVersion(env, id, { dataUrl, note, type }) {
  await ensureSchema(env);
  const c = await env.DB.prepare(`SELECT id FROM commissions WHERE id = ?`).bind(id).first();
  if (!c) return null;
  const max = await env.DB.prepare(`SELECT COALESCE(MAX(vnum),0) AS m FROM versions WHERE commission_id = ?`).bind(id).first();
  const vnum = (max.m || 0) + 1;
  await env.DB.prepare(
    `INSERT INTO versions
       (id, commission_id, vnum, image_base64, note, type, status, client_comment, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(rid(6), id, vnum, dataUrl, note, type, "pending", "", Date.now()).run();
  await env.DB.prepare(`UPDATE commissions SET status = 'in_review' WHERE id = ?`).bind(id).run();
  return getCommission(env, id);
}

export async function getClientCommission(env, token) {
  await ensureSchema(env);
  const c = await env.DB.prepare(`SELECT * FROM commissions WHERE token = ?`).bind(token).first();
  if (!c) return null;
  const vs = await env.DB.prepare(`SELECT * FROM versions WHERE commission_id = ? ORDER BY vnum ASC`).bind(c.id).all();
  return toCommissionView(c, vs.results || []);
}

export async function actOnVersion(env, token, vid, action, comment) {
  await ensureSchema(env);
  const c = await env.DB.prepare(`SELECT * FROM commissions WHERE token = ?`).bind(token).first();
  if (!c) return { error: "not found" };
  const v = await env.DB.prepare(`SELECT * FROM versions WHERE id = ? AND commission_id = ?`).bind(vid, c.id).first();
  if (!v) return { error: "version not found" };
  if (action === "approve") {
    await env.DB.prepare(`UPDATE versions SET status = 'approved' WHERE id = ?`).bind(vid).run();
    await env.DB.prepare(`UPDATE commissions SET status = 'approved' WHERE id = ?`).bind(c.id).run();
  } else if (action === "changes") {
    await env.DB.prepare(`UPDATE versions SET status = 'changes', client_comment = ? WHERE id = ?`).bind(comment || "", vid).run();
    await env.DB.prepare(`UPDATE commissions SET status = 'in_review' WHERE id = ?`).bind(c.id).run();
  }
  return { ok: true };
}

export async function setDeposit(env, id, status) {
  await ensureSchema(env);
  await env.DB.prepare(`UPDATE commissions SET deposit_status = ? WHERE id = ?`).bind(status, id).run();
  return getCommission(env, id);
}

export async function setDelivered(env, id) {
  await ensureSchema(env);
  await env.DB.prepare(`UPDATE commissions SET delivery_status = 'delivered', status = 'delivered' WHERE id = ?`).bind(id).run();
  return getCommission(env, id);
}
