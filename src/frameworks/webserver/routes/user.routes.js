const express = require('express');
const router = express.Router();

const controller = require('../../../adapters/controllers/user.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.put('/me', controller.updateMyProfile);

router.get('/', checkPermission('user', 'view'), controller.index);
router.get('/:id', checkPermission('user', 'view'), controller.show);
router.post('/', checkPermission('user', 'create'), controller.store);
router.put('/:id', checkPermission('user', 'edit'), controller.update);
router.delete('/:id', checkPermission('user', 'delete'), controller.destroy);

module.exports = router;