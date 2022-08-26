FROM node:16-alpine AS builder

WORKDIR /usr/share/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:16-alpine

WORKDIR /home/node/app

COPY --from=builder /usr/share/app/dist/ /usr/share/app/package*.json ./
RUN npm ci --omit=dev

ENTRYPOINT ["node", "/home/node/app/bin/scraper.js"]