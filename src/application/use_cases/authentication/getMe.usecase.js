import { prisma } from '../../../frameworks/database/prismaClient';

async function getMe(userId) {
    const user = await prisma.user.findUnique({
        where: {id:userId},
        include: {role: true}
    })

    if(!user){
        const err = new Error('User tidak ditemukan')
        err.status = 404
        throw err
    }

    return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    address: user.address,
    avatarUrl: user.avatarUrl,
    role: user.role.name,
  };
}

module.exports = {getMe}