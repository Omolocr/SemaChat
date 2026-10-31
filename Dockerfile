FROM node:22-alpine
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
ENV NODE_ENV=production PORT=3000 SEMACHAT_DB=/data/semachat.sqlite SEMACHAT_TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
USER node
CMD ["node", "backend/server.js"]
