import { Playlist } from "../models/playlist.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/APIerror.js";
import ApiResponse from "../utils/ApiResponse.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description, isPublic = false } = req.body;

  if (!name) {
    throw new ApiError(400, "Playlist name is required");
  }

  const playlist = new Playlist({
    name,
    description,
    owner: req.user._id, // Changed from user to owner to match schema
    isPublic,
  });

  await playlist.save();

  res
    .status(201)
    .json(new ApiResponse(201, "Playlist created successfully", playlist));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this playlist");
  }

  await Playlist.findByIdAndDelete(playlistId); // Using findByIdAndDelete instead of remove()

  res
    .status(200)
    .json(new ApiResponse(200, "Playlist deleted successfully", null));
});

const viewPlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  // Check if playlist is private and user is not the owner
  if (!playlist.isPublic && playlist.owner.toString() !== req.user?.id) {
    throw new ApiError(403, "You don't have access to this playlist");
  }

  // Pagination for videos within the playlist
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const skip = (options.page - 1) * options.limit;

  // Get playlist with paginated videos
  const populatedPlaylist = await Playlist.findById(playlistId).populate({
    path: "videos",
    options: {
      skip,
      limit: options.limit,
    },
  });

  // Count total videos for pagination metadata
  const totalVideos = playlist.videos.length;
  const totalPages = Math.ceil(totalVideos / options.limit);

  res.status(200).json(
    new ApiResponse({
      success: true,
      data: {
        playlist: populatedPlaylist,
        pagination: {
          totalVideos,
          totalPages,
          currentPage: options.page,
          limit: options.limit,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1,
        },
      },
    })
  );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description, isPublic } = req.body;

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this playlist");
  }

  // Only update fields that are provided
  if (name !== undefined) playlist.name = name;
  if (description !== undefined) playlist.description = description;
  if (isPublic !== undefined) playlist.isPublic = isPublic;

  await playlist.save();

  res
    .status(200)
    .json(new ApiResponse(200, "Playlist updated successfully", playlist));
});

const addVideosToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { videoIds } = req.body;

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    throw new ApiError(400, "Please provide at least one valid video ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to modify this playlist");
  }

  // Filter out videos already in the playlist
  const uniqueVideoIds = videoIds.filter(
    (videoId) => !playlist.videos.includes(videoId)
  );

  if (uniqueVideoIds.length > 0) {
    playlist.videos.push(...uniqueVideoIds);
    await playlist.save();
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, "Videos added to playlist successfully", playlist)
    );
});

const removeVideosFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { videoIds } = req.body;

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    throw new ApiError(400, "Please provide at least one valid video ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to modify this playlist");
  }

  // Convert ObjectIds to strings for comparison
  playlist.videos = playlist.videos.filter(
    (videoId) => !videoIds.includes(videoId.toString())
  );

  await playlist.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Videos removed from playlist successfully",
        playlist
      )
    );
});

const getAllPlaylistByUser = asyncHandler(async (req, res) => {
  const { page = 1, limit = 5, sort = "createdAt", order = "desc" } = req.query;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { [sort]: order === "desc" ? -1 : 1 },
  };

  // Find total count first for pagination metadata
  const totalPlaylists = await Playlist.countDocuments({ user: req.user.id });

  // Get paginated results
  const playlists = await Playlist.find({ user: req.user.id })
    .sort(options.sort)
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .populate({
      path: "videos",
      select: "title thumbnail duration views", // Only bring needed fields
      options: { limit: 5 }, // Limit videos to 5 per playlist to avoid large payloads
    });

  const totalPages = Math.ceil(totalPlaylists / options.limit);

  res.status(200).json(
    new ApiResponse({
      success: true,
      data: {
        playlists,
        pagination: {
          totalPlaylists,
          totalPages,
          currentPage: options.page,
          limit: options.limit,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1,
        },
      },
    })
  );
});

const getUserPublicPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 5 } = req.query;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
  };

  // Find total count first for pagination metadata
  const totalPlaylists = await Playlist.countDocuments({
    owner: userId,
    isPublic: true,
  });

  // Get paginated public playlists for the specified user
  const playlists = await Playlist.find({
    owner: userId,
    isPublic: true,
  })
    .sort(options.sort)
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .populate({
      path: "videos",
      select: "title thumbnail duration views",
      options: { limit: 5 },
    });

  const totalPages = Math.ceil(totalPlaylists / options.limit);

  res.status(200).json(
    new ApiResponse(200, "User's public playlists fetched successfully", {
      playlists,
      pagination: {
        totalPlaylists,
        totalPages,
        currentPage: options.page,
        limit: options.limit,
        hasNextPage: options.page < totalPages,
        hasPrevPage: options.page > 1,
      },
    })
  );
});

export {
  createPlaylist,
  deletePlaylist,
  viewPlaylist,
  updatePlaylist,
  addVideosToPlaylist,
  removeVideosFromPlaylist,
  getAllPlaylistByUser,
  getUserPublicPlaylists,
};
