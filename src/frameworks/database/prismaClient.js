const { PrismaClient } = require('@prisma/client');
const logger = require('../helpers/logger');

const prisma = new PrismaClient();

/**
 * Buka koneksi Prisma ke PostgreSQL.
 *
 * Dipake di: app.js → bootstrap.
 */
async function connectDatabase() {
  await prisma.$connect();
  logger.info('[Database] Terhubung ke PostgreSQL');
}

/**
 * Tutup koneksi Prisma.
 *
 * Dipake di: app.js → gracefulShutdown.
 */
async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('[Database] Koneksi database ditutup');
}

module.exports = { prisma, connectDatabase, disconnectDatabase };