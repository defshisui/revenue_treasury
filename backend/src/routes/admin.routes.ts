// src/routes/admin.routes.ts
import { Router } from 'express';
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  uploadAdminAvatar,
} from '../controllers/admin.controller.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Get logged-in admin profile by email
router.get('/admin/profile', getAdminProfile);

// Update admin profile info (name, email, phone, department, address)
router.patch('/admin/profile', updateAdminProfile);

// Change admin password (requires current + new password)
router.patch('/admin/change-password', changeAdminPassword);

// Upload avatar photo
router.post('/admin/upload-avatar', upload.single('avatar'), uploadAdminAvatar);

export default router;
