import { Router } from 'express';
import { getCitizen, saveCitizen } from '../controllers/citizens.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/citizens/:userId', authenticateToken, getCitizen);
router.post('/citizens', authenticateToken, saveCitizen);

export default router;
