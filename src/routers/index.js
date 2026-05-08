import express from 'express';
const router = express.Router();
import { controller } from '../controllers/index.js';
import { authVerify } from '../middleware/auth.js';
import upload from '../config/multer.js';

router.post('/auth/register', controller.register);
router.post('/auth/login', controller.login);
router.get('/auth/profile', authVerify, controller.getProfile);

router.post("/add-customer", authVerify, upload.single('profile'), controller.addCustomer);
router.get("/get-customers", authVerify, controller.getCustomers);

router.post("/add-amount/:fundId", authVerify, controller.addAmount);
router.post("/deduct-amount/:fundId", authVerify, controller.deductAmount);

router.get("/get-amount/:customerId", authVerify, controller.getAmount);

router.post("/add-fund/:customerId", authVerify, controller.addFund);
router.get("/get-all-funds/", authVerify, controller.getFunds);
router.get("/get-funds/:customerId", authVerify, controller.getCustomerFunds);
router.post("/close-fund/:fundId", authVerify, controller.closeFund);

export default router;