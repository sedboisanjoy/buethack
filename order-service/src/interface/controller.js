const { validateOrder } = require('../domain/orderValidation');
const { placeOrder } = require('../infrastructure/orderCoordinator');
const { client: appInsightsClient } = require('../telemetry');

const createOrder = async (req, res, next) => {
  const { body: order } = req;

  // 1. Validation (Domain)
  const { valid, message } = validateOrder(order);
  if (!valid) {
    return res.status(400).json({ message });
  }

  try {
    // 2. Coordination (Infrastructure)
    const result = await placeOrder(order);
    
    // 3. Respond (Interface)
    if (result.status === 'PENDING_VERIFICATION') {
      // Accepted for processing, but not yet confirmed
      return res.status(202).json(result);
    }
    // Confirmed
    return res.status(201).json(result);

  } catch (error) {
    appInsightsClient.trackException({ exception: error });
    // Let the global error handler deal with it
    next(error);
  }
};

module.exports = { createOrder };
