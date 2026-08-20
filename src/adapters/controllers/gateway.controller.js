const gatewayUseCase = require('../../application/use_cases/gateway/gateway.usecase');

async function index(req, res, next) {
  try {
    const gateways = await gatewayUseCase.listGateways();
    res.json({ data: gateways });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const gateway = await gatewayUseCase.getGatewayById(req.params.id);
    if (!gateway) return res.status(404).json({ message: 'Gateway tidak ditemukan' });
    res.json({ data: gateway });
  } catch (err) {
    next(err);
  }
}

async function store(req, res, next) {
  try {
    const gateway = await gatewayUseCase.createGateway(req.body);
    res.status(201).json({ data: gateway });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const gateway = await gatewayUseCase.updateGateway(req.params.id, req.body);
    res.json({ data: gateway });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    await gatewayUseCase.deleteGateway(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy };