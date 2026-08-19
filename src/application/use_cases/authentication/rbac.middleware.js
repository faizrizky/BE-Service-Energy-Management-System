/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */

import { prisma } from '../../../frameworks/database/prismaClient'


 function checkPermission(module, action) {
    return async(req,res,next) =>{
        try {
            const roleId = req.user?.roleId

            if(!roleId){
                return res.status(403).json({
                    message: 'Role tidak ditemukan pada token'
                })
            }

            const permission = await prisma.rolePermission.findFirst({
                where: {
                    roleId: roleId,
                    permission: {module,action}
                }
            })

            if(!permission){
                return res.status(403).json({
                    message: 'Akses ditolak: role kamu tidak memiliki izin ${module}.${action}'
                })
            }

            next()
        } catch (err) {
            next(err)
        }
    }
 }

 module.export = checkPermission