import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Debug cloudinary configuration
// console.log("Cloudinary Configuration:");
// console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
// console.log("API Key:", process.env.CLOUDINARY_API_KEY ? "Set" : "Not Set");
// console.log(
//   "API Secret:",
//   process.env.CLOUDINARY_API_SECRET ? "Set" : "Not Set"
// );

const uploadOnCloudinary = async (fileURLToPath) => {
  try {
    if (!fileURLToPath) {
      throw new Error(
        "File not uploaded to the server properly, File URL to path is required for upload."
      );
    }
    const uploadResult = await cloudinary.uploader.upload(fileURLToPath, {
      resource_type: "auto",
      folder: "stream-app",
    });
    fs.unlink(fileURLToPath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      } else {
        console.log(
          "File deleted successfully from server, uploaded on cloud."
        );
      }
    });

    // Check if the uploaded file is a video and return duration if available
    if (uploadResult.resource_type === "video" && uploadResult.duration) {
      return {
        url: uploadResult.secure_url,
        duration: uploadResult.duration,
        resource_type: uploadResult.resource_type,
      };
    }

    // For non-video files, return just the URL (maintaining backward compatibility)
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error);

    // Only try to delete the file if it exists
    if (fileURLToPath) {
      fs.unlink(fileURLToPath, (err) => {
        if (err) {
          console.error("Error deleting file:", err);
        } else {
          console.log("File deleted successfully after upload error.");
        }
      });
    }
    return null;
  }
};

export { uploadOnCloudinary };
