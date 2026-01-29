require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { setup, client: appInsightsClient } = require('./telemetry');
const { startConsumer } = require('./consumers/orderVerificationConsumer');

// Start Application Insights
setup();

// Start the Azure Service Bus consumer
startConsumer();

const PROTO_PATH = __dirname + '/../../protos/inventory.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const inventory_proto = grpc.loadPackageDefinition(packageDefinition).inventory;

// Handlers will be implemented in the next step
const { adjustStock } = require('./handlers/inventoryHandlers');

function main() {
  const server = new grpc.Server();
  server.addService(inventory_proto.Inventory.service, { adjustStock });

  const port = process.env.INVENTORY_SERVICE_PORT || 50052;
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error(`Server error: ${err.message}`);
      appInsightsClient.trackException({ exception: err });
      return;
    }
    server.start();
    console.log(`Inventory Service running at http://0.0.0.0:${port}`);
  });
}

