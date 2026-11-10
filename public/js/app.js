const $ = (s) => document.querySelector(s);
const api = async (url, opt = {}) => {
  const r = await fetch(url, opt);
  return r.json();
};
const fmt = (ts) => new Date(ts).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const typeLabel = { initial: "Initial", revision: "Revision", newrequest: "New request" };
const statusLabel = { brief: "Awaiting artwork", in_review: "Awaiting client", approved: "Approved", delivered: "Delivered" };

let selectedId = null;

async function loadList() {
  const list = await api("/api/commissions");
  const el = $("#list");
  if (!list.length) { el.innerHTML = '<div class="muted" style="font-size:13px">No commissions yet — create one on the left.</div>'; return; }
  el.innerHTML = list.map((c) => `
    <div class="card list-item ${c.id === selectedId ? "active" : ""}" data-id="${c.id}">
      <div class="t">${escapeHtml(c.title)}</div>
      <div class="m">Client: ${escapeHtml(c.clientName)} · ${c.versions} versions</div>
      <div class="m" style="margin-top:6px"><span class="badge ${c.status}">${statusLabel[c.status] || c.status}</span></div>
    </div>`).join("");
  el.querySelectorAll(".list-item").forEach((n) => n.onclick = () => openDetail(n.dataset.id));
}

async function openDetail(id) {
  selectedId = id;
  await loadList();
  const c = await api("/api/commissions/" + id);
  const clientUrl = location.origin + "/client.html?token=" + c.token;
  $("#detail").innerHTML = `
    <div class="card" style="margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div>
          <h2 style="margin:0 0 4px;font-size:22px;">${escapeHtml(c.title)}</h2>
          <div class="muted" style="font-size:13px;">Client: ${escapeHtml(c.clientName)}</div>
        </div>
        <span class="badge ${c.status}">${statusLabel[c.status] || c.status}</span>
      </div>
      <div class="stat">
        <div class="s"><b>${c.versions.length}</b><span>versions</span></div>
        <div class="s"><b>$${c.deposit || 0}</b><span>deposit</span></div>
        <div class="s"><b>${depositLabel(c.depositStatus)}</b><span>deposit status</span></div>
        <div class="s"><b>${c.deliveryStatus === "delivered" ? "Delivered" : "Not yet"}</b><span>delivery</span></div>
      </div>
      <div class="ghost-link">Client approval link (send to client):<br><code>${clientUrl}</code> <button class="btn ghost small" onclick="navigator.clipboard.writeText('${clientUrl}')">Copy</button></div>
      <div class="row" style="margin-top:12px;">
        <button class="btn green small" id="btnDeposit">${c.depositStatus === "paid" ? "✓ Deposit received" : "Mark deposit received"}</button>
        <button class="btn small" id="btnDeliver" ${c.status !== "approved" ? "disabled" : ""}>Mark delivered</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 class="section">Client brief</h3>
      <div class="note">${escapeHtml(c.brief) || '<span class="muted">(none)</span>'}</div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 class="section">Version history (newest first)</h3>
      <div id="versions"></div>
    </div>

    <div class="card uploadbox">
      <h3 class="section">Upload a new version</h3>
      <label>Type</label>
      <select id="v_type">
        <option value="revision">Revision (adjustments on the previous version)</option>
        <option value="newrequest">New request (client added new content)</option>
        <option value="initial">Initial</option>
      </select>
      <label>Note / what changed</label>
      <textarea id="v_note" rows="2" placeholder="e.g. warmed up the background per feedback"></textarea>
      <label>Upload image</label>
      <input type="file" id="v_file" accept="image/*" />
      <button class="btn small" id="btnUpload" style="margin-top:14px;">Upload &amp; send to client</button>
    </div>
  `;
  renderVersions(c);
  $("#btnDeposit").onclick = async () => {
    await api(`/api/commissions/${id}/deposit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) });
    openDetail(id);
  };
  $("#btnDeliver").onclick = async () => {
    await api(`/api/commissions/${id}/deliver`, { method: "POST" });
    openDetail(id);
  };
  $("#btnUpload").onclick = uploadVersion;
}

function renderVersions(c) {
  const el = $("#versions");
  if (!c.versions.length) { el.innerHTML = '<div class="muted" style="font-size:13px">No versions uploaded yet.</div>'; return; }
  const ordered = [...c.versions].reverse();
  el.innerHTML = ordered.map((v) => `
    <div class="ver">
      ${v.dataUrl ? `<img src="${v.dataUrl}" alt="v${v.vnum}" />` : `<div style="width:120px;height:120px;border-radius:10px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;">No image</div>`}
      <div class="meta">
        <div class="verhead">
          <b>v${v.vnum}</b>
          <span class="typetag ${v.type}">${typeLabel[v.type] || v.type}</span>
          <span class="badge ${v.status === 'approved' ? 'approved' : v.status === 'changes' ? 'in_review' : 'brief'}">${v.status === 'approved' ? 'Client approved' : v.status === 'changes' ? 'Changes requested' : 'Pending'}</span>
          <span class="muted" style="font-size:12px;margin-left:auto;">${fmt(v.createdAt)}</span>
        </div>
        <div class="note">${escapeHtml(v.note) || '<span class="muted">(no note)</span>'}</div>
        ${v.clientComment ? `<div class="cc">Client said: ${escapeHtml(v.clientComment)}</div>` : ""}
      </div>
    </div>`).join("");
}

async function uploadVersion() {
  const file = $("#v_file").files[0];
  if (!file) { alert("Please choose an image first"); return; }
  const fd = new FormData();
  fd.append("image", file);
  fd.append("type", $("#v_type").value);
  fd.append("note", $("#v_note").value);
  await fetch(`/api/commissions/${selectedId}/versions`, { method: "POST", body: fd });
  $("#v_note").value = ""; $("#v_file").value = "";
  openDetail(selectedId);
}

$("#btnCreate").onclick = async () => {
  const body = {
    clientName: $("#c_clientName").value.trim(),
    title: $("#c_title").value.trim(),
    brief: $("#c_brief").value.trim(),
    deposit: $("#c_deposit").value,
    artistName: $("#c_artist").value.trim(),
  };
  if (!body.clientName || !body.title) { alert("Client name and artwork title are required"); return; }
  const c = await api("/api/commissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  $("#c_clientName").value = ""; $("#c_title").value = ""; $("#c_brief").value = ""; $("#c_artist").value = "";
  await loadList();
  openDetail(c.id);
};

function depositLabel(s) { return s === "paid" ? "Received" : "Not received"; }
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

loadList();
