const grpcClient = require('./grpcClient');
const messaging = require('./messaging');
const { client: appInsightsClient } = require('../telemetry');

const placeOrder = (order) => {
  return new Promise((resolve, reject) => {
    const { itemId, quantity } = order;
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 2); // 2-second timeout

    grpcClient.adjustStock({ itemId, quantity }, { deadline }, (error, response) => {
      if (error) {
        appInsightsClient.trackException({ exception: error });
        // Handle gRPC errors, including timeout (DEADLINE_EXCEEDED)
        if (error.code === grpc.status.DEADLINE_EXCEEDED) {
          console.log('gRPC deadline exceeded. Sending message to Service Bus for verification.');
          const message = {
            body: { orderId: "some-generated-order-id", itemId, quantity }, // In a real app, generate a unique order ID
            contentType: "application/json"
          };
          messaging.sendMessage(message)
            .then(() => {
              // Respond to the client that the order is being processed
              resolve({ status: 'PENDING_VERIFICATION', message: 'Order is being verified asynchronously.' });
            })
            .catch(messagingError => {
              console.error('Failed to send verification message:', messagingError);
              reject(new Error('Inventory service is unavailable, and could not queue for verification.'));
            });
        } else {
          console.error('gRPC error:', error.message);
          reject(new Error(`Error communicating with inventory service: ${error.details}`));
        }
      } else {
        console.log('Stock adjustment successful:', response);
        resolve({ status: 'CONFIRMED', transactionId: response.transactionId });
      }
    });
  });
};

module.exports = { placeOrder };
