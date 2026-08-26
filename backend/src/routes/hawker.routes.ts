// src/routes/hawker.routes.ts
import { Router } from 'express';
import {
    getHawkers,
    createHawker,
    updateHawkerStatus,
    deleteHawker
} from '../controllers/hawker.controller.js';

const router = Router();

router.get('/api/hawkers', getHawkers);
router.post('/api/hawkers', createHawker);
router.patch('/api/hawkers/:id', updateHawkerStatus);
// The new DELETE route for hawker associations
router.delete('/api/hawkers/:id', deleteHawker);

export default router;