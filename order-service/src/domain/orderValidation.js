const validateOrder = (order) => {
    const { itemId, quantity } = order;
    if (!itemId || typeof itemId !== 'string') {
      return { valid: false, message: 'Invalid or missing itemId' };
    }
    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return { valid: false, message: 'Invalid or missing quantity' };
    }
    return { valid: true, message: '' };
  };
  
  module.exports = { validateOrder };
  