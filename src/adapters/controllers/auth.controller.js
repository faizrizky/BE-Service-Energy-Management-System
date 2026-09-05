const {
  login,
} = require("../../application/use_cases/authentication/login.usecase");
const {
  getMe,
} = require("../../application/use_cases/authentication/getMe.usecase");
const {
  refreshAccessToken,
} = require("../../application/use_cases/authentication/refreshToken.usecase");
const {
  logout,
} = require("../../application/use_cases/authentication/logout.usecase");

async function loginController(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await login({ username, password });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function refreshController(req, res, next) {
  try {
    const result = await refreshAccessToken(req.body.refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function logoutController(req, res, next) {
  try {
    await logout(req.body.refreshToken);
    res.status(204).send();
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

module.exports = {
  loginController,
  meController,
  refreshController,
  logoutController,
};
