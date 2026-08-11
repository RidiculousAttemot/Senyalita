# Running Senyalita in Docker

A self-hosted alternative to the Vercel deployment. The image serves the same
Next.js app — Text-to-Sign, Sign-to-Text, `/learn`, `/evaluation` — against the
same Supabase project. Recognition still runs entirely in the browser; the
container serves the model file, it does not do inference.

## Quick start

```bash
docker compose --env-file .env.local up --build
```

Then open <http://localhost:3000>.

`--env-file .env.local` matters: the `NEXT_PUBLIC_*` build args are read from
the **shell environment**, and compose's `env_file:` key does not populate it.
Without it the build stops with "set it, or the built client cannot reach
Supabase" rather than producing a broken image.

## The build-arg requirement, and why

**`NEXT_PUBLIC_*` values are compiled into the client bundle. They cannot be
supplied at runtime.**

`next build` substitutes them as string literals, so by the time a container
starts, the values are already fixed in the JavaScript the browser downloads.
The previous compose file passed them via `env_file`, which sets them in the
running container — long after the bundle was written. The result was an image
that started cleanly, served a UI, and failed every Supabase call, because the
client held empty strings.

This is the same trap that cost time on Vercel, and it is invisible from the
UI: the app looks fine until data is needed.

| Variable | When | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **build** | Inlined into the client bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **build** | Inlined; anon key is public by design |
| `NEXT_PUBLIC_SITE_URL` | **build** | Defaults to `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | Never a build arg — see below |
| `DATABASE_URL` | runtime | Never a build arg |
| `ADMIN_ENABLED` | runtime | Defaults to `false` |

**Changing any build-time variable requires `--build`.** `docker compose up`
alone reuses the existing image and keeps serving the old values.

Server-only secrets are deliberately runtime-only. Build args are recorded in
image history and readable by anyone who can pull the image, so putting the
service-role key there would publish it with the image.

## The admin surface

`ADMIN_ENABLED` defaults to **`false`**, matching the deployed site, so `/admin`
and `/api/admin/*` return 404.

For self-hosting the trade-off is genuinely different from Vercel: someone
running this locally may want the authoring tools. To enable:

```bash
ADMIN_ENABLED=true docker compose --env-file .env.local up --build
```

**Understand what that exposes.** `/api/admin/*` holds the service-role Supabase
client, which bypasses row-level security. Enabling the flag makes those routes
reachable from **any network that can reach the container** — with `ports:
3000:3000` that includes other machines on your LAN, not just localhost. There
is Supabase auth in front of the pages, but the blast radius of a mistake here
is the whole database. If you enable it, bind to loopback (`127.0.0.1:3000:3000`)
unless you specifically intend otherwise.

## What is not in the image

`.dockerignore` excludes `datasets/` (37 GB) and `tmp/` (36 GB). Two code paths
read from those directories and will not find them:

- **`/api/videos/[label]/[file]`** reads `datasets/raw/user_videos` and returns
  404. Expected — the same is true on Vercel.
- **The animation local-development fallback** reads
  `datasets/processed/user_holistic_assets`. It is off whenever `NODE_ENV` is
  `production`, which the image sets, so it never runs here.

Neither affects normal use: published animations are served from Supabase
Storage, not from disk.

`public/models` **is** included and must stay that way — it carries the served
BiLSTM (`model.json`, `weights.bin`, `labels.json`) and the self-hosted
MediaPipe `.task` and WASM. Without it recognition cannot start.

## Camera: localhost or HTTPS only

`getUserMedia` requires a secure context. Browsers treat `http://localhost` as
secure, and a plain-HTTP LAN address as not.

- `http://localhost:3000` — both directions work.
- `http://192.168.x.x:3000` — Text-to-Sign works; **Sign-to-Text cannot start
  the camera**, and the failure surfaces as a permission error rather than
  anything naming HTTP.

To use the camera from another device, terminate TLS in front of the container
(a reverse proxy with a certificate) and reach it over `https://`.

## Image details

- **Base**: `node:22-alpine`. The Node 22 pin is load-bearing in both
  directions — `puppeteer@25` needs `>=22.12.0`, and Node 24 breaks Next
  14.2.5's bundled webpack hasher. `next.config.mjs` carries two Node-24
  workarounds that are inert here and can be removed once nothing builds on 24.
- **Output**: `output: "standalone"`. The runtime stage copies only
  `.next/standalone`, `.next/static` and `public` — not `node_modules`.
- **User**: runs as the non-root `node` user.
- **Healthcheck**: polls `/` every 30s. Deliberately a route that does not touch
  Supabase, so a database outage does not mark a working container unhealthy.

## Build context

`COPY . .` sends the context to the daemon, and the context is built from the
**working tree**, not from git — so gitignored directories still count.

| | Size |
|---|---|
| Before | ~73 GB (`datasets` 37 GB + `tmp` 36 GB) |
| After | ~32 MB |

## Troubleshooting

**App loads but every Supabase query fails.** The image was built without the
`NEXT_PUBLIC_*` build args. Rebuild with `--env-file .env.local`; restarting
will not fix it.

**Build fails with `ERR_INVALID_ARG_TYPE` from `Hash.update`.** A Node 24
webpack hasher bug. The image pins Node 22, so this only appears if you build
outside Docker on Node 24.

**`/admin` returns 404.** Expected. See the admin section above.
