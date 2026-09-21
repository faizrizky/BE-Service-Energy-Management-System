# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma membutuhkan openssl untuk engine
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

# Generate Prisma Client hanya saat build
RUN npx prisma generate


# ---- Stage 2: Production ----
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# tini untuk forwarding SIGTERM/SIGINT
RUN apk add --no-cache openssl tini

# Buat user aplikasi
RUN addgroup -S ems && adduser -S ems -G ems

COPY package*.json ./

# Prisma tetap diinstall karena aplikasi runtime
# membutuhkan @prisma/client sebagai ORM
RUN npm install --omit=dev

# Prisma Client + engine hasil generate dari builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Prisma schema tetap dipertahankan jika dibutuhkan aplikasi
COPY prisma ./prisma

# Source aplikasi
COPY src ./src

# Pastikan user runtime bisa membaca file
RUN chown -R ems:ems /app

USER ems

EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]

# Tidak ada migrate / seed / generate saat startup
CMD ["node", "src/app.js"]
