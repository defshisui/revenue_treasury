import { Router } from 'express';
import {
  getTransactions,
  createTransaction,
  getMarketLeases,
  createMarketLease,
  updateMarketLease,
  deleteMarketLease,
  fraudScan,
} from '../controllers/market.controller.js';

const router = Router();

router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);

router.get('/market-leases', getMarketLeases);
router.post('/market-leases', createMarketLease);
router.put('/market-leases/:id', updateMarketLease);
router.delete('/market-leases/:id', deleteMarketLease);

router.post('/api/ai/fraud-scan', fraudScan);

export default router;
