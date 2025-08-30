import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  createPlaylist,
  getAllPlaylistByUser,
  viewPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideosToPlaylist,
  removeVideosFromPlaylist,
} from "../controllers/playlist.controller.js";

const playlistRouter = Router();

// Protect all playlist routes
playlistRouter.use(verifyJWT);

playlistRouter.route("/").post(createPlaylist).get(getAllPlaylistByUser);

playlistRouter
  .route("/:playlistId")
  .get(viewPlaylist)
  .put(updatePlaylist)
  .delete(deletePlaylist);

playlistRouter
  .route("/:playlistId/videos")
  .post(addVideosToPlaylist)
  .delete(removeVideosFromPlaylist);

export default playlistRouter;
