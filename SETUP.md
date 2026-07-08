# Setup

## Local development

1. Copy `.env.example` to `.env` and fill in the review credentials you have.
2. Run:

```bash
npm run dev
```

3. Open `http://localhost:3000`.

The local server serves the static site and the review API routes:

- `/api/reviews/google`
- `/api/reviews/zillow`
- `/api/stats`
- `/api/media-assistant`

## Vercel deployment

1. Import the project into Vercel.
2. Add the environment variables from `.env.example`.
3. Deploy.

Vercel will run the serverless review endpoints from:

- `api/reviews/google.js`
- `api/reviews/zillow.js`
- `api/stats.js`
- `api/media-assistant.js`

## Netlify deployment

1. Import the project into Netlify.
2. Add the environment variables from `.env.example`.
3. Deploy.

Netlify uses:

- `netlify/functions/google-reviews.js`
- `netlify/functions/zillow-reviews.js`
- `netlify/functions/stats.js`
- `netlify/functions/media-assistant.js`

The redirects in `netlify.toml` keep the frontend endpoints the same:

- `/api/reviews/google`
- `/api/reviews/zillow`
- `/api/stats`
- `/api/media-assistant`

## Google Business reviews

The Google integration uses the official Business Profile reviews API via OAuth refresh token flow.

Required variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_BUSINESS_ACCOUNT_ID`
- `GOOGLE_BUSINESS_LOCATION_ID`

## Zillow reviews

The Zillow integration is a production-ready scaffold for approved Bridge or Zillow review access.

Required variables:

- `ZILLOW_REVIEWS_API_URL`
- `ZILLOW_API_KEY`

Optional auth overrides:

- `ZILLOW_API_AUTH_HEADER`
- `ZILLOW_API_AUTH_PREFIX`
- `ZILLOW_REVIEW_LIMIT`

## Live homepage statistics

The homepage requests `/api/stats` on page load and every 15 minutes. The
serverless response is cached for 15 minutes and can combine three sources:

1. Experience is calculated automatically from `EXPERIENCE_START_DATE`.
2. Google rating and review count come from the configured Google Business API.
3. Sales count and annual volume come from `STATS_FEED_URL`.

The external stats feed should return JSON in this shape:

```json
{
  "salesCount": 553,
  "annualVolume": 17.14,
  "annualVolumeCurrency": "USD"
}
```

`STATS_FEED_URL` should be an authorized Compass, MLS, CRM, spreadsheet
automation, or reporting endpoint. If it needs bearer authentication, set
`STATS_FEED_TOKEN`.

The `STATS_*` environment values are safe fallbacks when a live source is
temporarily unavailable. Public-profile scraping is intentionally not used
because it is brittle and may violate the source site's terms.

## AI media assistant

Open `/media-assistant.html` to preview a photo and generate:

- an accessible alt description
- a clean filename
- a short caption
- crop and placement recommendations
- basic quality notes

Required deployment variables:

- `OPENAI_API_KEY`
- `MEDIA_ASSISTANT_TOKEN` (choose a long private password)

Optional:

- `OPENAI_MEDIA_MODEL` (defaults to `gpt-5.5`)

The access token protects the endpoint from casual public use. Do not add either
secret to HTML or JavaScript. The assistant analyzes media but does not publish
files automatically; connect object storage or a CMS before enabling one-click
publishing.

The API account must also have available billing credit. A valid key without
credit will return a quota error.

For local use, the private token lives in `.env`. Open `/media-assistant.html`
through `npm run dev` and enter `MEDIA_ASSISTANT_TOKEN` when prompted.

## Lead inbox and email

Set `LEAD_INBOX_PATH=.data/leads.jsonl` to retain form submissions locally even
before email delivery is connected. Production email delivery requires:

- `RESEND_API_KEY`
- `LEAD_FROM_EMAIL` using a verified sending domain
- `LEAD_REPLY_TO_EMAIL`

## Compass listings and reviews

The website links to Andrew's official Compass profile for current listings and
recent sales:

- `https://www.compass.com/agents/andrew-allen/`

RateMyAgent and Realtor.com remain outbound profile links because those services
do not have a configured review API in this project. Review counts are dated in
the page copy so visitors are not told they are live totals.

Current public review/profile links used by the site:

- RateMyAgent: `https://www.ratemyagent.com/real-estate-agent/andrew-allen-b06ocz/sales/overview`
- Realtor.com: `https://www.realtor.com/realestateagents/56b091fd0fa4170100746b7b`
- Zillow: `https://www.zillow.com/profile/The%20Lake%20Guy`

The homepage also has embedded review-feed slots:

- Google Business reviews load from `/api/reviews/google` after Google Business
  OAuth credentials are configured.
- Zillow reviews load from `/api/reviews/zillow` after approved Zillow/Bridge
  review feed credentials are configured.
- RateMyAgent is prepared as a widget slot. Paste the official RateMyAgent
  widget code or a review-widget provider snippet into the RateMyAgent card when
  Andrew has access to it.
- Realtor.com is currently a public profile link. Convert it to a live feed only
  if Realtor.com provides Andrew with approved API or embed access.

To add RateMyAgent reviews:

1. Log in to Andrew's RateMyAgent dashboard.
2. Find the website review widget/embed code.
3. Open `reviews-config.js`.
4. Paste the full widget code into `RATE_MY_AGENT_WIDGET.embedHtml`.
5. Run `npm run dev` and check the homepage reviews section.
6. Commit and deploy after the widget renders correctly.

## Photos, logos, and AI media uploads

Use `/media-assistant.html` as the private prep tool for new photos and logo
assets. The assistant creates image recommendations, but it does not publish by
itself until the project is connected to GitHub plus a storage/CMS workflow.

Recommended upkeep workflow:

1. Upload the new image in `/media-assistant.html`.
2. Save the approved image with the suggested filename.
3. Add the file to this project.
4. Replace the old image reference in the relevant HTML page.
5. Commit the change to GitHub.
6. Let Netlify or Vercel redeploy the site.

## Domain transfer and launch

The website is already configured around `andrewallennj.com`. To move the domain:

1. Deploy the site to Netlify or Vercel and verify the temporary deployment URL.
2. Add `andrewallennj.com` and `www.andrewallennj.com` in the hosting dashboard.
3. At the current registrar, copy the existing DNS records before changing them.
4. Preserve all email-related MX, SPF, DKIM, and DMARC records.
5. Point only the website records (`A`, `AAAA`, or `CNAME`) to the new host.
6. Make one hostname canonical and redirect the other to it.
7. Verify HTTPS, forms, `/api/media-assistant`, and review endpoints.
8. Keep the former hosting account active for at least 48 hours after DNS changes.

Do not initiate a registrar transfer merely to launch the new site. A DNS change
is usually faster and carries less risk to Andrew's email.
