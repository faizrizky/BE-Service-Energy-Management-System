/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const roleUseCase = require("../../application/use_cases/role/role.usecase");

async function index(req, res, next) {
  try {
    const { page = 1, rowsPerPage = 10 } = req.query;
    const roles = await roleUseCase.listRolesPaginated({
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });
    res.json({ data: roles });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const role = await roleUseCase.getRoleById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });
    res.json({ data: role });
  } catch (err) {
    next(err);
  }
}

async function store(req, res, next) {
  try {
    const role = await roleUseCase.createRole(req.body);
    res.status(201).json({ data: role });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const role = await roleUseCase.updateRole(req.params.id, req.body);
    res.json({ data: role });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    await roleUseCase.deleteRole(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function permissionsList(req, res, next) {
  try {
    const permissions = await roleUseCase.listPermissions();
    res.json({ data: permissions });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy, permissionsList };
