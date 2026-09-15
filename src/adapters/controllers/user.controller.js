const userUseCase = require("../../application/use_cases/user/user.usecase");

/**
 * Handler list user pake paginasi, bisa filter role, search, sama tanggal.
 * passwordHash nggak ikut dikirim.
 *
 * Dipake di:
 * - user.routes.js → GET /api/users
 * - Frontend: usersApi.list (halaman User), usersApi.listSummary (dropdown
 *   PIC/installer di Rooms, Room detail, Gateway), usersClientApi.list
 *   (user/client.tsx).
 */
async function index(req, res, next) {
  try {
    const {
      roleId,
      page = 1,
      rowsPerPage = 10,
      search,
      createdFrom,
      createdTo,
    } = req.query;
    const users = await userUseCase.listUsersPaginated({
      search,
      roleId,
      createdFrom,
      createdTo,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler detail user. Kalo nggak ketemu bales 404.
 *
 * Dipake di:
 * - user.routes.js → GET /api/users/:id
 * - Frontend: belom dipanggil.
 */
async function show(req, res, next) {
  try {
    const user = await userUseCase.getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler nambah user, bales 201.
 *
 * Dipake di:
 * - user.routes.js → POST /api/users
 * - Frontend: usersClientApi.create (modal tambah user).
 */
async function store(req, res, next) {
  try {
    const user = await userUseCase.createUser(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ngedit user (password di-hash ulang kalo diisi).
 *
 * Dipake di:
 * - user.routes.js → PUT /api/users/:id
 * - Frontend: usersClientApi.update (modal edit user).
 */
async function update(req, res, next) {
  try {
    const user = await userUseCase.updateUser(req.params.id, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler hapus user, bales 204.
 *
 * Dipake di:
 * - user.routes.js → DELETE /api/users/:id
 * - Frontend: usersClientApi.remove (halaman User).
 */
async function destroy(req, res, next) {
  try {
    await userUseCase.deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Handler buat user ngedit profilnya sendiri (nama, telepon, alamat, avatar)
 * tanpa perlu permission user.edit.
 *
 * Dipake di:
 * - user.routes.js → PUT /api/users/me
 * - Frontend: belom dipanggil.
 */
async function updateMyProfile(req, res, next) {
  try {
    const user = await userUseCase.updateProfile(req.user.id, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy, updateMyProfile };
