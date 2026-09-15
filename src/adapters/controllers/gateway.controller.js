const gatewayUseCase = require("../../application/use_cases/gateway/gateway.usecase");

/**
 * Handler list gateway pake paginasi, search & filter tanggal. Status
 * online-nya dihitung dari device yang nyambung.
 *
 * Dipake di:
 * - gateway.routes.js → GET /api/gateways
 * - Frontend: gatewaysApi.list (halaman Gateway & dropdown di halaman
 *   Device), gatewaysClientApi.list (gateway/client.tsx).
 */
async function index(req, res, next) {
  try {
    const {
      page = 1,
      rowsPerPage = 10,
      search,
      createdFrom,
      createdTo,
    } = req.query;

    const result = await gatewayUseCase.listGatewaysPaginated({
      search,
      createdFrom,
      createdTo,
      page: Number(page),
      rowsPerPage: Number(rowsPerPage),
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler detail gateway plus device & installer-nya. Kalo nggak ketemu bales
 * 404.
 *
 * Dipake di:
 * - gateway.routes.js → GET /api/gateways/:id
 * - Frontend: gatewaysClientApi.getById (detail di halaman Gateway).
 */
async function show(req, res, next) {
  try {
    const gateway = await gatewayUseCase.getGatewayById(req.params.id);
    if (!gateway)
      return res.status(404).json({ message: "Gateway tidak ditemukan" });
    res.json({ data: gateway });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler nambah gateway, bales 201.
 *
 * Dipake di:
 * - gateway.routes.js → POST /api/gateways
 * - Frontend: gatewaysClientApi.create (modal tambah gateway).
 */
async function store(req, res, next) {
  try {
    const gateway = await gatewayUseCase.createGateway(req.body);
    res.status(201).json({ data: gateway });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler ngedit gateway.
 *
 * Dipake di:
 * - gateway.routes.js → PUT /api/gateways/:id
 * - Frontend: gatewaysClientApi.update (modal edit gateway).
 */
async function update(req, res, next) {
  try {
    const gateway = await gatewayUseCase.updateGateway(req.params.id, req.body);
    res.json({ data: gateway });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler hapus gateway (ditolak 409 kalo masih ada device-nya), bales 204.
 *
 * Dipake di:
 * - gateway.routes.js → DELETE /api/gateways/:id
 * - Frontend: gatewaysClientApi.remove (halaman Gateway).
 */
async function destroy(req, res, next) {
  try {
    await gatewayUseCase.deleteGateway(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, show, store, update, destroy };
