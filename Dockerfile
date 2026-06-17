# Container for the UMI Microsoft 365 extraction service (npm run serve:ms).
# Deploy to Azure Container Apps / Functions (custom handler) or any host Power
# Automate can reach over HTTPS.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/kb ./kb
# Required: ANTHROPIC_API_KEY. Optional: UMI_EXTRACT_TOKEN, PORT (default 8787),
# UMI_EXTRACT_MODEL, UMI_MEMORY_PATH (mount a volume to persist learning).
EXPOSE 8787
CMD ["node", "dist/microsoft/server.js"]
