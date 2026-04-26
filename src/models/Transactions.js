import mongoose from "mongoose";
const transactionSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customers',
        required: true
    },
    amount: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    }
}, { collections: 'Transactions', timestamps: true });

const Transaction = mongoose.model('Transactions', transactionSchema);
export default Transaction;