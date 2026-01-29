const { ServiceBusClient } = require("@azure/service-bus");
const { client: appInsightsClient } = require('../telemetry');

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const queueName = "verify-order-queue"; 

const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(queueName);

const sendMessage = async (message) => {
  try {
    await sender.sendMessages(message);
    appInsightsClient.trackDependency({
        target: sbClient.fullyQualifiedNamespace,
        name: 'Azure Service Bus',
        data: `Sent message to queue: ${queueName}`,
        duration: 0, // Simplified for this example
        resultCode: 0,
        success: true,
        dependencyTypeName: 'Azure Service Bus'
    });
  } catch (err) {
    console.error("Error sending message to Service Bus:", err);
    appInsightsClient.trackException({ exception: err });
    throw err;
  }
};

// We don't close the client here because it's a long-lived application.
// In a real app, you'd handle graceful shutdown.

module.exports = { sendMessage };
