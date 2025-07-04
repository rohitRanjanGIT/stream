import mongoose, { Schema } from "mongoose";

const communityPostSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  owner: {
    type: Schema.types.ObjectId,
    ref: "User",
    required: true,
  },
});

const CommunityPost = mongoose.model("CommunityPost", communityPostSchema);
