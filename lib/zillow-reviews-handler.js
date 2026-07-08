const requiredEnv = ["ZILLOW_REVIEWS_API_URL", "ZILLOW_API_KEY"];

const getMissingEnv = () =>
  requiredEnv.filter((key) => !process.env[key] || process.env[key].trim() === "");

const extractReviews = (payload) => {
  if (Array.isArray(payload?.reviews)) {
    return payload.reviews;
  }

  if (Array.isArray(payload?.value)) {
    return payload.value;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

const normalizeReview = (review, index) => ({
  id: review.id || review.reviewId || review.name || `zillow-${index}`,
  author:
    review.author ||
    review.reviewer ||
    review.reviewerName ||
    review.displayName ||
    "Zillow reviewer",
  rating:
    review.rating ||
    review.stars ||
    review.starRating ||
    review.score ||
    null,
  text:
    review.text ||
    review.comment ||
    review.review ||
    review.reviewText ||
    "Review text unavailable.",
  date:
    review.date ||
    review.updatedAt ||
    review.updateTime ||
    review.createdAt ||
    "",
  source: "zillow",
});

const zillowReviewsHandler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const missingEnv = getMissingEnv();

  if (missingEnv.length > 0) {
    return res.status(500).json({
      error: "Missing required environment variables.",
      missing: missingEnv,
    });
  }

  try {
    const authHeader = process.env.ZILLOW_API_AUTH_HEADER || "Authorization";
    const authPrefix = process.env.ZILLOW_API_AUTH_PREFIX || "Bearer ";
    const requestUrl = new URL(process.env.ZILLOW_REVIEWS_API_URL);

    if (!requestUrl.searchParams.has("limit") && process.env.ZILLOW_REVIEW_LIMIT) {
      requestUrl.searchParams.set("limit", process.env.ZILLOW_REVIEW_LIMIT);
    }

    const response = await fetch(requestUrl.toString(), {
      headers: {
        Accept: "application/json",
        [authHeader]: `${authPrefix}${process.env.ZILLOW_API_KEY}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zillow reviews request failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    const normalizedReviews = extractReviews(payload).map(normalizeReview);

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");

    return res.status(200).json({
      reviews: normalizedReviews,
      source: "zillow",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load Zillow reviews.",
      detail: error.message,
    });
  }
};

module.exports = {
  zillowReviewsHandler,
};
