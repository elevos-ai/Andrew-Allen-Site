const revealNodes = document.querySelectorAll(
  ".hero, .trust-strip, .section, .site-footer"
);

const staggerGroups = document.querySelectorAll(
  ".trust-strip, .market-grid, .services-grid, .listing-grid, .chips, .source-list, .search-steps, .search-results-preview, .valuation-points, .valuation-process"
);

revealNodes.forEach((node) => {
  node.setAttribute("data-reveal", "");
});

const heroReveal = document.querySelector(".luxury-hero");

if (heroReveal) {
  heroReveal.classList.add("is-visible");
}

staggerGroups.forEach((group) => {
  group.setAttribute("data-stagger", "");

  [...group.children].forEach((child, index) => {
    child.style.setProperty("--stagger-index", index.toString());
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18,
  }
);

revealNodes.forEach((node) => {
  if (node.classList.contains("luxury-hero")) {
    return;
  }

  observer.observe(node);
});

const hero = document.querySelector(".hero");
const motionAllowed = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const typingHeading = document.querySelector("[data-typing-text]");
const siteHeader = document.querySelector(".site-header");
const siteNav = document.querySelector(".site-nav");
const menuToggle = document.querySelector(".menu-toggle");
const leadForms = document.querySelectorAll("[data-lead-form]");
const reviewFeeds = window.REVIEW_FEEDS || {};
const rateMyAgentWidget = window.RATE_MY_AGENT_WIDGET || {};
const countupNodes = document.querySelectorAll("[data-countup]");
const pageScrollLocked = document.body.classList.contains("home-scroll-locked");
const scrollProgress = document.createElement("div");

scrollProgress.className = "scroll-progress";
document.body.appendChild(scrollProgress);

countupNodes.forEach((node) => {
  node.style.visibility = "hidden";
});

const runHeroTyping = () => {
  if (!typingHeading) {
    return;
  }

  const targetText =
    typingHeading.getAttribute("data-typing-text") || typingHeading.textContent || "";
  const textNode =
    typingHeading.querySelector(".hero-type-text") ||
    typingHeading.appendChild(document.createElement("span"));

  textNode.classList.add("hero-type-text");

  if (!motionAllowed || targetText.length > 48) {
    textNode.textContent = targetText;
    typingHeading.classList.remove("is-typing");
    return;
  }

  textNode.textContent = "";
  typingHeading.classList.add("is-typing");

  let charIndex = 0;
  let dotCount = 0;
  const maxDots = 3;

  const finishTyping = () => {
    window.setTimeout(() => {
      typingHeading.classList.remove("is-typing");
    }, 500);
  };

  const removeDots = () => {
    textNode.textContent = `${targetText}${".".repeat(dotCount)}`;

    if (dotCount > 0) {
      dotCount -= 1;
      window.setTimeout(removeDots, 140);
      return;
    }

    finishTyping();
  };

  const addDots = () => {
    textNode.textContent = `${targetText}${".".repeat(dotCount)}`;

    if (dotCount < maxDots) {
      dotCount += 1;
      window.setTimeout(addDots, 210);
      return;
    }

    window.setTimeout(() => {
      dotCount -= 1;
      removeDots();
    }, 520);
  };

  const typeText = () => {
    textNode.textContent = targetText.slice(0, charIndex);

    if (charIndex <= targetText.length) {
      charIndex += 1;
      window.setTimeout(typeText, charIndex < 5 ? 110 : 85);
      return;
    }

    window.setTimeout(() => {
      dotCount = 1;
      addDots();
    }, 450);
  };

  window.setTimeout(typeText, 260);
};

window.addEventListener("load", () => {
  document.body.classList.add("is-loaded");
  runHeroTyping();
});

const syncLeadFormDefaults = (form) => {
  if (!form) {
    return;
  }

  form.querySelectorAll("input, textarea, select").forEach((field) => {
    field.dataset.initialValue = field.value;
  });
};

const setDynamicValue = (node, value) => {
  if (!node) {
    return;
  }

  const tagName = node.tagName;

  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    node.value = value;
    return;
  }

  node.textContent = value;
};

const normalizePath = (path) => {
  if (!path || path === "/") {
    return "index.html";
  }

  const parts = path.split("/");
  return parts[parts.length - 1] || "index.html";
};

const clearCurrentNav = () => {
  if (!siteNav) {
    return;
  }

  siteNav.querySelectorAll("a").forEach((link) => {
    link.classList.remove("is-current");
    link.removeAttribute("aria-current");
  });
};

const setCurrentNav = (link) => {
  if (!link) {
    return;
  }

  clearCurrentNav();
  link.classList.add("is-current");
  link.setAttribute("aria-current", "page");
};

const closeMenu = () => {
  if (!siteHeader || !menuToggle) {
    return;
  }

  siteHeader.classList.remove("is-menu-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
};

const openMenu = () => {
  if (!siteHeader || !menuToggle) {
    return;
  }

  siteHeader.classList.add("is-menu-open");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Close navigation");
};

if (menuToggle && siteHeader && siteNav) {
  menuToggle.addEventListener("click", () => {
    if (siteHeader.classList.contains("is-menu-open")) {
      closeMenu();
      return;
    }

    openMenu();
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 780) {
      closeMenu();
    }
  });
}

const getHeaderOffset = () => {
  if (!siteHeader) {
    return 0;
  }

  const styles = window.getComputedStyle(siteHeader);
  const top = Number.parseFloat(styles.top) || 0;
  return Math.ceil(siteHeader.getBoundingClientRect().height + top + 18);
};

const jumpToSection = (target) => {
  const id = target?.replace("#", "");
  const section = id ? document.getElementById(id) : null;

  if (!section) {
    return;
  }

  const top =
    id === "home"
      ? 0
      : section.getBoundingClientRect().top + window.scrollY - getHeaderOffset();

  window.scrollTo({
    top: Math.max(0, top),
    behavior: motionAllowed ? "smooth" : "auto",
  });
};

const sectionJumpLinks = document.querySelectorAll('a[href^="#"]');
const pageMenuLinks = document.querySelectorAll("[data-section-jump]");

sectionJumpLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = link.getAttribute("href");

    if (!target || target === "#") {
      return;
    }

    event.preventDefault();
    closeMenu();
    jumpToSection(target);
  });
});

