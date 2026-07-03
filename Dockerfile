FROM node:22-alpine AS client-builder
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=client-builder /client/dist ./client/dist
EXPOSE 3001
CMD ["node", "server/index.js"]
