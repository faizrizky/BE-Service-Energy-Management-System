const express = require('express');
const router = express.Router();

const controller = require('../../../adapters/controllers/gateway.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/', checkPermission('gateway', 'view'), controller.index);
router.get('/:id', checkPermission('gateway', 'view'), controller.show);
router.post('/', checkPermission('gateway', 'create'), controller.store);
router.put('/:id', checkPermission('gateway', 'edit'), controller.update);
router.delete('/:id', checkPermission('gateway', 'delete'), controller.destroy);

module.exports = router;