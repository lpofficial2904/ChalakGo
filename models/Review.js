import mongoose from "mongoose";
import reviewSchema from "../schemas/reviewSchema.js";

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
