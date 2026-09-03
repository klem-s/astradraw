FROM --platform=${BUILDPLATFORM} node:18 AS build

WORKDIR /opt/node_app

# Copy package files first for better layer caching
COPY package.json yarn.lock ./
COPY excalidraw-app/package.json ./excalidraw-app/
COPY packages/excalidraw/package.json ./packages/excalidraw/
COPY packages/utils/package.json ./packages/utils/
COPY packages/math/package.json ./packages/math/
COPY packages/common/package.json ./packages/common/
COPY packages/element/package.json ./packages/element/

# Install dependencies with cache mount
# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000 --frozen-lockfile

# Now copy the rest of the source code
# This ensures code changes don't invalidate the dependency layer
COPY . .

ARG NODE_ENV=production

# Build with placeholder values that will be replaced at runtime
# This allows environment variables to be injected when the container starts
# Note: These are placeholders, actual values injected at runtime via docker-entrypoint.sh
ENV VITE_APP_WS_SERVER_URL=__VITE_APP_WS_SERVER_URL__ \
    VITE_APP_BACKEND_V2_GET_URL=__VITE_APP_BACKEND_V2_GET_URL__ \
    VITE_APP_BACKEND_V2_POST_URL=__VITE_APP_BACKEND_V2_POST_URL__ \
    VITE_APP_STORAGE_BACKEND=__VITE_APP_STORAGE_BACKEND__ \
    VITE_APP_HTTP_STORAGE_BACKEND_URL=__VITE_APP_HTTP_STORAGE_BACKEND_URL__ \
    VITE_APP_FIREBASE_CONFIG=__VITE_APP_FIREBASE_CONFIG__ \
    VITE_APP_DISABLE_TRACKING=__VITE_APP_DISABLE_TRACKING__

# GIPHY API key placeholder (separate to avoid linter warning)
# Actual value loaded from Docker secrets at runtime, not from this ENV
ARG VITE_APP_GIPHY_API_KEY_PLACEHOLDER=__VITE_APP_GIPHY_API_KEY__
ENV VITE_APP_GIPHY_API_KEY=${VITE_APP_GIPHY_API_KEY_PLACEHOLDER}

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=linux/amd64 nginx:1.27-alpine

# Copy the built application
COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

# Copy nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create libraries directory for pre-bundled libraries (mounted via Docker volume)
RUN mkdir -p /app/libraries

# Copy the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Use custom entrypoint to inject environment variables at runtime
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# ci: verify image build/push works
