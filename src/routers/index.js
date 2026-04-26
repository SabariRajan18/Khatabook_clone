import express from 'express';
const router = express.Router();
import { controller } from '../controllers/index.js';
import { authVerify } from '../middleware/auth.js';
import upload from '../config/multer.js';

router.post('/auth/register', controller.register);
router.post('/auth/login', controller.login);
router.get('/auth/profile',authVerify, controller.getProfile);

router.post("/add-customer", authVerify, upload.single('profile'), controller.addCustomer);
router.get("/get-customers",authVerify, controller.getCustomers);
// router.get("/get-customer/:id", authVerify, controller.getCustomerById);
// router.put("/update-customer/:id", authVerify, controller.updateCustomer);
// router.delete("/delete-customer/:id", authVerify, controller.deleteCustomer);

router.post("/add-amount/:customerId", authVerify, controller.addAmount);
router.post("/deduct-amount/:customerId", authVerify, controller.deductAmount);
router.get("/get-amount/:customerId", authVerify, controller.getAmount);

export default router;