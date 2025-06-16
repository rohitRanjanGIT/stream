import ApiResponse from "../utils/APIresponse.js";
import User from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/APIerror.js";
import jwt from "jsonwebtoken";
import z from "zod";

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

// @post /api/v1/users/register
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, fullName } = req.body;
  const avatarLocalPath = req.files.avatar[0].path;
  const coverImageLocalPath = req.files.coverImage
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

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

export { registerUser, loginUser, logoutUser, refreshAccessToken };
