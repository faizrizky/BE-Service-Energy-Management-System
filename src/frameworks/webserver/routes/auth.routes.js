const express = require('express');
const router = express.Router();

const { loginController, meController } = require('../../../adapters/controllers/auth.controller');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/login', loginController);
router.get('/me', authMiddleware, meController);

module.exports = router;