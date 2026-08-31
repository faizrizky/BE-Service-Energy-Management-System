const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Daftar module & action
const PERMISSIONS = [
  ["dashboard", "view"],

  ["schedule", "view"],
  ["schedule", "create"],
  ["schedule", "edit"],
  ["schedule", "delete"],

  ["room", "view"],
  ["room", "create"],
  ["room", "edit"],
  ["room", "delete"],
  ["room", "power_control"],

  ["device", "view"],
  ["device", "create"],
  ["device", "edit"],
  ["device", "delete"],
  ["device", "power_control"],

  ["gateway", "view"],
  ["gateway", "create"],
  ["gateway", "edit"],
  ["gateway", "delete"],

  ["report", "view"],
  ["report", "list"],
  ["report", "export"],

  ["user", "view"],
  ["user", "create"],
  ["user", "edit"],
  ["user", "delete"],

  ["role", "view"],
  ["role", "create"],
  ["role", "edit"],
  ["role", "delete"],
  ["alarm", "view"],
  ["alarm", "ack"],
];

const ROLE_PERMISSIONS = {
  "PJ Gedung": [
    // Energy monitoring
    ["dashboard", "view"],

    // Schedule
    ["schedule", "view"],

    // Room
    ["room", "view"],
    ["room", "power_control"],

    // Device
    ["device", "view"],
    ["device", "create"],
    ["device", "edit"],
    ["device", "delete"],
    ["device", "power_control"],

    // Gateway
    ["gateway", "view"],
    ["gateway", "create"],
    ["gateway", "edit"],
    ["gateway", "delete"],

    // Report
    ["report", "view"],

    // Alarm
    ["alarm", "view"],
    ["alarm", "ack"],
  ],
  Komandan: [
    // Energy monitoring
    ["dashboard", "view"],

    // Schedule
    ["schedule", "view"],

    // Room
    ["room", "view"],

    // Device
    ["device", "view"],

    // Report
    ["report", "view"],
    ["report", "list"],
  ],
  Administrator: PERMISSIONS,
};

async function main() {
  console.log("[Seed] Membuat permissions...");
  for (const [module, action] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { module_action: { module, action } },
      update: {},
      create: { module, action },
    });
  }

  console.log("[Seed] Membuat roles + mapping permission...");
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: true },
    });

    for (const [module, action] of perms) {
      const permission = await prisma.permission.findUnique({
        where: { module_action: { module, action } },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log("[Seed] Membuat akun admin default...");
  const adminRole = await prisma.role.findUnique({
    where: { name: "Administrator" },
  });
  const passwordHash = await bcrypt.hash("changeme123", 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      fullName: "Administrator",
      username: "admin",
      email: "admin@falahtech.co.id",
      passwordHash,
      roleId: adminRole.id,
    },
  });

  console.log(
    '[Seed] Selesai. Akun admin default: username="admin", password="changeme123" (WAJIB diganti).',
  );
}

main()
  .catch((err) => {
    console.error("[Seed] Gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
