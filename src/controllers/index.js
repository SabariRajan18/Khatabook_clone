import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userDB from "../models/Admin.js";
import customerModel from "../models/Customers.js";
import Transaction from "../models/Transactions.js";
import Funds from "../models/Funds.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { get } from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

function getAuthHeaderToken(headers) {
  const authHeader = headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
const handleError = (res, error) => {
  console.error('Error:', error.message);

  if (error.message.includes('already exists')) {
    res.status(409).json({
      success: false,
      message: error.message
    });
  } else if (error.message.includes('Invalid') || error.message.includes('required')) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  } else if (error.message.includes('token')) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const controller = {

  async register(req, res) {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        throw new Error('Email, password, and name are required');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      };
      const existingUser = await userDB.findOne({ email });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      const hashedPassword = await bcryptjs.hash(password, 10);
      const user = await userDB.create({
        email,
        password: hashedPassword,
        name
      });
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const user = await userDB.findOne({ email });
      if (!user) {
        throw new Error('Invalid email or password');
      }

      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }
      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getProfile(req, res) {
    try {

      const admin = await userDB.findById(req.adminId).select('-password');
      if (!admin) {
        res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        user: admin
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  addCustomer: async (req, res) => {
    try {
      const { name, phone, address, aadhar = "", notes = "" } = req.body;

      if (!name || !phone || !address) {
        throw new Error('Name, phone, and address are required');
      }

      let profileUrl = null;

      if (req.file) {
        try {
          const uploadResult = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname
          );
          profileUrl = uploadResult.secure_url;
        } catch (uploadError) {
          throw new Error(`Profile upload failed: ${uploadError.message}`);
        }
      }

      const customer = await customerModel.create({
        name,
        phone,
        address,
        profile: profileUrl,
        aadhar,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Customer added successfully',
        customer
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  getCustomers: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const customers = await customerModel.find().skip(skip).limit(limit);
      res.status(200).json({
        success: true,
        customers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(await customerModel.countDocuments() / limit),
          pageSize: customers.length
        }
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  addAmount: async (req, res) => {
    try {
      const { fundId } = req.params;
      const { amount, customerId } = req.body;

      const customer = await customerModel.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const transaction = await Transaction.create({
        customerId,
        amount,
        fundId,
        type: 'credit'
      });

      res.status(201).json({
        success: true,
        message: 'Amount added successfully',
        transaction
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  deductAmount: async (req, res) => {
    try {
      const { fundId } = req.params;
      const { amount, customerId } = req.body;

      const customer = await customerModel.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const transaction = await Transaction.create({
        customerId,
        amount,
        fundId,
        type: 'debit'
      });

      res.status(201).json({
        success: true,
        message: 'Amount deducted successfully',
        transaction
      });
    } catch (error) {
      handleError(res, error);
    }
  },

  getAmount: async (req, res) => {
    try {
      const { customerId } = req.params;

      const transactions = await Transaction.find({ customerId });
      // const totalAmount = transactions.reduce((sum, transaction) => Number(sum) + Number(transaction.amount), 0);

      res.status(200).json({
        success: true,
        message: 'Amount retrieved successfully',
        transactions
      });
    } catch (error) {
      handleError(res, error);
    }
  },
  addFund: async (req, res) => {
    try {
      const { customerId } = req.params;
      const { type, description = "" } = req.body;

      const fund = await Funds.create({
        customerId,
        type,
        description
      });

      res.status(201).json({
        success: true,
        message: 'Fund added successfully',
        fund
      });
    } catch (error) {
      handleError(res, error);
    }
  },
  getFunds: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const type = req.query.type;
      const query = type ? { type } : {};
      const funds = await Funds.find(query).skip(skip).limit(limit);

      res.status(200).json({
        success: true,
        message: 'Funds retrieved successfully',
        data:funds,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(await Funds.countDocuments(query) / limit),
          pageSize: funds.length
        } 
      });
    } catch (error) {
      handleError(res, error);
    }
  },
  getCustomerFunds: async (req, res) => {
    try {
      const { customerId } = req.params;
      const funds = await Funds.find({ customerId });

      res.status(200).json({
        success: true,
        message: 'Funds retrieved successfully',
        funds
      });
    } catch (error) {
      handleError(res, error);
    }
  }
};
