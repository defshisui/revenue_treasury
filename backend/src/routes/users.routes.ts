import { Router } from 'express';
import { getUsers, createUser, deleteUser } from '../controllers/users.controller.js';
import { updateUserStatus } from '../controllers/users.controller.js';

const router = Router();

router.get('/users', getUsers);
router.post('/users', createUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/status', updateUserStatus);

export default router;