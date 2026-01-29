const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = __dirname + '/../../../protos/inventory.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const inventory_proto = grpc.loadPackageDefinition(packageDefinition).inventory;
const inventoryServiceUrl = process.env.INVENTORY_SERVICE_URL || 'localhost:50052';

const client = new inventory_proto.Inventory(inventoryServiceUrl, grpc.credentials.createInsecure());

module.exports = client;
