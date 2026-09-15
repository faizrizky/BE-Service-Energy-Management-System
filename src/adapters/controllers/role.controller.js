const roleUseCase = require("../../application/use_cases/role/role.usecase");

/**
 * Handler list role pake paginasi, plus permission & jumlah user-nya.
 *
 * Dipake di:
 * - role.routes.js → GET /api/roles
 * - Frontend: rolesApi.list (halaman Role), rolesApi.listSummary (dropdown
 *   role di halaman User), rolesClientApi.list (role/client.tsx).
 */
async function index(req, res, next) {
  try {
    const { page = 1, rowsPerPage = 10, search } = req.query;
    const roles = await roleUseCase.listRolesPaginated({
      search,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });
    res.json({ data: roles });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler detail role plus permission-nya. Kalo nggak ketemu bales 404.
 *
 * Dipake di:
 * - role.routes.js → GET /api/roles/:id
 * - Frontend: belom dipanggil halaman mana pun.
 */
async function show(req, res, next) {
  try {
    const role = await roleUseCase.getRoleById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });
    res.json({ data: role });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler nambah role sekalian pasang permission-nya, bales 201.
 *
 * Dipake di:
 * - role.routes.js → POST /api/roles
 * - Frontend: rolesClientApi.create (modal tambah role).
 */
async function store(req, res, next) {
  try {
    const role = await roleUseCase.createRole(req.body);
    res.status(201).json({ data: role });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ngedit role. Kalo permissionIds dikirim, permission lama diganti
 * semua.
 *
 * Dipake di:
 * - role.routes.js → PUT /api/roles/:id
 * - Frontend: rolesClientApi.update (modal edit role).
 */
async function update(req, res, next) {
  try {
    const role = await roleUseCase.updateRole(req.params.id, req.body);
    res.json({ data: role });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler hapus role, bales 204.
 *
 * Dipake di:
 * - role.routes.js → DELETE /api/roles/:id
 * - Frontend: rolesClientApi.remove (halaman Role).
 */
async function destroy(req, res, next) {
  try {
    await roleUseCase.deleteRole(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Handler daftar semua permission (module + action) buat form role.
 *
 * Dipake di:
 * - role.routes.js → GET /api/roles/permissions
 * - Frontend: rolesApi.listPermissions (halaman Role).
 */
async function permissionsList(req, res, next) {
  try {
    const permissions = await roleUseCase.listPermissions();
    res.json({ data: permissions });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy, permissionsList };
