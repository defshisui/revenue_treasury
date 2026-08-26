// src/routes/hawker.routes.ts
import { Router } from 'express';
import { getHawkers, createHawker, updateHawkerStatus } from '../controllers/hawker.controller.js';

const router = Router();

router.get('/api/hawkers', getHawkers);
router.post('/api/hawkers', createHawker);
router.patch('/api/hawkers/:id', updateHawkerStatus);

export default router;
