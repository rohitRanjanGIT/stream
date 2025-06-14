import APIresponse from "../utils/APIresponse.js";
import User from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import z from "zod";

const encryptPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
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

export { registerUser };
