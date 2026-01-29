const { Pool } = require('pg');
const { client: appInsightsClient } = require('../telemetry');

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  appInsightsClient.trackException({ exception: err });
  process.exit(-1);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    appInsightsClient.trackDependency({
      target: pool.options.host,
      name: 'PostgreSQL',
      data: text,
      duration: duration,
      resultCode: 0,
      success: true,
      dependencyTypeName: 'SQL'
    });
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    appInsightsClient.trackDependency({
      target: pool.options.host,
      name: 'PostgreSQL',
      data: text,
      duration: duration,
      resultCode: 1,
      success: false,
      dependencyTypeName: 'SQL'
    });
    appInsightsClient.trackException({ exception: err });
    throw err;
  }
};

module.exports = { query, pool };
