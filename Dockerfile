# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npx prisma generate

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# tini biar signal SIGTERM/SIGINT diteruskan dengan benar ke Node
# (penting buat graceful shutdown pas docker stop/restart)
RUN apk add --no-cache tini

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY src ./src

RUN addgroup -S ems && adduser -S ems -G ems
USER ems

EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]