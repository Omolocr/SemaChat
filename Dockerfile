FROM node:22-alpine
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
RUN mkdir -p /data && chown -R node:node /data /app
ENV NODE_ENV=production PORT=3000 SEMACHAT_DB=/data/semachat.json SEMACHAT_TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT:-3000}/healthz || exit 1
USER node
CMD ["node", "backend/server.js"]
