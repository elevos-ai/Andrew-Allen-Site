const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const parseBody = (body) => {
  if (!body) {
    return {};
  }

  return typeof body === "string" ? JSON.parse(body) : body;
};

const extractJson = (text) => {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
};

const mediaAssistantHandler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY || !process.env.MEDIA_ASSISTANT_TOKEN) {
    return res.status(503).json({
      error: "The media assistant has not been configured.",
    });
  }

  try {
    const body = parseBody(req.body);
    const accessToken = req.headers?.["x-media-assistant-token"];

    if (accessToken !== process.env.MEDIA_ASSISTANT_TOKEN) {
      return res.status(401).json({ error: "Invalid media assistant access key." });
    }

    const imageData = String(body.imageData || "");
    const mimeType = String(body.mimeType || "");
    const placement = String(body.placement || "general website image").slice(0, 120);
    const originalName = String(body.originalName || "upload").slice(0, 160);

    if (!supportedTypes.has(mimeType) || !imageData) {
      return res.status(400).json({ error: "Upload a JPG, PNG, or WebP image." });
    }

    const estimatedBytes = Math.floor((imageData.length * 3) / 4);

    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "The image must be 3 MB or smaller." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MEDIA_MODEL || "gpt-5.5",
        instructions:
          "You are a real estate website media editor. Return only valid JSON. Be factual and never infer protected demographic traits, property condition, location, price, or listing status unless visibly certain.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  `Analyze this image for Andrew Allen's real estate website. ` +
                  `Original filename: ${originalName}. Intended placement: ${placement}. ` +
                  `Return JSON with these string keys: suggestedFilename, altText, caption, ` +
                  `cropRecommendation, qualityNotes, placementNotes. ` +
                  `suggestedFilename must be lowercase kebab-case with the correct extension. ` +
                  `altText must be concise and accessible, without marketing fluff.`,
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${imageData}`,
                detail: "high",
              },
            ],
          },
        ],
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || "OpenAI request failed.");
    }

    const outputText =
      payload.output_text ||
      payload.output
        ?.flatMap((item) => item.content || [])
        .find((item) => item.type === "output_text")?.text;

    return res.status(200).json({
      analysis: extractJson(outputText),
    });
  } catch (error) {
    const quotaExceeded = /quota|billing/i.test(error.message);

    return res.status(500).json({
      error: quotaExceeded
        ? "The OpenAI API account needs available billing credit."
        : "The image could not be analyzed.",
      detail: error.message,
    });
  }
};

module.exports = {
  mediaAssistantHandler,
};
