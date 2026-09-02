FROM node:18-alpine

WORKDIR /excalidraw-room

# Copy package files first for better caching
COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# Environment variables
ENV PORT=80
ENV CORS_ORIGIN=*

EXPOSE 80

# Run the server
CMD ["node", "dist/index.js"]
