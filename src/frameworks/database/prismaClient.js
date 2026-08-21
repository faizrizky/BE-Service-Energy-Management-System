const { PrismaClient } = require('@prisma/client');
const logger = require('../helpers/logger');

const prisma = new PrismaClient();

async function connectDatabase() {
  await prisma.$connect();
  logger.info('[Database] Terhubung ke PostgreSQL');
}

async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('[Database] Koneksi database ditutup');
}

module.exports = { prisma, connectDatabase, disconnectDatabase };