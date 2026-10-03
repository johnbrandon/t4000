# Build the Expo web export and run the server (which hosts both the API and the
# static web app). Single stage on purpose: it avoids a cross-stage COPY of
# ./dist (which can fail on build-cache quirks) and keeps the build simple.
# Railway builds this from the repo root.
FROM node:22-slim

# Some transitive deps run node-gyp postinstalls; give them a toolchain.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Root app deps (cached unless the lockfile changes). Dev deps are needed to run
# the Expo web export, so don't use --omit=dev here.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# App source, then build the web export to /app/dist (served from the domain
# root, so no EXPO_BASE_URL). Fail loudly if the export produced nothing.
COPY . .
RUN npm run build:web && test -f dist/index.html

# Server deps.
WORKDIR /app/server
RUN npm ci

# Railway injects PORT; the server reads it (defaults to 3000). The server
# serves /app/dist (resolved relative to server/src) as the web app.
EXPOSE 3000
CMD ["npm", "start"]
