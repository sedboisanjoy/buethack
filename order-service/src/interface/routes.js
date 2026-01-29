const express = require('express');
const router = express.Router();
const { createOrder } = require('./controller');

router.post('/orders', createOrder);

module.exports = router;
