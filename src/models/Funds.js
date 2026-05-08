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
    period: {
        type: String,
        default: "",
    },
    description: {
        type: String,
        default: "",
    },
    isCompleted: {
        type: Boolean,
        default: false,
    },
}, { collection: 'Funds', timestamps: true }); 
const Fund = mongoose.model('Funds', fundSchema);

fundSchema.pre('save', function(next) {
    if (this.type === "THAVANAI") {
       const arr = ["DAILY", "WEEKLY", "MONTHLY"];
       if(!arr.includes(this.period)) {
        return next(new Error('Invalid period for THAVANAI type. Allowed values are DAILY, WEEKLY, MONTHLY.'));
       }
    }else if (this.type === "SEETU") {
        const arr = ["WEEKLY", "MONTHLY" ];
        if(!arr.includes(this.period)) {
            return next(new Error('Invalid period for SEETU type. Allowed values are WEEKLY, MONTHLY.'));
        }
    };
    next();
});
export default Fund;