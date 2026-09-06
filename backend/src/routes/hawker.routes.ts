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
router.delete('/api/hawkers/:id', deleteHawker);

export default router;