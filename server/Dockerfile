FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
ENV NODE_ENV=production PORT=8097 DATA_FILE=/data/push.json
EXPOSE 8097
CMD ["node", "src/index.js"]