if (pageMenuLinks.length > 0) {
  const pageMenuSections = [...pageMenuLinks]
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const section = id ? document.getElementById(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  if (pageMenuSections.length > 0) {
    pageMenuLinks[0].classList.add("is-current");

    const pageMenuObserver = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visibleEntries.length === 0) {
          return;
        }

        const active = pageMenuSections.find(
          (item) => item.section === visibleEntries[0].target
        );

        if (!active) {
          return;
        }

        pageMenuLinks.forEach((link) => link.classList.remove("is-current"));
        active.link.classList.add("is-current");
      },
      {
        rootMargin: "-35% 0px -45% 0px",
        threshold: [0.1, 0.35, 0.6],
      }
    );

    pageMenuSections.forEach(({ section }) => {
      pageMenuObserver.observe(section);
    });
  }
}

if (pageScrollLocked) {
  const blockedScrollKeys = new Set([
    " ",
    "ArrowDown",
    "ArrowUp",
    "PageDown",
    "PageUp",
    "Home",
    "End",
  ]);

  window.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    if (blockedScrollKeys.has(event.key)) {
      event.preventDefault();
    }
  });
}

const updateScrollProgress = () => {
  const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
  scrollProgress.style.setProperty("--scroll-progress", progress.toString());
};

updateScrollProgress();
window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress);

if (siteNav) {
  const currentFile = normalizePath(window.location.pathname);
  const navLinks = [...siteNav.querySelectorAll("a")];
  const pageLinks = navLinks.filter((link) => !link.getAttribute("href")?.startsWith("#"));
  const sectionLinks = navLinks.filter((link) => link.getAttribute("href")?.startsWith("#"));

  const exactPageLink = pageLinks.find((link) => {
    const href = link.getAttribute("href");
    return href && normalizePath(href) === currentFile;
  });

  if (currentFile !== "index.html") {
    setCurrentNav(exactPageLink);
  } else if (sectionLinks.length > 0) {
    const sections = sectionLinks
      .map((link) => {
        const id = link.getAttribute("href")?.slice(1);
        if (!id) {
          return null;
        }

        const section = document.getElementById(id);
        if (!section) {
          return null;
        }

        return { link, section };
      })
      .filter(Boolean);

    if (sections.length > 0) {
      setCurrentNav(sections[0].link);

      const sectionObserver = new IntersectionObserver(
        (entries) => {
          const visibleEntries = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

          if (visibleEntries.length === 0) {
            return;
          }

          const activeSection = sections.find(
            (item) => item.section === visibleEntries[0].target
          );

          if (activeSection) {
            setCurrentNav(activeSection.link);
          }
        },
        {
          rootMargin: "-25% 0px -55% 0px",
          threshold: [0.2, 0.4, 0.6],
        }
      );

      sections.forEach(({ section }) => {
        sectionObserver.observe(section);
      });
    } else if (exactPageLink) {
      setCurrentNav(exactPageLink);
    }
  } else if (exactPageLink) {
    setCurrentNav(exactPageLink);
  }
}

