FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY api ./api
COPY services ./services

EXPOSE 2222
CMD ["npm", "run", "ssh:dev"]
