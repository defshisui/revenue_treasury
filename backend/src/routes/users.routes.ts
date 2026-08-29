// src/routes/users.routes.ts
import { Router } from 'express';
import { getUsers, createUser, deleteUser } from '../controllers/users.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/users', authenticateToken, getUsers);
router.post('/users', authenticateToken, createUser);
router.delete('/users/:id', authenticateToken, deleteUser);

export default router;