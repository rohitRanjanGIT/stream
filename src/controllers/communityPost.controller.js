import asyncHandler from "../utils/asyncHandler";
import { ApiError } from "../utils/APIerror.js";
import ApiResponse from "../utils/ApiResponse.js";
import communityPost from "../models/communityPost.model.js";

const addCommunityPost = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  const owner = req.user._id;

  if (!title || !content) {
    throw new ApiError(400, "Title and content are required");
  }

    const newPost = new communityPost({
        title,
        content,
        owner,
    });

    await newPost.save();

    res.status(201).json(new ApiResponse(201, "Community post created successfully", newPost));
});

const updateCommunityPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { title, content } = req.body;

  const post = await communityPost.findById(postId);
  if (!post) {
    throw new ApiError(404, "Community post not found");
  }

  if (post.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this post");
  }

  post.title = title;
  post.content = content;

  await post.save();

  res.status(200).json(new ApiResponse(200, "Community post updated successfully", post));
});

const deleteCommunityPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await communityPost.findById(postId);
  if (!post) {
    throw new ApiError(404, "Community post not found");
  }

  if (post.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not authorized to delete this post");
  }

  await post.remove();

  res.status(200).json(new ApiResponse(200, "Community post deleted successfully"));
});

export {
  addCommunityPost,
  updateCommunityPost,
  deleteCommunityPost,
};
