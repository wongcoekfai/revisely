const $ = (s) => document.querySelector(s);
const token = new URLSearchParams(location.search).get("token");
const api = async (url, opt = {}) => (await fetch(url, opt)).json();
const fmt = (ts) => new Date(ts).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const typeLabel = { initial: "Initial", revision: "Revision", newrequest: "New request" };

async function load() {
  if (!token) {
    $("#root").innerHTML = `<div class="panel big-msg"><div class="em">🔗</div><p>Missing token in the link.</p></div>`;
    return;
  }
  const c = await api("/api/client/" + token);
  if (c.error) {
    $("#root").innerHTML = `<div class="panel big-msg"><div class="em">🔍</div><p>This link is invalid or expired.</p></div>`;
    return;
  }
  const root = $("#root");

  const pending = [...c.versions].reverse().find((v) => v.status === "pending");
  const current = pending || c.versions[c.versions.length - 1];

  if (c.status === "delivered") {
    root.innerHTML = `
      <div class="panel big-msg">
        <div class="em">🎉</div>
        <h2 style="margin:0 0 6px;">Artwork delivered</h2>
        <p class="muted">"${escapeHtml(c.title)}" has been delivered. Thank you!</p>
      </div>`;
    renderHistory(root, c);
    return;
  }

  if (c.status === "approved") {
    root.innerHTML = `
      <div class="panel hero-art">
        <h2 style="margin:0 0 4px;">✅ You approved this version</h2>
        <p class="muted">The artist will proceed based on it. For further changes, ask the artist to upload a new version.</p>
      </div>`;
    renderHistory(root, c);
    return;
  }

  if (!current) {
    root.innerHTML = `<div class="panel big-msg"><div class="em">🎨</div><p>The artist hasn't uploaded artwork yet — please check back soon.</p></div>`;
    return;
  }

  root.innerHTML = `
    <div class="panel">
      <div class="muted" style="font-size:13px;">Hi ${escapeHtml(c.clientName)}, here is the latest artwork for "${escapeHtml(c.title)}". Please review and confirm.</div>
    </div>

    <div class="panel hero-art">
      ${current.dataUrl ? `<img src="${current.dataUrl}" alt="v${current.vnum}" />` : `<div class="muted">No image for this version</div>`}
      <div style="margin-top:10px;">
        <span class="typetag ${current.type}">${typeLabel[current.type] || current.type}</span>
        <span class="muted" style="font-size:12px;">v${current.vnum} · ${fmt(current.createdAt)}</span>
      </div>
      <div class="note">${escapeHtml(current.note) || ""}</div>

      ${pending ? `
      <div class="actions">
        <button class="btn green" id="approve">✓ Approve this version</button>
        <button class="btn amber" id="request">✎ Request changes</button>
      </div>
      <div id="reqBox" class="hidden" style="margin-top:14px;">
        <label style="color:var(--muted);font-size:13px;">Tell the artist what to change:</label>
        <textarea id="reqComment" rows="3" placeholder="e.g. make the cat's eyes bigger, change the background to blue"></textarea>
        <button class="btn small" id="sendReq" style="margin-top:10px;">Send change request</button>
      </div>` : ""}
    </div>

    <div class="panel">
      <h3 style="margin:0 0 12px;font-size:14px;color:var(--muted);">Project brief</h3>
      <div class="muted">${escapeHtml(c.brief) || "(no brief provided)"}</div>
    </div>
  `;

  if (pending) {
    $("#approve").onclick = () => act("approve");
    $("#request").onclick = () => $("#reqBox").classList.remove("hidden");
    $("#sendReq").onclick = () => {
      const comment = $("#reqComment").value.trim();
      if (!comment) { alert("Please describe the changes"); return; }
      act("changes", comment);
    };
  }
  renderHistory(root, c);
}

function renderHistory(root, c) {
  if (!c.versions.length) return;
  const h = document.createElement("div");
  h.className = "panel";
  h.innerHTML = `<h3 style="margin:0 0 12px;font-size:14px;color:var(--muted);">Version history</h3>
    <div class="hist">${[...c.versions].reverse().map((v) => `
      <div><img src="${v.dataUrl || ""}" alt="v${v.vnum}" ${v.dataUrl ? "" : 'style="opacity:.2"'}/>
      <div class="hv">v${v.vnum} ${v.status === "approved" ? "✓" : v.status === "changes" ? "↺" : ""}</div></div>`).join("")}</div>`;
  root.appendChild(h);
}

async function act(action, comment) {
  const v = [...(await api("/api/client/" + token)).versions].reverse().find((x) => x.status === "pending");
  if (!v) return;
  await api(`/api/client/${token}/versions/${v.id}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, comment }),
  });
  load();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

load();
