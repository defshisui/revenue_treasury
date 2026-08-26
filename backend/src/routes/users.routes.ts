// src/routes/users.routes.ts
import { Router } from 'express';
import { getUsers, createUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/users', getUsers);
router.post('/users', createUser);

export default router;
