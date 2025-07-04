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

userRouter.route("/logout").post(upload.none(), verifyJWT, uc.logoutUser);

userRouter.route("/refresh-token").post(upload.none(), uc.refreshAccessToken);

userRouter.route("/change-password").post(verifyJWT,  upload.none(), uc.changeCurrentPassword);

userRouter.route("/currentUser").get(verifyJWT, uc.getCurrentUser);

userRouter.route("/update").put(
  verifyJWT,
  upload.none(),
  uc.updateUser
);

userRouter.route("/update-avatar").put(
  verifyJWT,
  upload.single("avatar"),
  uc.updateUserAvatar
);

userRouter.route("/update-cover-image").put(
  verifyJWT,
  upload.single("coverImage"),
  uc.updateUserCoverImage
);

userRouter.route("/delete").delete(verifyJWT, uc.deleteUser);

userRouter.route("/c/:channelId").get(uc.getChannelInfo);

userRouter.route("/history").get(verifyJWT, uc.getUserHistory);

export default userRouter;