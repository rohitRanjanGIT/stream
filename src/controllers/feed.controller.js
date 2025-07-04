import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/APIerror.js";
import ApiResponse from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import CommunityPost from "../models/communityPost.model.js";
import mongoose from "mongoose";

const getChannelContent = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const {
    page = 1,
    limit = 20,
    sortBy = "latest", // 'latest' or 'popular'
    contentType = "all", // 'all', 'videos', or 'posts'
  } = req.query;

  // Convert string parameters to numbers
  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Validate channel exists
  const channelExists = await User.exists({ _id: channelId });
  if (!channelExists) {
    throw new ApiError(404, "Channel not found");
  }

  // Set up sorting configurations
  const latestSort = { createdAt: -1 };
  const videoPopularSort = { views: -1, createdAt: -1 };
  const postPopularSort = { likes: -1, createdAt: -1 };

  // Get content based on contentType parameter
  let videos = [];
  let posts = [];
  let totalVideos = 0;
  let totalPosts = 0;

  // Fetch videos if requested
  if (contentType === "all" || contentType === "videos") {
    // Count total for pagination
    totalVideos = await Video.countDocuments({
      owner: channelId,
      isPublished: true,
    });

    // Build video query
    const videoQuery = Video.find({
      owner: channelId,
      isPublished: true,
    });

    // Apply sorting
    if (sortBy === "popular") {
      videoQuery.sort(videoPopularSort);
    } else {
      videoQuery.sort(latestSort);
    }

    // Only apply pagination if we're only getting videos
    if (contentType === "videos") {
      videoQuery.skip(skip).limit(limitNumber);
    }

    // Execute query with owner populated
    videos = await videoQuery.populate({
      path: "owner",
      select: "username fullName avatar",
    });

    // Add content type for mixed results
    videos = videos.map((video) => {
      const videoObj = video.toObject();
      videoObj.contentType = "video";
      return videoObj;
    });
  }

  // Fetch community posts if requested
  if (contentType === "all" || contentType === "posts") {
    // Count total for pagination
    totalPosts = await CommunityPost.countDocuments({
      owner: channelId,
      isPublished: true,
    });

    // Build post query
    const postQuery = CommunityPost.find({
      owner: channelId,
      isPublished: true,
    });

    // Apply sorting
    if (sortBy === "popular") {
      postQuery.sort(postPopularSort);
    } else {
      postQuery.sort(latestSort);
    }

    // Only apply pagination if we're only getting posts
    if (contentType === "posts") {
      postQuery.skip(skip).limit(limitNumber);
    }

    // Execute query with owner populated
    posts = await postQuery.populate({
      path: "owner",
      select: "username fullName avatar",
    });

    // Add content type for mixed results
    posts = posts.map((post) => {
      const postObj = post.toObject();
      postObj.contentType = "post";
      return postObj;
    });
  }

  // Combine results if getting both types
  let results = [];
  let totalItems = 0;

  if (contentType === "all") {
    // Combine and sort results
    results = [...videos, ...posts];
    totalItems = totalVideos + totalPosts;

    // Apply sorting to combined results
    if (sortBy === "latest") {
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      // For popular sorting, we need custom handling
      results.sort((a, b) => {
        if (a.contentType === "video" && b.contentType === "video") {
          return b.views - a.views;
        } else if (a.contentType === "post" && b.contentType === "post") {
          return (b.likes?.length || 0) - (a.likes?.length || 0);
        } else if (a.contentType === "video" && b.contentType === "post") {
          // Compare video views to post likes with a reasonable ratio
          return b.views - a.likes?.length * 5;
        } else {
          // a is post, b is video
          return a.likes?.length * 5 - b.views;
        }
      });
    }

    // Apply pagination to combined results
    results = results.slice(skip, skip + limitNumber);
  } else {
    // Use the results from individual queries
    results = contentType === "videos" ? videos : posts;
    totalItems = contentType === "videos" ? totalVideos : totalPosts;
  }

  // Get channel details
  const channel = await User.findById(channelId).select(
    "username fullName avatar bio subscribersCount"
  );

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalItems / limitNumber);

  // Return response
  return res.status(200).json(
    new ApiResponse(200, "Channel content fetched successfully", {
      channel,
      content: results,
      pagination: {
        total: totalItems,
        totalVideos,
        totalPosts,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    })
  );
});

export { getChannelContent };
