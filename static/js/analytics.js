(function () {
  "use strict";

  var GA4_MEASUREMENT_ID = "G-KYJLM0BL40";
  var GOOGLE_TAG_SCRIPT = "https://www.googletagmanager.com/gtag/js?id=";
  var ALLOWED_HOSTS = ["nexusanalyticallabs.com", "www.nexusanalyticallabs.com"];
  var CONSENT_STORAGE_KEY = "nexus-labs.analytics-consent.v1";
  var CONSENT_GRANTED = "granted";
  var CONSENT_DENIED = "denied";
  var CONSENT_UNSET = "unset";
  var ALLOWED_EVENTS = [
    "testing_request_started",
    "testing_request_submit_attempted",
    "payment_proof_email_clicked"
  ];

  var consentState = CONSENT_UNSET;
  var consentDefaultsSet = false;
  var googleTagRequested = false;
  var consentPrompt = null;
  var requestStarted = false;

  function isProductionHost() {
    return ALLOWED_HOSTS.indexOf(window.location.hostname) !== -1;
  }

  function safePage() {
    if (window.location.pathname === "/") return { path: "/", category: "product_home" };
    if (/^\/payment\/[^/]+\/?$/.test(window.location.pathname)) {
      return { path: "/payment", category: "payment_instructions" };
    }
    return { path: "/other", category: "other" };
  }

  function prepareGoogleTag() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    if (consentDefaultsSet) return;
    window.gtag("consent", "default", {
      analytics_storage: CONSENT_DENIED,
      ad_storage: CONSENT_DENIED,
      ad_user_data: CONSENT_DENIED,
      ad_personalization: CONSENT_DENIED,
      functionality_storage: CONSENT_DENIED,
      personalization_storage: CONSENT_DENIED,
      security_storage: CONSENT_DENIED,
      wait_for_update: 500
    });
    window.gtag("set", "ads_data_redaction", true);
    consentDefaultsSet = true;
  }

  function updateGoogleConsent(analyticsStorage) {
    prepareGoogleTag();
    window.gtag("consent", "update", {
      analytics_storage: analyticsStorage,
      ad_storage: CONSENT_DENIED,
      ad_user_data: CONSENT_DENIED,
      ad_personalization: CONSENT_DENIED,
      functionality_storage: CONSENT_DENIED,
      personalization_storage: CONSENT_DENIED,
      security_storage: CONSENT_DENIED
    });
  }

  function loadGoogleTag() {
    if (googleTagRequested || consentState !== CONSENT_GRANTED || !isProductionHost()) return;
    googleTagRequested = true;
    var page = safePage();
    var safeLocation = "https://" + window.location.hostname + page.path;
    var script = document.createElement("script");
    script.async = true;
    script.src = GOOGLE_TAG_SCRIPT + encodeURIComponent(GA4_MEASUREMENT_ID);
    script.setAttribute("data-ga4-measurement-id", GA4_MEASUREMENT_ID);
    document.head.appendChild(script);
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: false,
      cookie_flags: "SameSite=Lax;Secure",
      page_location: safeLocation,
      page_referrer: "",
      page_title: page.category
    });
    window.gtag("event", "page_view", {
      environment: "production",
      page_category: page.category,
      page_location: safeLocation,
      page_referrer: ""
    });
  }

  function trackEvent(name) {
    if (ALLOWED_EVENTS.indexOf(name) === -1) return;
    if (consentState !== CONSENT_GRANTED || !googleTagRequested) return;
    try {
      window.gtag("event", name, { environment: "production" });
    } catch (_) {
      // Analytics must never affect request, payment, or email workflows.
    }
  }

  function attachWorkflowTracking() {
    var form = document.querySelector("[data-pricing-form]");
    if (form) {
      var markRequestStarted = function (event) {
        if (requestStarted || !form.contains(event.target)) return;
        var field = event.target;
        if (!field || field.type === "hidden" || field.type === "submit") return;
        requestStarted = true;
        trackEvent("testing_request_started");
      };
      form.addEventListener("focusin", markRequestStarted);
      form.addEventListener("input", markRequestStarted);
      form.addEventListener("submit", function () {
        trackEvent("testing_request_submit_attempted");
      });
    }
    var proofLink = document.querySelector(".proof-panel a.primary-button");
    if (proofLink) {
      proofLink.addEventListener("click", function () {
        trackEvent("payment_proof_email_clicked");
      });
    }
  }

  function readStoredConsent() {
    try {
      var stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored === CONSENT_GRANTED || stored === CONSENT_DENIED) return stored;
    } catch (_) {
      // Safe fallback: do not load Google on the next visit.
    }
    return CONSENT_UNSET;
  }

  function storeConsent(value) {
    try { window.localStorage.setItem(CONSENT_STORAGE_KEY, value); } catch (_) {
      // Session-only consent is acceptable when storage is unavailable.
    }
  }

  function makeElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.appendChild(document.createTextNode(text));
    return element;
  }

  function installStyles() {
    if (document.getElementById("analytics-consent-styles")) return;
    var style = document.createElement("style");
    style.id = "analytics-consent-styles";
    style.textContent =
      ".analytics-choice{position:fixed;z-index:2147483646;left:1rem;bottom:1rem;border:1px solid #64748b;border-radius:999px;padding:.55rem .8rem;background:#0b1f3a;color:#fff;font:600 13px/1.2 system-ui;cursor:pointer}" +
      ".analytics-consent{box-sizing:border-box;position:fixed;z-index:2147483647;left:50%;bottom:1rem;transform:translateX(-50%);width:min(700px,calc(100% - 2rem));background:#fff;color:#0b1f3a;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 18px 50px rgba(15,23,42,.28);padding:1rem}" +
      ".analytics-consent h2{margin:0 0 .45rem;font:700 20px/1.25 system-ui}.analytics-consent p{margin:0;font:400 14px/1.5 system-ui}" +
      ".analytics-consent__actions{display:flex;gap:.65rem;justify-content:flex-end;margin-top:.9rem;flex-wrap:wrap}.analytics-consent button{border-radius:9px;padding:.65rem .9rem;font:700 14px/1 system-ui;cursor:pointer}" +
      ".analytics-consent__decline{border:1px solid #64748b;background:#fff;color:#0b1f3a}.analytics-consent__allow{border:1px solid #0f8b8d;background:#0f8b8d;color:#fff}" +
      "@media(max-width:520px){.analytics-choice{left:.65rem;bottom:.65rem}.analytics-consent{bottom:.65rem}.analytics-consent__actions button{flex:1 1 100%}}";
    document.head.appendChild(style);
  }

  function closePrompt() {
    if (!consentPrompt) return;
    consentPrompt.remove();
    consentPrompt = null;
  }

  function applyConsent(value) {
    var reloadAfterWithdrawal = value === CONSENT_DENIED && googleTagRequested;
    consentState = value;
    storeConsent(value);
    if (isProductionHost()) {
      updateGoogleConsent(value);
      if (value === CONSENT_GRANTED) loadGoogleTag();
    }
    closePrompt();
    if (reloadAfterWithdrawal) window.location.reload();
  }

  function showPrompt(focusPrompt) {
    if (consentPrompt) {
      if (focusPrompt) consentPrompt.focus();
      return;
    }
    var panel = makeElement("section", "analytics-consent");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "analytics-consent-title");
    panel.setAttribute("tabindex", "-1");
    var title = makeElement("h2", "", "Your analytics choice");
    title.id = "analytics-consent-title";
    panel.appendChild(title);
    panel.appendChild(makeElement("p", "", "Allow privacy-bounded Google Analytics to help improve Nexus Analytical Labs. Google stays off unless you allow it. We send only sanitized page categories and approved request or payment-proof events; advertising features stay disabled."));
    var actions = makeElement("div", "analytics-consent__actions");
    var decline = makeElement("button", "analytics-consent__decline", "Decline analytics");
    decline.type = "button";
    decline.addEventListener("click", function () { applyConsent(CONSENT_DENIED); });
    var allow = makeElement("button", "analytics-consent__allow", "Allow analytics");
    allow.type = "button";
    allow.addEventListener("click", function () { applyConsent(CONSENT_GRANTED); });
    actions.appendChild(decline);
    actions.appendChild(allow);
    panel.appendChild(actions);
    document.body.appendChild(panel);
    consentPrompt = panel;
    if (focusPrompt) panel.focus();
  }

  function installPreferenceControl() {
    if (document.querySelector("[data-analytics-preferences]")) return;
    var button = makeElement("button", "analytics-choice", "Analytics choices");
    button.type = "button";
    button.setAttribute("data-analytics-preferences", "");
    button.addEventListener("click", function () { showPrompt(true); });
    document.body.appendChild(button);
  }

  function initializeAnalytics() {
    installStyles();
    installPreferenceControl();
    attachWorkflowTracking();
    consentState = readStoredConsent();
    if (isProductionHost()) {
      prepareGoogleTag();
      if (consentState === CONSENT_GRANTED) {
        updateGoogleConsent(CONSENT_GRANTED);
        loadGoogleTag();
      }
    }
    if (consentState === CONSENT_UNSET) showPrompt(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAnalytics, { once: true });
  } else {
    initializeAnalytics();
  }
})();
