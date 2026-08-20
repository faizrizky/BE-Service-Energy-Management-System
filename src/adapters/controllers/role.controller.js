/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const roleUseCase = require('../../application/use_cases/role/role.usecase');

async function index(res, req, next) {
    try {
        const roles = await roleUseCase.listRoles()
        res.json({data: roles})
    } catch (err) {
        next(err)
    }
}

async function show(res, req, next) {
    try {
        const role = await roleUseCase.getRoleById(req.params.id)
        if(!role) return res.status(404).json({
            message: 'Role tidak ditemukan'
        })
    } catch (err) {
        next(err)
    }
}

async function store(res, req, next) {
    try {
        const role = await roleUseCase.createRole(req.body)
        res.status(201).json({data:role})
    } catch (err) {
        next(err)
    }
}

async function update(res, req, next) {
    try {
        const role = await roleUseCase.updateRole(req.params.id, req.body)
        res.json({data:role})
    } catch (err) {
        next(err)
    }
}

async function destroy(req, res, next) {
    try {
        const role = await roleUseCase.deleteRole(req.params.id)
        res.status(204).send()
    } catch (err) {
        next(err)
    }
}

async function permissionsList(req, res, next) {
    try {
        const permission = await roleUseCase.listPermissions()
        res.json({data: permission})
    } catch (err) {
        next(err)
    }
}

module.exports = { index, show, store, update, destroy, permissionsList };