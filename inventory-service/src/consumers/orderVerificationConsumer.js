const { ServiceBusClient } = require("@azure/service-bus");
const { client: appInsightsClient } = require('../telemetry');
const { verifyAndAdjustStock } = require('../domain/stockLogic');

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const queueName = "verify-order-queue";

const startConsumer = () => {
  const sbClient = new ServiceBusClient(connectionString);
  const receiver = sbClient.createReceiver(queueName);

  const myMessageHandler = async (messageReceived) => {
    console.log(`Received message: ${JSON.stringify(messageReceived.body)}`);
    appInsightsClient.trackTrace({ message: "Received order verification message from queue." });
    try {
      const { orderId, itemId, quantity } = messageReceived.body;
      // Idempotently process the message
      await verifyAndAdjustStock(orderId, itemId, quantity);
      // Complete the message so it is not received again.
      await receiver.completeMessage(messageReceived);
    } catch (error) {
      console.error("Failed to process verification message:", error);
      appInsightsClient.trackException({ exception: error });
      // Do not complete the message, let it be re-processed or dead-lettered.
    }
  };

  const myErrorHandler = async (error) => {
    console.log(error);
    appInsightsClient.trackException({ exception: new Error(error.error.message) });
  };

  receiver.subscribe({
    processMessage: myMessageHandler,
    processError: myErrorHandler
  });

  console.log(`Started consumer for queue: ${queueName}`);
};

module.exports = { startConsumer };
