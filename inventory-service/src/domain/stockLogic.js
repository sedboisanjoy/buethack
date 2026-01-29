const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const adjustStockDb = async (itemId, quantity) => {
  const transactionId = uuidv4();
  // This is a simplified example. In a real-world scenario, you'd have
  // proper transaction management (BEGIN, COMMIT, ROLLBACK).
  await db.query('UPDATE inventory SET stock = stock - $1 WHERE id = $2', [quantity, itemId]);
  // We'll assume the update is successful if no error is thrown.
  return { transactionId, success: true };
};

const verifyAndAdjustStock = async (orderId, itemId, quantity) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Check if this order has already been processed
        const { rows } = await client.query('SELECT * FROM order_transactions WHERE order_id = $1', [orderId]);
        if (rows.length > 0) {
            console.log(`Order ${orderId} has already been processed. Skipping.`);
            return; // Idempotency check passed
        }

        // Adjust stock
        await client.query('UPDATE inventory SET stock = stock - $1 WHERE id = $2', [quantity, itemId]);

        // Record the transaction
        const transactionId = uuidv4();
        await client.query(
            'INSERT INTO order_transactions (transaction_id, order_id, item_id, quantity) VALUES ($1, $2, $3, $4)',
            [transactionId, orderId, itemId, quantity]
        );

        await client.query('COMMIT');
        console.log(`Order ${orderId} processed and stock adjusted successfully.`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed to verify and adjust stock for order ${orderId}:`, error);
        throw error; // Re-throw to be handled by the consumer
    } finally {
        client.release();
    }
};

module.exports = { adjustStockDb, verifyAndAdjustStock };
