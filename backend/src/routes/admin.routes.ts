// src/routes/admin.routes.ts
import { Router } from 'express';
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  updateAdminAvatar,
} from '../controllers/admin.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get logged-in admin profile by email
router.get('/admin/profile', authenticateToken, getAdminProfile);

// Update admin profile info (name, email, phone, department, address)
router.patch('/admin/profile', authenticateToken, updateAdminProfile);

// Change admin password (requires current + new password)
router.patch('/admin/change-password', authenticateToken, changeAdminPassword);

// Update avatar (base64 stored in DB)
router.patch('/admin/avatar', authenticateToken, updateAdminAvatar);

export default router;
