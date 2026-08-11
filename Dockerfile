# Build stage
# Keep in step with .nvmrc and package.json "engines". Node 20 does not
# satisfy puppeteer@25 (>=22.12.0); Node 24 breaks Next 14.2.5's bundled
# webpack hasher.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN if [ -f package-lock.json ]; then npm ci; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else npm install; fi

COPY . .

# NEXT_PUBLIC_* IS INLINED INTO THE CLIENT BUNDLE AT BUILD TIME.
#
# These cannot be supplied at runtime. Next substitutes them as literals during
# `next build`, so an image built without them ships a client holding empty
# strings — the app loads, and every Supabase call fails with no obvious cause.
# Passing them through docker-compose's `env_file` looks like it works and does
# not: that only sets them in the running container, long after the bundle was
# written.
#
# Consequence worth stating plainly: CHANGING THESE REQUIRES A REBUILD.
# `docker compose up` alone will keep serving the old values.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL are deliberately NOT build args.
# Build args are recorded in image history and readable by anyone who can pull
# the image. Those are server-only and are read at runtime, where they belong.

RUN npm run build

# Runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Off by default, matching production. Enabling it exposes /admin and
# /api/admin — the latter holds the service-role client — on whatever network
# reaches this container. See DOCKER.md.
ENV ADMIN_ENABLED=false

# Non-root. node:alpine already ships a `node` user (uid 1000).
USER node

# Standalone output only: the traced server plus the two things it does not
# include. public/ carries the BiLSTM weights and the MediaPipe runtime, and
# .next/static carries the client chunks — a server without either boots
# cleanly and 404s every asset.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000

# Liveness, not readiness. Deliberately hits a route that does not touch
# Supabase: a database outage should not mark the container unhealthy and have
# an orchestrator restart a process that is working correctly.
#
# Uses node's global fetch rather than curl, which alpine does not ship.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# server.js is emitted by output: "standalone"; `npm run start` would need the
# full next CLI and node_modules, which is what standalone exists to avoid.
CMD ["node", "server.js"]
