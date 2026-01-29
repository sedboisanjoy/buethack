require('dotenv').config();
const express = require('express');
const { setup, client: appInsightsClient } = require('./telemetry');
const orderRoutes = require('./interface/routes');

// Start Application Insights
setup();

const app = express();
app.use(express.json());

// Use routes
app.use('/api', orderRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  appInsightsClient.trackException({ exception: err });
  res.status(500).send('Something broke!');
});

const port = process.env.ORDER_SERVICE_PORT || 3000;
app.listen(port, () => {
  console.log(`Order Service listening on port ${port}`);
});
