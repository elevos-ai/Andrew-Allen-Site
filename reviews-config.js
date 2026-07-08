window.REVIEW_FEEDS = {
  google: "/api/reviews/google",
  zillow: "/api/reviews/zillow",
};

window.RATE_MY_AGENT_WIDGET = {
  profileUrl: "https://www.ratemyagent.com/real-estate-agent/andrew-allen-b06ocz/sales/overview",
  embedHtml: `
    <div class="review-carousel-markup-container" data-markup-instance-id="14826">
      <div
        class="RMA-widget"
        style="height:0; overflow:hidden;"
        data-widget-instance-id="14826"
        data-widget-api-url="https://widgets.ratemyagent.com"
      ></div>
      <div class="loading-indicator Full" id="rma-widget-loading-state"></div>
      <div class="rma-corporate-details">
        <div class="rma-link-back">
          <a href="https://ratemyagent.com/real-estate-agent/andrew-allen-b06ocz/sales/overview" style="color: #1A222C" target="_blank" rel="noreferrer">
            <span class="rma-powered-by">Reviews powered by</span>
            <img
              style="display: block; width: 120px; height: 35px; margin-left: 4px"
              alt="RateMyAgent"
              loading="lazy"
              src="https://static.ratemyagent.com/assets/images/logos/logo-dark.svg"
            />
          </a>
        </div>
      </div>
    </div>
    <script type="text/javascript" src="https://widgets.ratemyagent.com/ReviewCarousel/review-carousel-iframe.js" defer></script>
  `,
};
