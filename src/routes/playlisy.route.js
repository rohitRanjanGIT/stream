import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import playlistController from "../controllers/playlist.controller.js";

const playlistRouter = Router();

// Protect all playlist routes
playlistRouter.use(verifyJWT);

playlistRouter
  .route("/")
  .post(playlistController.createPlaylist)
  .get(playlistController.getAllPlaylistByUser);

playlistRouter
  .route("/:playlistId")
  .get(playlistController.viewPlaylist)
  .put(playlistController.updatePlaylist)
  .delete(playlistController.deletePlaylist);

playlistRouter
  .route("/:playlistId/videos")
  .post(playlistController.addVideosToPlaylist)
  .delete(playlistController.removeVideosFromPlaylist);

export default playlistRouter;
