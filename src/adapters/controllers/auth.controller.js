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

/**
 * Handler login. Ngoper username & password (udah lolos validasi & captcha) ke
 * use case login, terus balikin access token, refresh token, sama profil
 * singkat.
 *
 * Dipake di:
 * - auth.routes.js → POST /api/auth/login
 * - Frontend: feat/auth/actions.ts → loginAction (halaman Login).
 */
async function loginController(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await login({ username, password }, req);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler buat nuker refresh token lama jadi pasangan access + refresh token
 * baru.
 *
 * Dipake di:
 * - auth.routes.js → POST /api/auth/refresh
 * - Frontend: lib/auth-shared.ts → requestTokenRefresh (dipanggil
 *   middleware.ts & app/api/auth/refresh pas axios dapet 401).
 */
async function refreshController(req, res, next) {
  try {
    const result = await refreshAccessToken(req.body.refreshToken, req);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler logout. Nyabut refresh token terus bales 204.
 *
 * Dipake di:
 * - auth.routes.js → POST /api/auth/logout
 * - Frontend: feat/auth/actions.ts → logoutAction (tombol Log out di
 *   sidebar).
 */
async function logoutController(req, res, next) {
  try {
    await logout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Handler buat ngambil profil user yang lagi login, pake id dari access token.
 *
 * Dipake di:
 * - auth.routes.js → GET /api/auth/me
 * - Frontend: lib/auth.ts → getSession (layout halaman yang butuh login,
 *   halaman Login, halaman root).
 */
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
