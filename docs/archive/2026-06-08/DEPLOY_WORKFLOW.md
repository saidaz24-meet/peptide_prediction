# PVL — Continuous Deploy Workflow

> One-time setup. After this, every push to `main` auto-deploys to whatever host the secrets point at. Switching hosts (Hetzner → DESY K8s → AWS) = updating secrets, no code change.

---

## How it works

`.github/workflows/deploy.yml` runs on every push to `main` (and manual `workflow_dispatch`). It SSHes into a host defined by **repository secrets**, `git pull`s the latest main, and runs `docker compose up -d --build`. Then it hits a healthcheck URL to confirm the new container is responding.

**Deploy target is configuration, not code** — the workflow knows nothing about Hetzner or DESY. When PVL moves to a new host, you change five lines in repo settings; the workflow runs unchanged.

---

## One-time setup (you do this once)

### Step 1 — Add the SSH public key to the deploy host

If you don't already have a dedicated deploy key on the target host:

```bash
# On your laptop:
ssh-keygen -t ed25519 -C "github-actions-pvl-deploy" -f ~/.ssh/pvl_deploy_key -N ""

# Upload the public key to the host:
ssh-copy-id -i ~/.ssh/pvl_deploy_key.pub root@94.130.178.182
# OR manually paste ~/.ssh/pvl_deploy_key.pub into the host's
# ~/.ssh/authorized_keys

# Test the key works:
ssh -i ~/.ssh/pvl_deploy_key root@94.130.178.182 'hostname'
```

Keep `~/.ssh/pvl_deploy_key` (the private one) — you'll paste it as a GitHub Secret next. Delete it from your laptop once it's in GitHub if you want — the only copy that matters is the one in GitHub Secrets.

### Step 2 — Add repository secrets

Go to: `Settings → Secrets and variables → Actions → New repository secret`. Add these:

| Secret | What | Example value |
|---|---|---|
| `DEPLOY_HOST` | Hostname or IP of deploy target | `94.130.178.182` |
| `DEPLOY_USER` | SSH user on the target | `root` |
| `DEPLOY_PATH` | Absolute path to the cloned repo on the target | `/opt/pvl` |
| `DEPLOY_SSH_KEY` | Private SSH key contents (everything from `-----BEGIN OPENSSH PRIVATE KEY-----` to `-----END...-----` inclusive) | (paste the contents of `~/.ssh/pvl_deploy_key`) |

Optional but recommended:

| Secret | What |
|---|---|
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan 94.130.178.182` (host-key pinning; without this the workflow uses trust-on-first-use which is fine for fresh hosts) |
| `DEPLOY_COMPOSE_FILE` | Path to compose file relative to `DEPLOY_PATH`. Defaults to `docker-compose.yml`. Set to `docker-compose.prod.yml` if you use a separate prod file. |
| `DEPLOY_HEALTHCHECK_URL` | Full URL the workflow hits after deploy to verify the new container is responding. Defaults to `http://${DEPLOY_HOST}:3000/`. |

### Step 3 — Verify

After secrets are configured:

1. Push any small change to `main` (e.g. update a doc), OR
2. Go to `Actions` tab → `Deploy` workflow → `Run workflow` button → select `main` → Run

Watch the workflow log. You should see:
- ✅ "All required deploy secrets are configured."
- ✅ "[deploy] HEAD is now <sha>: <commit subject>"
- ✅ "[deploy] Done."
- ✅ "Smoke test passed (attempt N)."

The VPS will be on the new main.

---

## Switching to a different host (future)

When the deploy target changes (DESY K8s, Fly.io, AWS, anywhere):

1. Set up SSH access to the new host the same way (Step 1 of above on the new host).
2. Update the 4-5 repo secrets to point at the new host. **Workflow code unchanged.**
3. Next push to main deploys there.

If the new host requires a different deploy mechanism (kubectl apply, gcloud run deploy, etc.), the deploy.yml workflow needs swapping — but that's expected when changing platforms.

---

## Manual deploy (without committing)

Sometimes you want to redeploy without a new commit (e.g. rolling back, restarting after a host reboot). Use the manual trigger:

1. Go to `Actions` tab in GitHub.
2. Pick `Deploy` from the left sidebar.
3. Click `Run workflow` (top right).
4. Enter the ref you want to deploy (default: `main`). You can also paste a commit SHA or branch name.
5. Click `Run workflow`.

---

## Right now — immediate VPS deploy

VPS at `94.130.178.182:3000` is showing the OLD UI (pre-Wave-2). To unblock without waiting for the auto-deploy setup:

```bash
ssh root@94.130.178.182
cd /opt/pvl   # or wherever the repo lives — adjust if different
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker compose -f docker-compose.prod.yml ps
```

After that the VPS will show the new UI. The auto-deploy workflow takes over from the next push onward (once secrets are configured).

---

## Cost / impact note

- The workflow uses standard GitHub Actions runners (free tier for public repos, included in your Actions minutes for private).
- Per-deploy runtime: ~1-2 min for the SSH + docker compose + smoke test.
- Concurrent deploys are serialized (concurrency group) so two rapid pushes don't race.
- The workflow does NOT cache anything — every run is a fresh `git pull` + `docker build`. Docker layer caching on the host means re-builds are fast (~30s for typical small changes; ~5min for major dep bumps).

---

## Cross-references

- Workflow file: `.github/workflows/deploy.yml`
- Reference: `~/.claude/projects/-Users-saidazaizah-Desktop-DESY-peptide-prediction/memory/reference_vps.md`
- ROADMAP Phase O.2 (was "VPS auto-deploy") — this satisfies it
