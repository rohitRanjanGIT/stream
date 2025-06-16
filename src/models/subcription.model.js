import mongoose, {Schema} from "mongoose";

const SubscriptionSchema = new Schema({
    channel: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    subcriber: {
        type: Schema.Types.ObjectId,
        ref: "User",
    }
}, { timestamps: true });

export default mongoose.model("Subscription", SubscriptionSchema);