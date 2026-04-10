# Simple robust Dockerfile for HR
FROM node:22-alpine
WORKDIR /app
COPY .env ./
COPY kalles-hr/package*.json ./kalles-hr/
COPY kalles-traffic/package*.json ./kalles-traffic/
RUN cd kalles-hr && npm install --legacy-peer-deps
COPY kalles-hr ./kalles-hr
COPY kalles-traffic ./kalles-traffic
WORKDIR /app/kalles-hr

CMD ["npx", "ts-node", "src/index.ts"]
