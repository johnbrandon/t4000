# Build the Expo web export and the server, then run the server which hosts both.
# Railway builds this from the repo root.

# ---- build stage: Expo web export + server deps ----
FROM node:22-slim AS build
# Some transitive deps run node-gyp postinstalls; give them a toolchain.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Root app deps first (cached unless the lockfile changes).
COPY package.json package-lock.json ./
RUN npm ci

# Build the web app. Served from the domain root, so no EXPO_BASE_URL.
COPY . .
RUN npm run build:web

# Server deps.
WORKDIR /app/server
RUN npm ci

# ---- runtime stage ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
WORKDIR /app/server
# Railway injects PORT; the server reads it (defaults to 3000).
EXPOSE 3000
CMD ["npm", "start"]
