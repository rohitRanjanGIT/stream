import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import upload from "../middleware/multer.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(upload.fields(
  [
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]
), userController.registerUser);

export default userRouter;
