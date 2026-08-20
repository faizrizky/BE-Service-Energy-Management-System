const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
import { config } from '../../../config/config';
import { prisma } from '../../../frameworks/database/prismaClient';

function login(username, password) {
    const user = await prisma.user.findUnique({
        where: {username},
        include: {role: true}
    })

    if (!user){
        const err = new Error('Username atau password salah')
        err.status = 401
        throw err
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid){
        const err = new Error('Username atau password salah')
        err.status = 401
        throw err     
    }

    const token = jwt.sign(
    { id: user.id, roleId: user.roleId, roleName: user.role.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  )

  return{
    token,
    user:{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name
    }
  }
}

module.exports = {login}