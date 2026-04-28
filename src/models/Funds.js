import mongoose from "mongoose";
const fundSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customers',
        required: true
    },
    type: {
        type: String,
        enum:["THAVANAI","SEETU"],
        default: "THAVANAI",
    },
    description: {
        type: String,
        default: "",
    }
}, { collection: 'Funds', timestamps: true }); 
const Fund = mongoose.model('Funds', fundSchema);
export default Fund;