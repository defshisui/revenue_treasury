import { Router } from 'express';
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  updateAdminAvatar,
} from '../controllers/admin.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/admin/profile', authenticateToken, getAdminProfile);

router.patch('/admin/profile', authenticateToken, updateAdminProfile);

router.patch('/admin/change-password', authenticateToken, changeAdminPassword);

router.patch('/admin/avatar', authenticateToken, updateAdminAvatar);

export default router;
