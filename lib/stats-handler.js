const { getGoogleReviewSummary } = require("./google-reviews-handler");

const FALLBACK_STATS = {
  salesCount: 553,
  rating: 5,
  reviewCount: 338,
  annualVolume: 17.14,
  annualVolumeCurrency: "USD",
};

const numberFrom = (...values) => {
  for (const value of values) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const calculateExperience = () => {
  const startDate = new Date(process.env.EXPERIENCE_START_DATE || "2004-01-01T00:00:00Z");
  const now = new Date();

  if (Number.isNaN(startDate.getTime())) {
    return 22;
  }

  let years = now.getUTCFullYear() - startDate.getUTCFullYear();
  const anniversaryHasPassed =
    now.getUTCMonth() > startDate.getUTCMonth() ||
    (now.getUTCMonth() === startDate.getUTCMonth() &&
      now.getUTCDate() >= startDate.getUTCDate());

  if (!anniversaryHasPassed) {
    years -= 1;
  }

  return Math.max(0, years);
};

const loadExternalStats = async () => {
  if (!process.env.STATS_FEED_URL) {
    return {};
  }

  const headers = { Accept: "application/json" };

  if (process.env.STATS_FEED_TOKEN) {
    headers.Authorization = `Bearer ${process.env.STATS_FEED_TOKEN}`;
  }

  const response = await fetch(process.env.STATS_FEED_URL, { headers });

  if (!response.ok) {
    throw new Error(`Stats feed request failed: ${response.status}`);
  }

  return response.json();
};

const statsHandler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const sourceStatus = {
    experience: "calculated",
    sales: "fallback",
    rating: "fallback",
    reviews: "fallback",
    volume: "fallback",
  };
  let external = {};
  let google = {};

  try {
    external = await loadExternalStats();
  } catch (error) {
    sourceStatus.feedError = error.message;
  }

  try {
    google = await getGoogleReviewSummary();
  } catch (error) {
    sourceStatus.googleError = error.message;
  }

  const salesCount = numberFrom(
    external.salesCount,
    external.sales,
    process.env.STATS_SALES_COUNT,
    FALLBACK_STATS.salesCount
  );
  const rating = numberFrom(
    google.averageRating,
    external.rating,
    process.env.STATS_RATING,
    FALLBACK_STATS.rating
  );
  const reviewCount = numberFrom(
    google.totalReviewCount,
    external.reviewCount,
    external.reviews,
    process.env.STATS_REVIEW_COUNT,
    FALLBACK_STATS.reviewCount
  );
  const annualVolume = numberFrom(
    external.annualVolume,
    external.volumeMillions,
    process.env.STATS_ANNUAL_VOLUME_MILLIONS,
    FALLBACK_STATS.annualVolume
  );

  if (numberFrom(external.salesCount, external.sales, process.env.STATS_SALES_COUNT) !== null) {
    sourceStatus.sales = external.salesCount || external.sales ? "feed" : "environment";
  }

  if (google.averageRating) {
    sourceStatus.rating = "google";
  } else if (numberFrom(external.rating, process.env.STATS_RATING) !== null) {
    sourceStatus.rating = external.rating ? "feed" : "environment";
  }

  if (google.totalReviewCount) {
    sourceStatus.reviews = "google";
  } else if (numberFrom(external.reviewCount, external.reviews, process.env.STATS_REVIEW_COUNT) !== null) {
    sourceStatus.reviews = external.reviewCount || external.reviews ? "feed" : "environment";
  }

  if (numberFrom(external.annualVolume, external.volumeMillions, process.env.STATS_ANNUAL_VOLUME_MILLIONS) !== null) {
    sourceStatus.volume =
      external.annualVolume || external.volumeMillions ? "feed" : "environment";
  }

  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");

  return res.status(200).json({
    stats: {
      experienceYears: calculateExperience(),
      salesCount,
      rating,
      reviewCount,
      annualVolume,
      annualVolumeCurrency:
        external.annualVolumeCurrency ||
        process.env.STATS_ANNUAL_VOLUME_CURRENCY ||
        FALLBACK_STATS.annualVolumeCurrency,
    },
    sources: sourceStatus,
    isLive: {
      experience: true,
      sales: sourceStatus.sales === "feed",
      rating: sourceStatus.rating === "google" || sourceStatus.rating === "feed",
      reviews: sourceStatus.reviews === "google" || sourceStatus.reviews === "feed",
      volume: sourceStatus.volume === "feed",
    },
    configuration: {
      googleConnected: !sourceStatus.googleError,
      salesFeedConnected: Boolean(process.env.STATS_FEED_URL) && !sourceStatus.feedError,
    },
    updatedAt: new Date().toISOString(),
  });
};

module.exports = {
  statsHandler,
};
