import asyncHandler from "../utils/asyncHandler";


const toggleLike = asyncHandler(async (req, res) => {
  const { postId } = req.params || req.body;
  const userId = req.user._id;

  const post = await req.app.locals.db.collection("posts").findOne({ _id: postId });
  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  // Check if the user has already liked the post
  const existingLike = await req.app.locals.db.collection("likes").findOne({
    postId,
    userId,
  });

  if (existingLike) {
    // User has already liked the post, so we remove the like
    await req.app.locals.db.collection("likes").deleteOne({
      postId,
      userId,
    });
    return res.status(200).json({ message: "Like removed" });
  } else {
    // User has not liked the post, so we add a new like
    await req.app.locals.db.collection("likes").insertOne({
      postId,
      userId,
      createdAt: new Date(),
    });
    return res.status(201).json({ message: "Post liked" });
  }
});