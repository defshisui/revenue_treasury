// src/routes/citizens.routes.ts
import { Router } from 'express';
import { getCitizen, saveCitizen } from '../controllers/citizens.controller.js';

const router = Router();

router.get('/citizens/:userId', getCitizen);
router.post('/citizens', saveCitizen);

export default router;
