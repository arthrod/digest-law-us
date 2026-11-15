# Base stage for building the static files
FROM node:lts AS base
WORKDIR /app

# Install pnpm, pinned to the version CI (.github/workflows/ci.yml) and
# compose.yaml use. `pnpm@latest` let this image drift ahead of the lockfile,
# so a build could fail here while `--frozen-lockfile` still passed in CI.
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Runtime stage for serving the application
FROM nginx:mainline-alpine-slim AS runtime
COPY --from=base /app/dist /usr/share/nginx/html
EXPOSE 80
