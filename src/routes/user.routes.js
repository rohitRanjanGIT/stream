import { Router } from "express";
import * as uc from "../controllers/user.controller.js";
import upload from "../middleware/multer.middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  uc.registerUser
);

userRouter.route("/login").post(upload.none(), uc.loginUser);

userRouter.route("/logout").post(verifyJWT, uc.logoutUser);

userRouter.route("refresh-token").post(uc.refreshAccessToken);

export default userRouter;
