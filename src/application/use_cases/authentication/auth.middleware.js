/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */

import { config } from '../../../config/config';
const jwt = require('jsonwebtoken');

function authMiddleware(req,res,next) {
    const authHeader = req.headers.authorization
    
    if(!authHeader || authHeader.startsWith('Bearer ')){
        return res.status(401).json({
            message: 'Token tidak ditemukan'
        })
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, config.jwt.secret)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({
            message: 'Token tidak valid atau kadaluarsa'
        })
    }
}

module.exports = authMiddleware