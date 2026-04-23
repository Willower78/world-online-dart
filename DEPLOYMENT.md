# Deploying World Online Dart to Railway

This is the path of least resistance: three Railway services (server, client,
ai-backend) + MongoDB Atlas (free) + Metered TURN (free). Expected one-time
cost to set up: ~45 minutes. Ongoing cost: $0 on free tiers, up to a few
euros/month once you outgrow them.

## 1. Pre-flight

Before you touch Railway, rotate the secrets in your current `server/.env`.
They were on Google Drive and in your local working tree — treat them as
public.

| Secret | Rotate at |
| --- | --- |
| `MONGO_URI` | [MongoDB Atlas → Database Access](https://cloud.mongodb.com/v2#/security/database/users) → edit user → "Edit Password" → **Autogenerate** → copy; then **Database → Connect → Drivers** for the new URI. |
| `JWT_SECRET` | Generate a fresh one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `STRIPE_SECRET_KEY` / publishable | [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys) → "Roll key" on the standard secret key. |
| `STRIPE_WEBHOOK_SECRET` | Delete the old endpoint in Stripe → Developers → Webhooks, re-create it pointing at your new Railway URL, and copy the new signing secret. |

Keep the new values on a scratch pad — you'll paste them into Railway in a
moment. **Do not** commit them to the repo or paste them into this chat.

## 2. Set up MongoDB Atlas (free, 512 MB)

1. [Sign up / log in](https://cloud.mongodb.com).
2. Create a new **M0** (free) cluster in the region closest to your Railway
   region (Railway's default is `us-west1`; Atlas `AWS / us-west-2` is fine).
3. **Database Access** → Add User → copy the password.
4. **Network Access** → Add IP Address → "Allow Access from Anywhere"
   (`0.0.0.0/0`). Not ideal, but Railway IPs are dynamic; tighten later if
   needed.
5. **Connect → Drivers** → copy the `mongodb+srv://…` URI.

## 3. Set up Metered TURN (free tier: 500 MB / month)

1. [metered.ca/stun-turn](https://www.metered.ca/stun-turn) → sign up.
2. Dashboard → grab the TURN URL (e.g. `turn:global.relay.metered.ca:80`),
   username, and credential.

(If you'd rather self-host `coturn` on a €3.50/month Hetzner VPS, see the
"Self-hosted TURN" appendix below.)

## 4. Set up Railway

1. [railway.app](https://railway.app) → sign up with GitHub, grant access to
   `Willower78/world-online-dart`.
2. "New Project" → "Deploy from GitHub repo" → pick the repo.

You'll create **three services** inside this one project:

### Service A — `server` (Node / Socket.IO)

- **Source**: `Willower78/world-online-dart` (already connected).
- **Settings → Service → Root Directory**: `/` (root).
- **Settings → Build → Dockerfile Path**: `Dockerfile.server`.
- **Settings → Networking**: enable "Generate Domain". Copy it; it looks like
  `wodart-server-production.up.railway.app`.
- **Variables**:
  ```
  MONGO_URI=mongodb+srv://...           # from Atlas
  JWT_SECRET=...                        # the one you generated
  PORT=5000
  CLIENT_URL=https://<your-client-url>.up.railway.app
  AI_SERVICE_URL=https://<your-ai-url>.up.railway.app/detect
  REDIS_ENABLED=false
  ECONOMY_ENABLED=false                  # leave off until Stripe/Tremendous are finished
  # Optional: Stripe
  STRIPE_SECRET_KEY=
  STRIPE_PREMIUM_PRICE_ID=
  STRIPE_WEBHOOK_SECRET=
  ```
  You won't have the client/AI URLs yet — create the services first and come
  back to paste them.

### Service B — `ai-backend` (Python / Flask / YOLO)

- "+ New" inside the same project → "GitHub Repo" → same repo.
- **Settings → Service → Service Name**: `ai-backend`.
- **Settings → Build → Dockerfile Path**: `Dockerfile.ai-backend`.
- **Networking**: generate a domain. Copy it.
- **Variables**:
  ```
  NODE_SERVER_URL=https://<your-server-url>.up.railway.app
  AI_PORT=5001
  YOLO_MODEL_PATH=./models/dart_detector.pt
  ```

⚠️ The YOLO weights (`ai-backend/models/dart_detector.pt`) are gitignored.
Add it back to the repo as a committed file *or* upload it via a Railway
volume at deploy time. Easiest: remove `/ai-backend/models/*` from
`.gitignore` for this one file and commit it (the file is ~5 MB).

### Service C — `client` (React, static via nginx)

- "+ New" → same repo.
- **Service Name**: `client`.
- **Dockerfile Path**: `Dockerfile.client`.
- **Networking**: generate a domain.
- **Variables** (these are *build-time* — CRA inlines them into the bundle):
  ```
  REACT_APP_SERVER_URL=https://<your-server-url>.up.railway.app
  REACT_APP_TURN_URL=turn:global.relay.metered.ca:80
  REACT_APP_TURN_USERNAME=...            # from Metered
  REACT_APP_TURN_CREDENTIAL=...          # from Metered
  ```

## 5. Cross-link the services

Go back to **Service A (server)** and fill in the `CLIENT_URL` and
`AI_SERVICE_URL` with the real Railway domains you copied. Redeploy.

## 6. Smoke test

Open `https://<client-url>.up.railway.app` in Chrome:

- [ ] Page loads, no CORS errors in the console.
- [ ] Register a user, log in.
- [ ] Create a 501 bot game, throw some scores.
- [ ] Grant camera permission when prompted (HTTPS is required — Railway
  gives you this automatically).
- [ ] Open a second browser (or ask a friend), register a second user, and
  accept an invite. Confirm you can see each other's video feed.

## 7. Invite testers

Send them the client URL. No installation on their side — they just need a
modern browser with a webcam.

## Cost estimates

Everything above runs on free tiers for development traffic. Expected
upgrades once you outgrow them:

- Railway: ~$5/month execution + $0.01/GB egress once the $5 trial credit
  runs out.
- MongoDB Atlas: free tier is 512 MB, upgrade is $9/month for M10.
- Metered TURN: $9/month for 50 GB if you exceed the free 500 MB.

---

## Appendix — self-hosted TURN (coturn on a VPS)

If you'd rather not depend on Metered, stand up `coturn` on a tiny VPS
(Hetzner CX11, Contabo, etc. — ~€3.50/month):

```bash
# On Ubuntu 22.04+
sudo apt update && sudo apt install -y coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo tee /etc/turnserver.conf > /dev/null <<EOF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
realm=your-domain.com
user=wodart:$(openssl rand -base64 24)
lt-cred-mech
no-multicast-peers
EOF
sudo systemctl enable --now coturn
```

Open UDP/TCP 3478 and 5349 in your VPS firewall. Then set these on the
client:

```
REACT_APP_TURN_URL=turn:your-vps-ip:3478
REACT_APP_TURN_USERNAME=wodart
REACT_APP_TURN_CREDENTIAL=...      # the one from /etc/turnserver.conf
```

## Appendix — Fly.io (alternative to Railway)

Same topology, different clicks:

```bash
# Server
cd server && fly launch --dockerfile ../Dockerfile.server --region ams --no-deploy
fly secrets set MONGO_URI="..." JWT_SECRET="..." AI_SERVICE_URL="..."
fly deploy --config ../fly.server.toml

# Client
cd ../client && fly launch --dockerfile ../Dockerfile.client --region ams --no-deploy
fly deploy --build-arg REACT_APP_SERVER_URL="https://wodart-server.fly.dev"

# AI backend
cd ../ai-backend && fly launch --dockerfile ../Dockerfile.ai-backend --region ams --no-deploy
fly deploy
```

Fly's free tier gives you 3 shared-CPU VMs with 256 MB RAM. The AI backend
wants more memory for YOLO; you'll probably want to bump it to `shared-cpu-1x`
with 512 MB (~$2/month).
