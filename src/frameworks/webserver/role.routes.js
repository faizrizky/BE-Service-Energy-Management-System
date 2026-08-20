const express = require('express');
const router = express.Router();

const controller = require('../../../adapters/controllers/role.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/rbacMiddleware');

router.use(authMiddleware)

router.get('/permissions', checkPermission('role', 'view'), controller.permissionsList);
router.get('/', checkPermission('role', 'view'), controller.index);
router.get('/:id', checkPermission('role', 'view'), controller.show);
router.get('/', checkPermission('role', 'create'), controller.store);
router.get('/:id', checkPermission('role', 'edit'), controller.update);
router.get('/:id', checkPermission('role', 'delete'), controller.destroy);

module.exports = router