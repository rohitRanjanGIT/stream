import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (fileURLToPath) => {
    try {
        if (!fileURLToPath) {
            throw new Error("File not uploaded to the server properly, File URL to path is required for upload.");
        }
        const uploadResult = await cloudinary.uploader.upload(fileURLToPath, {
            resource_type: "auto",
        });
        console.log("file uploaded successfully:", uploadResult.url);
    } 
    catch (error) {
        console.error("Error uploading file to Cloudinary:", error);
        fs.unlink(fileURLToPath, (err) => {
            if (err) {
                console.error("Error deleting file:", err);
            } else {
                console.log("File deleted successfully after upload error.");
            }
        });
    }
}

export { uploadOnCloudinary };