leadForms.forEach((form) => {
  syncLeadFormDefaults(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector("[data-lead-submit]");
    const statusNode = form.querySelector("[data-lead-status]");
    const originalButtonText = submitButton?.textContent || "Submit";
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    payload.formType = form.dataset.leadForm || "general";
    payload.sourcePage = normalizePath(window.location.pathname);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
      submitButton.textContent = "Sending to Andrew...";
    }

    if (statusNode) {
      statusNode.textContent = "Submitting your details directly to Andrew.";
      statusNode.classList.remove("is-error", "is-success");
    }

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.detail || result?.error || "Lead submission failed.");
      }

      form.reset();
      form.querySelectorAll("[data-initial-value]").forEach((field) => {
        field.value = field.dataset.initialValue || "";
      });

      if (statusNode) {
        statusNode.textContent =
          "Request sent. Andrew should now have your details and can follow up directly.";
        statusNode.classList.add("is-success");
      }
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = error.message || "Lead submission failed.";
        statusNode.classList.add("is-error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
        submitButton.textContent = originalButtonText;
      }
    }
  });
});

const countFormatter = (value, decimals) => {
  if (decimals > 0) {
    return value.toFixed(decimals);
  }

  return Math.round(value).toString();
};

const parseCountPattern = (value) => {
  const match = value.match(/-?\d+(?:\.\d+)?/);

  if (!match || typeof match.index !== "number") {
    return null;
  }

  const numericText = match[0];
  const prefix = value.slice(0, match.index);
  const suffix = value.slice(match.index + numericText.length);
  const decimals = numericText.includes(".") ? numericText.split(".")[1].length : 0;
  const target = Number.parseFloat(numericText);

  if (!Number.isFinite(target)) {
    return null;
  }

  return {
    prefix,
    suffix,
    decimals,
    target,
  };
};

const setCountText = (node, pattern, value) => {
  node.textContent = `${pattern.prefix}${countFormatter(value, pattern.decimals)}${pattern.suffix}`;
};

const animateCount = (node) => {
  if (node.dataset.counted === "true") {
    return;
  }

  const sourceValue = node.getAttribute("data-countup") || node.textContent || "";
  const pattern = parseCountPattern(sourceValue);

  if (!pattern) {
    node.dataset.counted = "true";
    return;
  }

  node.dataset.counted = "true";
  node.style.visibility = "visible";

  if (!motionAllowed) {
    setCountText(node, pattern, pattern.target);
    return;
  }

  const duration = 2250;
  const startTime = performance.now();

  const tick = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const currentValue = pattern.target * eased;

    setCountText(node, pattern, currentValue);

    if (progress < 1) {
      window.requestAnimationFrame(tick);
      return;
    }

    setCountText(node, pattern, pattern.target);
  };

  setCountText(node, pattern, 0);
  window.requestAnimationFrame(tick);
};

const formatStatValue = (key, value) => {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  const number = Number(value);

  if (key === "experienceYears") {
    return `${Math.round(number)} Years`;
  }

  if (key === "salesCount") {
    return `${Math.round(number).toLocaleString()} Sales`;
  }

  if (key === "rating") {
    return `${number.toFixed(1)} Rating`;
  }

  if (key === "reviewCount") {
    return `See ${Math.round(number).toLocaleString()} public reviews`;
  }

  if (key === "annualVolume") {
    return `$${number.toFixed(2)}M`;
  }

  return String(number);
};

