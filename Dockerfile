FROM node:22-alpine AS client-builder
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM node:22-alpine AS cloudflared
RUN apk add --no-cache curl
RUN curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /cloudflared && chmod +x /cloudflared

FROM node:22-alpine
ENV NODE_ENV=production
RUN apk add --no-cache ca-certificates
COPY --from=cloudflared /cloudflared /usr/local/bin/cloudflared
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=client-builder /client/dist ./client/dist
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 3001
CMD ["/start.sh"]
