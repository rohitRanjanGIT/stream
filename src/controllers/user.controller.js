import ApiResponse from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/APIerror.js";
import jwt from "jsonwebtoken";

const encryptPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const genrateUserTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Token generation error:", error);
    throw new ApiError(500, "unable to create user session tokens");
  }
};

// ---------------------------------------------------------------------------------------------------------- //

// @post /api/v1/users/register
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, fullName } = req.body;
  const avatarLocalPath = req.files.avatar[0].path;
  const coverImageLocalPath = req.files.coverImage //default image
    ? req.files.coverImage[0].path
    : null;

  if (!username || !email || !password || !fullName || !avatarLocalPath) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  {
    // check for existing username and email
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists",
      });
    }
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists",
      });
    }
  }
  // Upload avatar to Cloudinary
  const avatarCloudinaryURL = await uploadOnCloudinary(avatarLocalPath);
  if (!avatarCloudinaryURL) {
    return res.status(500).json({
      success: false,
      message: "Failed to upload avatar image",
    });
  }
  // Upload cover image to Cloudinary if it exists
  let coverImageCloudinaryURL = "";
  if (coverImageLocalPath) {
    coverImageCloudinaryURL = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImageCloudinaryURL) {
      console.warn("Failed to upload cover image, proceeding without it");
    }
  }

  // Hash password
  const hashedPassword = await encryptPassword(password);

  // Create new user
  const newUser = new User({
    username: username.toLowerCase(),
    email,
    password: hashedPassword,
    fullName,
    avatar: avatarCloudinaryURL,
    coverImage: coverImageCloudinaryURL || "",
  });

  try {
    await newUser.save();

    // Return user without sensitive information
    const resUser = await User.findById(newUser._id).select(
      "-password -refreshToken"
    );

    if (!resUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve user data after registration",
      });
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: resUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating user in database",
      error: error.message,
    });
  }
});

// @post /api/v1/users/login
const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Email or username required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "Invalid Credentials");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid Credentials");
  }

  const { accessToken, refreshToken } = await genrateUserTokens(user._id);

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  };

  // Get user object without sensitive information
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, "User logged in successfully!", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

// @post /api/v1/users/logout
const logoutUser = asyncHandler(async (req, res) => {
  // req.user is added by the verifyJWT middleware
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 }, // This properly removes the refreshToken field
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User logged out successfully!", {}));
});

// @post /api/v1/users/refresh-token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// @post /api/v1/users/change-password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current and new passwords are required");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.password = await encryptPassword(newPassword);
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully"));
});

// @get /api/v1/users/currentUser
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, "User retrieved successfully", req.user));
});

// @put /api/v1/users/update
const updateUser = asyncHandler(async (req, res) => {
  const { fullName, username, email } = req.body;
  const userId = req.user._id;
  const updateUser = User.findByIdAndUpdate(
    userId,
    {
      fullName,
      username: username.toLowerCase(),
      email,
    },
    { new: true, runValidators: true }
  );

  if (!updateUser) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      "User updated successfully",
      updateUser.toObject({
        versionKey: 0,
        "-password": 0,
        "-refreshToken": 0,
      })
    )
  );
});

// @delete /api/v1/users/delete
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const deletedUser = await User.findByIdAndDelete(userId);

  if (!deletedUser) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .API(new ApiResponse(200, "User deleted successfully", {}));
});

// @put /api/v1/users/update-avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const avatarLocalPath = req.file.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image is required");
  }

  // Upload avatar to Cloudinary
  const avatarCloudinaryURL = await uploadOnCloudinary(avatarLocalPath);
  if (!avatarCloudinaryURL) {
    throw new ApiError(500, "Failed to upload avatar image");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { avatar: avatarCloudinaryURL },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      "Avatar updated successfully",
      updatedUser.toObject({
        versionKey: 0,
        "-password": 0,
        "-refreshToken": 0,
      })
    )
  );
});

// @put /api/v1/users/update-cover-image
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const coverImageLocalPath = req.file.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image is required");
  }

  // Upload cover image to Cloudinary
  const coverImageCloudinaryURL = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImageCloudinaryURL) {
    throw new ApiError(500, "Failed to upload cover image");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { coverImage: coverImageCloudinaryURL },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      "Cover image updated successfully",
      updatedUser.toObject({
        versionKey: 0,
        "-password": 0,
        "-refreshToken": 0,
      })
    )
  );
});

// @get /api/v1/users/channel/:channelId
const getChannelInfo = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId?.trim()) {
    throw new ApiError(400, "Channel ID is required");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel || channel.length === 0) {
    throw new ApiError(404, "Channel not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Channel retrieved successfully", channel));
});

// @get /api/v1/users/watch-history
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUser,
  updateUserAvatar,
  updateUserCoverImage,
  deleteUser,
  getChannelInfo,
  getWatchHistory,
};
