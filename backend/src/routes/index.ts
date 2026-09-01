// src/routes/index.ts
// Central router Central router - mounts all feature routers
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import citizensRoutes from './citizens.routes.js';
import auditRoutes from './audit.routes.js';
import rptRoutes from './rpt.routes.js';
import marketRoutes from './market.routes.js';
import hawkerRoutes from './hawker.routes.js';
import businessRoutes from './business.routes.js'; // 1. Import business routes
import adminRoutes from './admin.routes.js';
import paymentRoutes from './payment.routes.js';

const router = Router();

router.use(authRoutes);
router.use(usersRoutes);
router.use(citizensRoutes);
router.use(auditRoutes);
router.use(rptRoutes);
router.use(marketRoutes);
router.use(hawkerRoutes);
router.use(businessRoutes); // 2. Mount business routes
router.use(adminRoutes);
router.use(paymentRoutes);

export default router;