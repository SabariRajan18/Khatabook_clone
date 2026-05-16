import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userDB from "../models/Admin.js";
import customerModel from "../models/Customers.js";
import Transaction from "../models/Transactions.js";
import Funds from "../models/Funds.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import mongoose, { get } from 'mongoose';

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
        { expiresIn: '10y' }
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

  async updateProfile(req, res) {
    try {
      const { profile: profileUrl, name, phone, address, notes } = req.body;

      const updateData = {};
      if (req.file) {
        try {
          const uploadResult = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname
          );
          updateData.profile = uploadResult.secure_url;
        } catch (uploadError) {
          throw new Error(`Profile upload failed: ${uploadError.message}`);
        }
      } else if (profileUrl && typeof profileUrl === 'string') {
        // Validate if it's a valid URL
        try {
          new URL(profileUrl);
          updateData.profile = profileUrl;
        } catch (e) {
          throw new Error('Invalid profile URL format');
        }
      }

      if (name) {
        updateData.name = name;
      }
      if (phone) {
        updateData.phone = phone;
      }
      if (address) {
        updateData.address = address;
      }
      if (notes) {
        updateData.notes = notes;
      }
      if (Object.keys(updateData).length === 0) {
        throw new Error('At least one field (profile, name, phone, address, or notes) is required for update');
      }

      const updatedAdmin = await userDB.findByIdAndUpdate(
        req.adminId,
        updateData,
        { new: true }
      ).select('-password');

      if (!updatedAdmin) {
        throw new Error('Admin not found');
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedAdmin
      });
    } catch (error) {
      handleError(res, error);
    }
  },
  getFundDetails: async (req, res) => {
    try {
      const results = await Funds.aggregate([
        {
          $lookup: {
            from: 'transactions',
            localField: '_id',
            foreignField: 'fundId',
            as: 'transactions'
          }
        },
        {
          $unwind: {
            path: '$transactions',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            type: 1,
            "transactions.amount": 1,
            "transactions.type": 1
          }
        },
        {
          $group: {
            _id: ["$type", "$transactions.type"],
            transactions: { $push: "$transactions" }
          }
        },
        {
          $project: {
            _id: 0,
            type: { $arrayElemAt: ["$_id", 0] },
            transactionType: { $arrayElemAt: ["$_id", 1] },
            transactions: 1
          }
        }
      ]);

      const fund = results.map(result => {
        const totalAmount = result.transactions.reduce((sum, transaction) => {
          if (transaction) {
            return sum + (+transaction.amount || 0);
          }
          return sum;
        }, 0);
        return {
          type: result.type,
          transactionType: result.transactionType,
          totalAmount
        };
      });
      console.log({ fund });

      res.status(200).json({
        success: true,
        message: 'Fund details retrieved successfully',
        fund,
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
  editCustomer: async (req, res) => {
    try {
      const { customerId } = req.params;
      const { name, phone, address, aadhar, notes, profile: profileUrl } = req.body;
      if (!customerId) {
        throw new Error('Customer ID is required');
      }

      let updated = {}
      if (req.file) {
        try {
          const uploadResult = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname
          );
          updated.profile = uploadResult.secure_url;
        } catch (uploadError) {
          throw new Error(`Profile upload failed: ${uploadError.message}`);
        }
      } else if (profileUrl && typeof profileUrl === 'string') {
        try {
          new URL(profileUrl);
          updated.profile = profileUrl;
        } catch (e) {
          throw new Error('Invalid profile URL format');
        }
      }

      if (name) {
        updated.name = name;
      }
      if (phone) {
        updated.phone = phone;
      }
      if (address) {
        updated.address = address;
      }
      if (aadhar) {
        updated.aadhar = aadhar;
      }
      if (notes) {
        updated.notes = notes;
      }

      const customer = await customerModel.findByIdAndUpdate(
        customerId,
        { ...updated },
        { new: true }
      );

      if (!customer) {
        throw new Error('Customer not found');
      }

      res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        customer
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
      const { type, description = "", period } = req.body;

      if (!type) {
        throw new Error('Fund type is required');
      };
      if (!period) {
        throw new Error('Fund period is required');
      };
      if (!customerId) {
        throw new Error('Customer ID is required');
      }
      if (!["THAVANAI", "SEETU"].includes(type)) {
        throw new Error('Invalid fund type. Allowed values are THAVANAI and SEETU');
      };
      if (type === "THAVANAI" && !["DAILY", "WEEKLY", "MONTHLY"].includes(period)) {
        throw new Error('Invalid period for THAVANAI type. Allowed values are DAILY, WEEKLY, MONTHLY.');
      };
      if (type === "SEETU" && !["WEEKLY", "MONTHLY"].includes(period)) {
        throw new Error('Invalid period for SEETU type. Allowed values are WEEKLY, MONTHLY.');
      };

      // const existingFunc = await Funds.findOne({ customerId, type, isCompleted: false });
      // if (existingFunc) {
      //   throw new Error('An active fund of this type already exists for the customer');
      // }

      const fund = await Funds.create({
        customerId,
        type,
        description,
        period
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
  editFund: async (req, res) => {
    try {
      const { fundId } = req.params;
      const { amount } = req.body;
      if (!fundId) {
        throw new Error('Fund ID is required');
      };
      const fund = await Transaction.findById(fundId);
      if (!fund) {
        throw new Error('Fund not found');
      };
      fund.amount = amount;
      await fund.save();

      res.status(200).json({
        success: true,
        message: 'Fund updated successfully',
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
        data: funds,
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
      const { type, period } = req.query;
      if (!customerId) {
        throw new Error('Customer ID is required');
      };
      if (type && !["THAVANAI", "SEETU"].includes(type)) {
        throw new Error('Invalid fund type. Allowed values are THAVANAI and SEETU');
      }
      if (period && !["DAILY", "WEEKLY", "MONTHLY"].includes(period)) {
        throw new Error('Invalid period. Allowed values are DAILY, WEEKLY, MONTHLY.');
      };
      console.log(type, period, "type, period");

      const funds = await Funds.aggregate([
        { $match: { customerId: new mongoose.Types.ObjectId(customerId), type, period, isCompleted: false } },
        { $lookup: { from: 'transactions', localField: '_id', foreignField: 'fundId', as: 'transactions' } }
      ]);
      console.log({ funds });

      res.status(200).json({
        success: true,
        message: 'Funds retrieved successfully',
        funds
      });
    } catch (error) {
      handleError(res, error);
    }
  },
  closeFund: async (req, res) => {
    try {
      const { fundId } = req.params;
      if (!fundId) {
        throw new Error('Fund ID is required');
      }
      const fund = await Funds.findById(fundId);
      if (!fund) {
        throw new Error('Fund not found');
      }
      fund.isCompleted = true;
      await fund.save();
      res.status(200).json({
        success: true,
        message: 'Fund closed successfully',
        fund
      });
    } catch (error) {
      handleError(res, error);
    }
  },



  getAllCustomersDetails: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get all customers with their funds and transactions
      const customers = await customerModel.aggregate([
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'transactions',
            let: { customerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$customerId', '$$customerId'] }
                }
              },
              {
                $lookup: {
                  from: 'Funds',
                  let: { fundId: '$fundId' },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $eq: ['$_id', '$$fundId'] }
                      }
                    },
                    {
                      $project: { type: 1 }
                    }
                  ],
                  as: 'fund'
                }
              },
              {
                $addFields: {
                  fundType: { $arrayElemAt: ['$fund.type', 0] }
                }
              },
              {
                $project: { fund: 0 }
              },
              {
                $sort: { createdAt: -1 }
              }
            ],
            as: 'transactions'
          }
        },
        {
          $addFields: {
            credit: {
              THAVANAI: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$transactions',
                        as: 'trans',
                        cond: {
                          $and: [
                            { $eq: ['$$trans.type', 'credit'] },
                            { $eq: ['$$trans.fundType', 'THAVANAI'] }
                          ]
                        }
                      }
                    },
                    as: 'trans',
                    in: { $toDouble: '$$trans.amount' }
                  }
                }
              },
              SEETU: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$transactions',
                        as: 'trans',
                        cond: {
                          $and: [
                            { $eq: ['$$trans.type', 'credit'] },
                            { $eq: ['$$trans.fundType', 'SEETU'] }
                          ]
                        }
                      }
                    },
                    as: 'trans',
                    in: { $toDouble: '$$trans.amount' }
                  }
                }
              }
            },
            debit: {
              THAVANAI: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$transactions',
                        as: 'trans',
                        cond: {
                          $and: [
                            { $eq: ['$$trans.type', 'debit'] },
                            { $eq: ['$$trans.fundType', 'THAVANAI'] }
                          ]
                        }
                      }
                    },
                    as: 'trans',
                    in: { $toDouble: '$$trans.amount' }
                  }
                }
              },
              SEETU: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$transactions',
                        as: 'trans',
                        cond: {
                          $and: [
                            { $eq: ['$$trans.type', 'debit'] },
                            { $eq: ['$$trans.fundType', 'SEETU'] }
                          ]
                        }
                      }
                    },
                    as: 'trans',
                    in: { $toDouble: '$$trans.amount' }
                  }
                }
              }
            }
          }
        },
        {
          $project: {
            userId: '$_id',
            name: 1,
            phone: 1,
            address: 1,
            profile: 1,
            credit: 1,
            debit: 1,
            aadhar: 1,
            notes: 1,
            createdAt: 1,
          }
        }
      ]);

      const totalCount = await customerModel.countDocuments();

      res.status(200).json({
        success: true,
        message: 'All customers details retrieved successfully',
        data: customers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          pageSize: customers.length,
          totalRecords: totalCount
        }
      });
    } catch (error) {
      handleError(res, error);
    }
  },
};
