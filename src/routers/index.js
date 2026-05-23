import express from "express";
import { controller } from "../controllers/index.js";
import { authVerify } from "../middleware/auth.js";
import upload from "../config/multer.js";

const router = express.Router();

const routes = [
  // Auth Routes
  {
    method: "post",
    path: "/auth/register",
    controller: controller.register,
  },
  {
    method: "post",
    path: "/auth/login",
    controller: controller.login,
  },
  {
    method: "get",
    path: "/auth/profile",
    auth: false,
    controller: controller.getProfile,
  },

  // Fund Routes
  {
    method: "get",
    path: "/fund-details",
    auth: false,
    controller: controller.getFundDetails,
  },
  {
    method: "get",
    path: "/daily-report",
    auth: false,
    controller: controller.dailyReport,
  },

  // Customer Routes
  {
    method: "post",
    path: "/add-customer",
    auth: false,
    upload: upload.single("profile"),
    controller: controller.addCustomer,
  },
  {
    method: "put",
    path: "/edit-customer/:customerId",
    auth: false,
    upload: upload.single("profile"),
    controller: controller.editCustomer,
  },
  {
    method: "get",
    path: "/get-customers",
    controller: controller.getAllCustomersDetails,
  },

  // Amount Routes
  {
    method: "post",
    path: "/add-amount/:fundId",
    auth: false,
    controller: controller.addAmount,
  },
  {
    method: "post",
    path: "/deduct-amount/:fundId",
    auth: false,
    controller: controller.deductAmount,
  },

  // Fund Management
  {
    method: "get",
    path: "/get-all-funds",
    auth: false,
    controller: controller.getFunds,
  },
  {
    method: "post",
    path: "/add-fund/:customerId",
    auth: false,
    controller: controller.addFund,
  },
  {
    method: "put",
    path: "/edit-fund/:fundId",
    auth: false,
    controller: controller.editFund,
  },
  {
    method: "get",
    path: "/get-funds/:customerId",
    auth: false,
    controller: controller.getCustomerFunds,
  },
  // Close Fund
  {
    method: "post",
    path: "/close-fund/:fundId",
    auth: false,
    controller: controller.closeFund,
  },
  {
    method: "get",
    path: "/get-amount/:customerId",
    auth: false,
    controller: controller.getAmount,
  },
];

routes.forEach((route) => {
  const middlewares = [];

  if (route.auth) {
    middlewares.push(authVerify);
  }

  if (route.upload) {
    middlewares.push(route.upload);
  }

  middlewares.push(route.controller);

  router[route.method](route.path, ...middlewares);
});

export default router;