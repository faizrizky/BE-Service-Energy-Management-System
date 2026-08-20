/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */

const { login } = require('../../application/use_cases/authentication/login.usecase');
const { getMe } = require('../../application/use_cases/authentication/getMe.usecase');

async function loginController(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'username dan password wajib diisi' });
    }
    const result = await login({ username, password });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function meController(req, res, next) {
  try {
    const user = await getMe(req.user.id);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { loginController, meController };