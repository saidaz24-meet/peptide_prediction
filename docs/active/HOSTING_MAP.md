# Hosting map — where PVL runs, and why

Three boxes show up in conversation. Their roles are different. This page
exists so anyone (Said, Peleg, Alex, a new dev) can answer "which one are
you talking about?" in one read.

---

## At a glance

| Name | Address | Role | Public? | Status |
|---|---|---|---|---|
| **Hetzner CX33** ("VPS") | `94.130.178.182` · `http://94.130.178.182:3000` | Current public production. Anyone with the URL can hit it. | ✅ Yes | ✅ Running, deployed on `wave-2.8/peleg-pdf-followups` |
| **DESY VM** ("landau-webapp-dev") | `131.169.4.163` · internal name `landau-webapp-dev.desy.de` | Long-term production home. DESY-owned, Said is root. | ❌ Internal-only (firewalled) | ✅ Running, same branch deployed |
| **Said's MacBook** | `localhost` | Dev — Vite + Uvicorn + Mac TANGO binary | ❌ Local | Dev only |

"VPS", "VM", "Hetzner", "DESY" — what people mean:

- **"VPS"** in conversation almost always = **Hetzner CX33 = `94.130.178.182`** (the current public site).
- **"VM"** in conversation almost always = **DESY `landau-webapp-dev` = `131.169.4.163`** (the migration target).
- **"Hetzner"** = the same thing as VPS.
- **"DESY"** = the DESY VM (or, occasionally, the DESY Maxwell login cluster you SSH through to reach it).

---

## Why two boxes

Hetzner is the **bridge**. PVL had no DESY presence when v0.1 went up. We
rented a Hetzner CX33 to ship a public URL while DESY worked on
provisioning the actual production VM. As of 2026-06-18 the DESY VM is
provisioned, Said has root access, the bootstrap script runs cleanly, the
same branch is deployed there, and Quick Analyze is fast on both.

The plan is to **switch the public URL to DESY** once two things are true:
1. DESY opens HTTP(S) ingress from the public internet (firewall).
2. DESY assigns a stable public DNS name (something like
   `pvl.cssb-hamburg.de`).

Until then, Hetzner stays as the citable public URL.

---

## When you change which

| Want to change… | Use | Notes |
|---|---|---|
| **Public site that paper readers / Peleg / your supervisor visit** | Hetzner (`94.130.178.182`) | This is what anyone with a paper-link will reach. |
| **The long-term home / institutional ownership** | DESY VM | DESY infra, root-controlled by Said, behind DESY firewall. |
| **Quick iteration / debugging** | MacBook (`localhost:5173` + `:8000`) | No deploy step. `make dev`. |

---

## Common confusion answered

**Q: I went to `131.169.4.163` from my home internet and it didn't load.**
A: Correct, that's the DESY VM and it's firewalled. Only reachable from
inside the DESY network (e.g. from Maxwell SSH session, from CSSB office
network, or via VPN). See "Browser access to DESY VM" below.

**Q: Why did the perf fix not show up in the logs after I ran the redeploy?**
A: Before today's commit, `scripts/desy_perf_redeploy.sh` did
`docker run pvl-backend:latest` against whatever image was already built
on the host — even after a fresh `git pull`. The new code went onto disk
but not into the image. Today's commit makes the script run
`docker build` first so the latest source is always baked in.

**Q: Which one do I deploy to?**
A: Both, for now. They're cheap to keep in sync — same branch, same
script. When DESY ingress is opened we'll cut Hetzner and redirect the
URL.

---

## Browser access to the DESY VM

The DESY VM does NOT have public HTTP ingress yet. Alex asked about this.
Three options, ordered by setup cost:

### Option A — SSH local port forwarding (works now, no IT request)

From your Mac:

```bash
ssh -L 8000:landau-webapp-dev:8000 azaizahs@max-display.desy.de
```

This tunnels DESY VM's port 8000 to your Mac's `localhost:8000`. Then in
a browser go to `http://localhost:8000/api/health` — you'll be hitting
the DESY backend directly. To hit the React UI, run a UI port-forward
too on whatever port the UI listens on (probably 3000 or 5173).

If Alex wants to do the same:

```bash
ssh -L 8000:landau-webapp-dev:8000 <his-DESY-username>@max-display.desy.de
```

Then `http://localhost:8000` on his Mac. Works through DESY auth — no
firewall change needed.

### Option B — DESY IT request to open public HTTPS ingress

File a ticket with DESY IT asking for:
1. Open port `443` (HTTPS) inbound to `landau-webapp-dev` from the
   public internet.
2. (Optional but recommended) a public DNS name like
   `pvl.cssb-hamburg.de` pointing at it.
3. (Optional) a TLS cert, either from DESY's CA or via Let's Encrypt
   once the DNS is set up.

This is the right long-term answer. Until it lands, the URL stays
internal-only.

### Option C — Tailscale / WireGuard mesh

Install Tailscale on the DESY VM and on each person's Mac. Now Alex
and Said can hit `http://<tailscale-ip>:8000` from anywhere without
DESY VPN. Lightweight, free for small teams. The catch is DESY IT
might have policy concerns about an outbound persistent connection
from a DESY-owned VM to a third-party coordination server. Worth asking
them before installing.

### Recommendation

Today: **Option A**. It works without changing anything DESY-side, and
both Said and Alex can do it independently. Long term: file the
**Option B** ticket and migrate once it lands.

---

## What's actually deployed on each box right now

As of 2026-06-22 evening:

| Box | Branch | Last deploy | Perf path |
|---|---|---|---|
| Hetzner `94.130.178.182` | `wave-2.8/peleg-pdf-followups` | 2026-06-22 21:47 UTC | **needs re-run** with today's redeploy-script fix (the previous run was on the stale image) |
| DESY `landau-webapp-dev` | `wave-2.8/peleg-pdf-followups` | 2026-06-22 (after TANGO fix) | ✅ Working — perf logs show ~870 ms cold, ~6 ms cached, TANGO ~513 ms |

After today's redeploy-script fix, re-run on Hetzner to get the same
sub-1s Quick Analyze + TANGO output there.
