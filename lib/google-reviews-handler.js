const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVIEWS_API_BASE = "https://mybusiness.googleapis.com/v4";
const PLACES_API_BASE = "https://places.googleapis.com/v1";
const fs = require("fs");
const path = require("path");

const DEFAULT_CURATED_REVIEWS_PATH = path.join(__dirname, "..", ".data", "google-reviews.json");

const requiredEnv = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_BUSINESS_ACCOUNT_ID",
  "GOOGLE_BUSINESS_LOCATION_ID",
];

const getMissingEnv = () =>
  requiredEnv.filter((key) => !process.env[key] || process.env[key].trim() === "");

const getMissingPlacesEnv = () =>
  ["GOOGLE_PLACES_API_KEY", "GOOGLE_PLACE_ID"].filter(
    (key) => !process.env[key] || process.env[key].trim() === ""
  );

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

const normalizePlaceReview = (review) => ({
  id: review.name || `${review.authorAttribution?.displayName || "google"}-${review.publishTime || ""}`,
  author: review.authorAttribution?.displayName || "Google reviewer",
  rating: review.rating || null,
  text: review.text?.text || "Rating-only review",
  date: review.publishTime || "",
  source: "google",
});

const normalizeCuratedReview = (review, index) => ({
  id: review.id || `curated-google-${index + 1}`,
  author: review.author || review.reviewer || "Google reviewer",
  rating: Number(review.rating) || 5,
  text: review.text || review.comment || "Rating-only review",
  date: review.date || review.updatedAt || "",
  source: "google",
});

const getGoogleBusinessProfileReviewSummary = async () => {
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
    provider: "google-business-profile",
  };
};

const getGooglePlacesReviewSummary = async () => {
  const missingEnv = getMissingPlacesEnv();

  if (missingEnv.length > 0) {
    const error = new Error("Missing required Google Places environment variables.");
    error.missing = missingEnv;
    throw error;
  }

  const placeId = process.env.GOOGLE_PLACE_ID;
  const url =
    `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}?` +
    new URLSearchParams({
      key: process.env.GOOGLE_PLACES_API_KEY,
      fields: "id,displayName,rating,userRatingCount,reviews",
    }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places reviews request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];

  return {
    reviews: reviews.map(normalizePlaceReview),
    averageRating: payload.rating || null,
    totalReviewCount: payload.userRatingCount || reviews.length,
    businessName: payload.displayName?.text || "",
    provider: "google-places",
  };
};

const getCuratedGoogleReviewSummary = () => {
  const filePath = process.env.GOOGLE_REVIEWS_JSON_PATH || DEFAULT_CURATED_REVIEWS_PATH;

  if (!fs.existsSync(filePath)) {
    const error = new Error("Curated Google reviews file is not present.");
    error.missing = ["GOOGLE_REVIEWS_JSON_PATH"];
    throw error;
  }

  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];

  if (reviews.length === 0) {
    throw new Error("Curated Google reviews file does not contain reviews.");
  }

  return {
    reviews: reviews.map(normalizeCuratedReview),
    averageRating: payload.averageRating || null,
    totalReviewCount: payload.totalReviewCount || reviews.length,
    businessName: payload.businessName || "",
    provider: "curated-google",
  };
};

const getGoogleReviewSummary = async () => {
  try {
    return await getGoogleBusinessProfileReviewSummary();
  } catch (businessProfileError) {
    try {
      return await getGooglePlacesReviewSummary();
    } catch (placesError) {
      try {
        return getCuratedGoogleReviewSummary();
      } catch (curatedError) {
        const error = new Error(
          "Google review data is not connected. Business Profile API needs project approval, Google Places API credentials, or a curated local reviews file."
        );
        error.businessProfile = businessProfileError.message;
        error.places = placesError.message;
        error.curated = curatedError.message;
        error.missing = curatedError.missing || placesError.missing || businessProfileError.missing;
        throw error;
      }
    }
  }
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
      businessProfile: error.businessProfile,
      places: error.places,
      curated: error.curated,
    });
  }
};

module.exports = {
  getGoogleBusinessProfileReviewSummary,
  getGooglePlacesReviewSummary,
  getCuratedGoogleReviewSummary,
  getGoogleReviewSummary,
  googleReviewsHandler,
};
