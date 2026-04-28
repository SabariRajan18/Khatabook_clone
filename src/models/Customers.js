import mongoose from "mongoose";
const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    profile: { type: String, default: null },
    aadhar: { type: String, default: "" },
    notes:{ type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'customers' });

const Customer = mongoose.model("Customers", customerSchema);
export default Customer;