const userUseCase = require("../../application/use_cases/user/user.usecase");

async function index(req, res, next) {
  try {
    const { roleId, page = 1, rowsPerPage = 10, search } = req.query;
    const users = await userUseCase.listUsersPaginated({
      search,
      roleId,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const user = await userUseCase.getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

async function store(req, res, next) {
  try {
    const user = await userUseCase.createUser(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const user = await userUseCase.updateUser(req.params.id, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    await userUseCase.deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const user = await userUseCase.updateProfile(req.user.id, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy, updateMyProfile };
