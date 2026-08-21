const express = require('express');
const router = express.Router();

const controller = require('../../../adapters/controllers/device.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/', checkPermission('device', 'view'), controller.index);
router.get('/:id', checkPermission('device', 'view'), controller.show);
router.post('/', checkPermission('device', 'create'), controller.store);
router.put('/:id', checkPermission('device', 'edit'), controller.update);
router.delete('/:id', checkPermission('device', 'delete'), controller.destroy);
router.post('/:id/power', checkPermission('device', 'power_control'), controller.power);

module.exports = router;