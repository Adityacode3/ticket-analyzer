# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build the production bundle
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
# Serve the built static files with a lightweight nginx image
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]