import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
// import BASE_URL from "./constants.js";

dotenv.config();

const app = express();

// Middleware configuration
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "50kb",
  })
);
app.use(express.urlencoded({}));
app.use(express.static("public"));
app.use(cookieParser());

// import user route
import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter);
// import playlist route
import playlistRouter from "./routes/playlisy.route.js";
app.use("/api/v1/playlists", playlistRouter);

export default app;
