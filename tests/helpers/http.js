function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    ip: "127.0.0.1",
    user: { id: "user-1", roleId: "role-1" },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  return res;
}

function mockNext() {
  return jest.fn();
}

/** Response fetch palsu untuk client HTTP yang memakai global fetch. */
function fetchResponse({ status = 200, body, headers = {} } = {}) {
  const text =
    body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    text: jest.fn().mockResolvedValue(text),
    json: jest.fn().mockImplementation(async () => JSON.parse(text)),
  };
}

module.exports = { mockReq, mockRes, mockNext, fetchResponse };
