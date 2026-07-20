(function () {
  "use strict";

  var ANALYTICS_SCRIPT = "https://analytics.8westventures.com/script.js";
  var WEBSITE_ID = "28a7129d-766b-4c54-a979-9a234e6be68d";
  var ALLOWED_HOSTS = ["nexusanalyticallabs.com", "www.nexusanalyticallabs.com"];
  var ALLOWED_EVENTS = [
    "testing_request_started",
    "testing_request_submit_attempted",
    "payment_proof_email_clicked"
  ];
  var pendingPayloads = [];
  var requestStarted = false;

  function sanitizedPage(pathname) {
    if (pathname === "/") {
      return { url: "/", title: "Nexus Analytical Labs" };
    }
    if (/^\/payment\/[^/]+\/?$/.test(pathname)) {
      return { url: "/payment", title: "Nexus Payment Instructions" };
    }
    return { url: "/other", title: "Nexus Analytical Labs" };
  }

  function allowedUrl(url) {
    return url === "/" || url === "/payment" || url === "/other";
  }

  function allowedEvent(name) {
    return !name || ALLOWED_EVENTS.indexOf(name) !== -1;
  }

  window.nexusAnalyticsBeforeSend = function (_type, payload) {
    if (!payload || payload.website !== WEBSITE_ID) return false;
    if (!allowedUrl(payload.url)) return false;
    if (!allowedEvent(payload.name)) return false;
    if (payload.data || payload.referrer) return false;

    return {
      website: WEBSITE_ID,
      hostname: window.location.hostname,
      url: payload.url,
      title: payload.title || "Nexus Analytical Labs",
      name: payload.name || undefined
    };
  };

  function currentSanitizedPage() {
    return sanitizedPage(window.location.pathname);
  }

  function buildPayload(eventName) {
    var page = currentSanitizedPage();
    return {
      website: WEBSITE_ID,
      hostname: window.location.hostname,
      url: page.url,
      title: page.title,
      name: eventName || undefined
    };
  }

  function flushQueue() {
    if (!window.umami || typeof window.umami.track !== "function") return;

    while (pendingPayloads.length) {
      try {
        window.umami.track(pendingPayloads.shift());
      } catch (_) {
        pendingPayloads.length = 0;
      }
    }
  }

  function sendPayload(eventName) {
    var payload = buildPayload(eventName);

    if (window.umami && typeof window.umami.track === "function") {
      try {
        window.umami.track(payload);
      } catch (_) {
        // Analytics must not affect request, payment, or email workflows.
      }
      return;
    }

    if (pendingPayloads.length < 10) {
      pendingPayloads.push(payload);
    }
  }

  function markRequestStarted(event) {
    var form = document.querySelector("[data-pricing-form]");
    if (requestStarted || !form || !form.contains(event.target)) return;

    var field = event.target;
    if (!field || field.type === "hidden" || field.type === "submit") return;

    requestStarted = true;
    sendPayload("testing_request_started");
  }

  function attachWorkflowTracking() {
    var form = document.querySelector("[data-pricing-form]");
    if (form) {
      form.addEventListener("focusin", markRequestStarted);
      form.addEventListener("input", markRequestStarted);
      form.addEventListener("submit", function () {
        sendPayload("testing_request_submit_attempted");
      });
    }

    var proofLink = document.querySelector(".proof-panel a.primary-button");
    if (proofLink) {
      proofLink.addEventListener("click", function () {
        sendPayload("payment_proof_email_clicked");
      });
    }
  }

  function loadAnalytics() {
    if (ALLOWED_HOSTS.indexOf(window.location.hostname) === -1) return;

    attachWorkflowTracking();

    var script = document.createElement("script");
    script.async = true;
    script.src = ANALYTICS_SCRIPT;
    script.setAttribute("data-website-id", WEBSITE_ID);
    script.setAttribute("data-auto-track", "false");
    script.setAttribute("data-domains", ALLOWED_HOSTS.join(","));
    script.setAttribute("data-exclude-search", "true");
    script.setAttribute("data-exclude-hash", "true");
    script.setAttribute("data-before-send", "nexusAnalyticsBeforeSend");
    script.addEventListener("load", function () {
      sendPayload();
      flushQueue();
    }, { once: true });
    document.head.appendChild(script);
  }

  loadAnalytics();
})();
