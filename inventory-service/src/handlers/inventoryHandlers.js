const { adjustStockDb } = require('../domain/stockLogic');
const { client: appInsightsClient } = require('../telemetry');

const gremlinMiddleware = (call, callback, next) => {
  if (process.env.GREMLIN_MODE === 'true') {
    const latency = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000; // 2-5 seconds
    console.log(`Gremlin Mode: Adding ${latency}ms latency.`);
    appInsightsClient.trackTrace({ message: `Gremlin Mode: Adding ${latency}ms latency.` });
    setTimeout(() => {
      next(call, callback);
    }, latency);
  } else {
    next(call, callback);
  }
};

const adjustStock = (call, callback) => {
  const handler = async (call, callback) => {
    try {
      const { itemId, quantity } = call.request;
      if (!itemId || !quantity) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'itemId and quantity are required',
        });
      }

      const result = await adjustStockDb(itemId, quantity);
      callback(null, result);

    } catch (error) {
      console.error('Error adjusting stock:', error);
      appInsightsClient.trackException({ exception: error });
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to adjust stock',
      });
    }
  };

  gremlinMiddleware(call, callback, handler);
};

module.exports = { adjustStock };
