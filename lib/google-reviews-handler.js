const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVIEWS_API_BASE = "https://mybusiness.googleapis.com/v4";

const requiredEnv = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_BUSINESS_ACCOUNT_ID",
  "GOOGLE_BUSINESS_LOCATION_ID",
];

const getMissingEnv = () =>
  requiredEnv.filter((key) => !process.env[key] || process.env[key].trim() === "");

const getAccessToken = async () => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth token request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();

  if (!payload.access_token) {
    throw new Error("Google OAuth token response did not include an access token.");
  }

  return payload.access_token;
};

const normalizeRating = (starRating) => {
  const map = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };

  return map[starRating] || null;
};

const getGoogleReviewSummary = async () => {
  const missingEnv = getMissingEnv();

  if (missingEnv.length > 0) {
    const error = new Error("Missing required Google environment variables.");
    error.missing = missingEnv;
    throw error;
  }

  const accessToken = await getAccessToken();
  const pageSize = process.env.GOOGLE_REVIEW_PAGE_SIZE || "6";
  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;
  const reviewsUrl =
    `${REVIEWS_API_BASE}/accounts/${accountId}/locations/${locationId}/reviews?` +
    new URLSearchParams({
      pageSize,
      orderBy: "updateTime desc",
    }).toString();

  const response = await fetch(reviewsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google reviews request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  const normalizedReviews = reviews.map((review) => ({
    id: review.name || "",
    author: review.reviewer?.displayName || "Google reviewer",
    rating: normalizeRating(review.starRating),
    text: review.comment || "Rating-only review",
    date: review.updateTime || review.createTime || "",
    source: "google",
  }));

  return {
    reviews: normalizedReviews,
    averageRating: payload.averageRating || null,
    totalReviewCount: payload.totalReviewCount || normalizedReviews.length,
  };
};

const googleReviewsHandler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const summary = await getGoogleReviewSummary();

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");

    return res.status(200).json({
      ...summary,
      source: "google",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load Google Business reviews.",
      detail: error.message,
      missing: error.missing,
    });
  }
};

module.exports = {
  getGoogleReviewSummary,
  googleReviewsHandler,
};
