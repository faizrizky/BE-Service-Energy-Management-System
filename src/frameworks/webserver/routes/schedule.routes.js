const express = require('express');
const router = express.Router();

const controller = require('../../../adapters/controllers/schedule.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const checkPermission = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/', checkPermission('schedule', 'view'), controller.index);
router.get('/:id', checkPermission('schedule', 'view'), controller.show);
router.post('/', checkPermission('schedule', 'create'), controller.store);
router.put('/:id', checkPermission('schedule', 'edit'), controller.update);
router.delete('/:id', checkPermission('schedule', 'delete'), controller.destroy);

module.exports = router;