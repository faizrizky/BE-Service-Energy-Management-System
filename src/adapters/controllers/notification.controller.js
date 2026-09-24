/**
 * 
 * Blueprint Index
 *
*/
async function index(req, res) {
  res.json({
    "messages": "index"
  });
}

/**
 * 
 * Blueprint Show
 *
*/
async function show(req, res, next) {
  res.json({
    "messages": "show"
  });
}

/**
 * 
 * Blueprint Create
 *
*/
async function store(req, res, next) {
  res.json({
    "messages": "store"
  });
}

/**
 * 
 * Blueprint Update
 *
*/
async function update(req, res, next) {
  res.json({
    "messages": "store"
  });
}

/**
 * 
 * Blueprint Delete
 *
*/
async function destroy(req, res, next) {
  res.json({
    "messages": "delete"
  });
}

module.exports = { index, show, store, update, destroy };