const updateLiveStats = async () => {
  const statNodes = document.querySelectorAll("[data-stat]");

  if (!statNodes.length) {
    return;
  }

  try {
    const response = await fetch("/api/stats", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Stats request failed: ${response.status}`);
    }

    const payload = await response.json();
    const stats = payload.stats || {};
    const sources = payload.sources || {};
    const isLive = payload.isLive || {};

    statNodes.forEach((node) => {
      const key = node.dataset.stat;
      const formatted = formatStatValue(key, stats[key]);

      if (!formatted) {
        return;
      }

      if (node.hasAttribute("data-countup")) {
        node.setAttribute("data-countup", formatted);

        if (node.dataset.counted === "true") {
          node.dataset.counted = "false";
          animateCount(node);
        } else {
          node.textContent = formatted;
        }

        return;
      }

      node.textContent = formatted;
    });

    const salesNote = document.querySelector('[data-stat-note="sales"]');
    const volumeNote = document.querySelector('[data-stat-note="volume"]');

    if (salesNote) {
      salesNote.textContent =
        sources.sales === "feed"
          ? "Automatically updated from the connected sales feed"
          : "Publicly visible sales history";
    }

    if (volumeNote) {
      volumeNote.textContent =
        sources.volume === "feed"
          ? "Automatically updated from the connected sales feed"
          : "Recent annual production signal";
    }

    const statusMap = {
      experienceYears: isLive.experience,
      salesCount: isLive.sales,
      rating: isLive.rating && isLive.reviews,
      annualVolume: isLive.volume,
    };

    Object.entries(statusMap).forEach(([key, live]) => {
      const status = document.querySelector(`[data-stat-status="${key}"]`);

      if (!status) {
        return;
      }

      status.textContent = live ? "Verified" : "Public benchmark";
      status.classList.toggle("is-live", Boolean(live));
      status.classList.toggle("is-fallback", !live);
    });
  } catch (error) {
    document.querySelectorAll("[data-stat-status]").forEach((status) => {
      status.textContent = "Public benchmark";
      status.classList.add("is-fallback");
    });
  }
};

updateLiveStats();
window.setInterval(updateLiveStats, 15 * 60 * 1000);

if (countupNodes.length > 0) {
  if (!motionAllowed) {
    countupNodes.forEach((node) => {
      animateCount(node);
    });
  } else {
    const visibleCountGroups = new WeakSet();

    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const group = entry.target.closest(".trust-strip, .trust-indicators");

          if (group) {
            if (visibleCountGroups.has(group)) {
              countObserver.unobserve(entry.target);
              return;
            }

            visibleCountGroups.add(group);

            const groupNodes = [...group.querySelectorAll("[data-countup]")];
            groupNodes.forEach((node, index) => {
              window.setTimeout(() => {
                animateCount(node);
              }, index * 260);

              countObserver.unobserve(node);
            });

            return;
          }

          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.2,
      }
    );

    countupNodes.forEach((node) => {
      countObserver.observe(node);
    });
  }
}

const formatReviewDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const renderReviewCards = (container, reviews) => {
  container.innerHTML = "";

  reviews.slice(0, 3).forEach((review) => {
    const card = document.createElement("article");
    card.className = "live-review-card";

    const quote = document.createElement("p");
    quote.className = "live-review-quote";
    quote.textContent = `“${review.text || "Review text unavailable."}”`;

    const meta = document.createElement("div");
    meta.className = "live-review-meta";

    const author = document.createElement("strong");
    author.textContent = review.author || "Verified client";

    const rating = document.createElement("span");
    rating.textContent = `${review.rating || 5.0} stars`;

    meta.append(author, rating);
    card.append(quote, meta);

    const reviewDate = formatReviewDate(review.date);

    if (reviewDate) {
      const dateNode = document.createElement("span");
      dateNode.className = "live-review-date";
      dateNode.textContent = reviewDate;
      card.append(dateNode);
    }

    container.appendChild(card);
  });
};

const renderReviewMessage = (container, message) => {
  container.innerHTML = "";
  const card = document.createElement("article");
  card.className = "live-review-card live-review-card-empty";
  card.innerHTML = `<p class="live-review-quote">${message}</p>`;
  container.appendChild(card);
};

const loadReviewFeed = async (source) => {
  const container = document.querySelector(`[data-review-source="${source}"]`);
  const status = document.querySelector(`[data-review-status="${source}"]`);
  const endpoint = reviewFeeds[source];

  if (!container || !status) {
    return;
  }

  if (!endpoint) {
    status.textContent = "Curated";
    renderReviewMessage(
      container,
      "Selected client feedback from this public profile can be featured here."
    );
    return;
  }

  status.textContent = "Refreshing";

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const reviews = Array.isArray(payload?.reviews) ? payload.reviews : [];

    if (reviews.length === 0) {
      status.textContent = "Verified";
      renderReviewMessage(
        container,
        "Verified client feedback from this source will appear here as it is published."
      );
      return;
    }

    status.textContent = "Verified";
    renderReviewCards(container, reviews);
  } catch (error) {
    status.textContent = "Curated";
    renderReviewMessage(
      container,
      "Curated review highlights from this public profile can be featured here."
    );
  }
};

["google", "zillow"].forEach((source) => {
  loadReviewFeed(source);
});

const executeEmbeddedScripts = (container) => {
  container.querySelectorAll("script").forEach((oldScript) => {
    const script = document.createElement("script");

    [...oldScript.attributes].forEach((attribute) => {
      script.setAttribute(attribute.name, attribute.value);
    });

    script.textContent = oldScript.textContent;
    oldScript.replaceWith(script);
  });
};

const mountRateMyAgentWidget = () => {
  const container = document.querySelector("[data-ratemyagent-widget]");
  const status = document.querySelector("[data-ratemyagent-status]");
  const embedHtml =
    typeof rateMyAgentWidget.embedHtml === "string"
      ? rateMyAgentWidget.embedHtml.trim()
      : "";

  if (!container || !status) {
    return;
  }

  if (!embedHtml) {
    status.textContent = "Curated";
    return;
  }

  container.innerHTML = embedHtml;
  executeEmbeddedScripts(container);
  status.textContent = "Verified";
};

mountRateMyAgentWidget();

if (hero) {
  hero.classList.remove("is-tilting");
  hero.style.transform = "none";
}
