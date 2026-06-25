// Determine current page
function getPage() {
  return '/';
}

// Initialize data layer
window.dataLayer = window.dataLayer || [];

const page = getPage();

const uiInteractionMap = {
  // Header / nav
  po_editor_logo:           { element_type: "link",   element_name: "po_editor_logo",     interaction_type: "click", element_location: "header", page_name: page },
  features:                 { element_type: "link",   element_name: "features",            interaction_type: "click", element_location: "header", page_name: page },
  install:                  { element_type: "link",   element_name: "install",             interaction_type: "click", element_location: "header", page_name: page },
  faq:                      { element_type: "link",   element_name: "faq",                 interaction_type: "click", element_location: "header", page_name: page },
  github_button:            { element_type: "link",   element_name: "github",              interaction_type: "click", element_location: "header", page_name: page },
  theme_toggle:             { element_type: "button", element_name: "theme_toggle",        interaction_type: "click", element_location: "header", page_name: page },

  // Hero
  install_in_obsidian:      { element_type: "button", element_name: "install_in_obsidian", interaction_type: "click", element_location: "hero",   page_name: page },
  view_on_github:           { element_type: "link",   element_name: "view_on_github",      interaction_type: "click", element_location: "hero",   page_name: page },

  // Body
  feature_request:          { element_type: "link",   element_name: "feature_request",     interaction_type: "click", element_location: "body",   page_name: page },
  community_plugins:        { element_type: "button", element_name: "community_plugins",   interaction_type: "click", element_location: "body",   page_name: page },
  brat_install:             { element_type: "button", element_name: "brat_install",        interaction_type: "click", element_location: "body",   page_name: page },
  manual_install:           { element_type: "button", element_name: "manual_install",      interaction_type: "click", element_location: "body",   page_name: page },
  install_in_obsidian_end:  { element_type: "button", element_name: "install_in_obsidian", interaction_type: "click", element_location: "body",   page_name: page },
  star_github:              { element_type: "link",   element_name: "star_github",         interaction_type: "click", element_location: "body",   page_name: page },

  // FAQ
  obsidian_mobile:          { element_type: "button", element_name: "obsidian_mobile",             interaction_type: "click", element_location: "body", page_name: page },
  files_outside_vault:      { element_type: "button", element_name: "files_outside_vault",         interaction_type: "click", element_location: "body", page_name: page },
  existing_translation_workflow: { element_type: "button", element_name: "existing_translation_workflow", interaction_type: "click", element_location: "body", page_name: page },
  obsolete_entries:         { element_type: "button", element_name: "obsolete_entries",            interaction_type: "click", element_location: "body", page_name: page },
  plurals_cldr:             { element_type: "button", element_name: "plurals_cldr",                interaction_type: "click", element_location: "body", page_name: page },
  hotkeys:                  { element_type: "button", element_name: "hotkeys",                     interaction_type: "click", element_location: "body", page_name: page },
  focused_translations:     { element_type: "button", element_name: "focused_translations",        interaction_type: "click", element_location: "body", page_name: page },

  // Footer
  kodaskills_link:          { element_type: "link",   element_name: "kodaskills",         interaction_type: "click", element_location: "footer", page_name: page },
  github:                   { element_type: "link",   element_name: "github",             interaction_type: "click", element_location: "footer", page_name: page },
  obsidian:                 { element_type: "link",   element_name: "obsidian",           interaction_type: "click", element_location: "footer", page_name: page },
  issues:                   { element_type: "link",   element_name: "issues",             interaction_type: "click", element_location: "footer", page_name: page },
  mit:                      { element_type: "link",   element_name: "mit",                interaction_type: "click", element_location: "footer", page_name: page },

  // Section views
  features_section:         { element_type: "section", element_name: "features_section",     interaction_type: "view", element_location: "body", page_name: page },
  in_action_section:        { element_type: "section", element_name: "in_action_section",    interaction_type: "view", element_location: "body", page_name: page },
  shape_po_section:         { element_type: "section", element_name: "shape_po_section",     interaction_type: "view", element_location: "body", page_name: page },
  how_it_works_section:     { element_type: "section", element_name: "how_it_works_section", interaction_type: "view", element_location: "body", page_name: page },
  formats_section:          { element_type: "section", element_name: "formats_section",      interaction_type: "view", element_location: "body", page_name: page },
  installation_section:     { element_type: "section", element_name: "installation_section", interaction_type: "view", element_location: "body", page_name: page },
  roadmap_section:          { element_type: "section", element_name: "roadmap_section",      interaction_type: "view", element_location: "body", page_name: page },
  faq_section:              { element_type: "section", element_name: "faq_section",          interaction_type: "view", element_location: "body", page_name: page },
};

function pushUiInteraction(key) {
  const params = uiInteractionMap[key];
  if (!params) return;
  window.dataLayer.push({
    event: 'ui_interaction',
    ...params
  });
}

function getThemeState() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
  return theme;
}

function pushSystemEvent(systemAction, systemState) {
  window.dataLayer.push({
    event: 'system_event',
    system_action: systemAction,
    page_name: page,
    system_state: systemState
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const currentTheme = getThemeState();
  pushSystemEvent('page_load', currentTheme);

  // Click tracking
  document.addEventListener('click', (e) => {
    const trackedEl = e.target.closest('[data-analytics]');
    if (!trackedEl) return;
    pushUiInteraction(trackedEl.getAttribute('data-analytics'));
  });

  // Section view tracking
  const viewedSections = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const key = entry.target.dataset.analyticsSection;
      if (!key || viewedSections.has(key)) return;
      viewedSections.add(key);
      pushUiInteraction(key);
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('[data-analytics-section]').forEach((el) => observer.observe(el));
});

// Listen for analytics CustomEvents
window.addEventListener("analytics_event", (e) => {
  if (!e.detail) return;
  window.dataLayer.push({ ...e.detail, _clear: true });
  if (typeof __DEV__ !== 'undefined') {
    console.debug('[analytics]', e.detail);
  }
});
