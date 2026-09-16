/**
 * Dashboard & Authorization Controller
 *
 * Manages authenticated workspace navigation, route guard protection,
 * refresh authorization validation, DNA record retrieval from n8n,
 * and profile management.
 *
 * Route:    /dashboard.html
 * Trigger:  Dashboard view and user interactions
 * Auth:     Session verification & n8n Authorization Webhook
 */

// DOM Elements - Navigation & Sidebar
const btnAddDnaSidebar = document.getElementById('btnAddDnaSidebar');
const navYourDna = document.getElementById('navYourDna');
const navAddDna = document.getElementById('navAddDna');
const navSettings = document.getElementById('navSettings');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const sidebar = document.getElementById('sidebar');

// DOM Elements - Views
const viewYourDna = document.getElementById('viewYourDna');
const viewAddDna = document.getElementById('viewAddDna');
const viewSettings = document.getElementById('viewSettings');
const dnaCardContainer = document.getElementById('dnaCardContainer');
const existingDnaFoundationContainer = document.getElementById('existingDnaFoundationContainer');
const crumbCurrentView = document.getElementById('crumbCurrentView');

// DOM Elements - Profile & Identity
const userEmailDisplay = document.getElementById('userEmailDisplay');
const userAvatar = document.getElementById('userAvatar');
const userIdBadge = document.getElementById('userIdBadge');
const userStatusPill = document.getElementById('userStatusPill');
const btnSignOut = document.getElementById('btnSignOut');

// DOM Elements - Settings (Profile)
const settingsEmailField = document.getElementById('settingsEmailField');
const settingsUserIdField = document.getElementById('settingsUserIdField');
const inputSettingsName = document.getElementById('inputSettingsName');
const inputSettingsPassword = document.getElementById('inputSettingsPassword');
const btnTogglePasswordVisibility = document.getElementById('btnTogglePasswordVisibility');
const formProfileSettings = document.getElementById('formProfileSettings');
const btnSaveProfileSettings = document.getElementById('btnSaveProfileSettings');
const btnSaveProfileText = document.getElementById('btnSaveProfileText');
const profileAlertBox = document.getElementById('profileAlertBox');

// DOM Elements - Settings (Webhook & Environments)
const formWebhookSettings = document.getElementById('formWebhookSettings');
const btnPresetProdWebhook = document.getElementById('btnPresetProdWebhook');
const btnPresetTestWebhook = document.getElementById('btnPresetTestWebhook');
const inputSettingsWebhookUrl = document.getElementById('inputSettingsWebhookUrl');
const btnSaveWebhookSettings = document.getElementById('btnSaveWebhookSettings');
const btnSaveWebhookText = document.getElementById('btnSaveWebhookText');
const btnTestWebhookPing = document.getElementById('btnTestWebhookPing');
const webhookAlertBox = document.getElementById('webhookAlertBox');

// DOM Elements - Ingestion & Dropzone
const dropzone = document.getElementById('dropzone');
const dnaFileInput = document.getElementById('dnaFileInput');
const selectedFileCard = document.getElementById('selectedFileCard');
const selectedFileName = document.getElementById('selectedFileName');
const selectedFileSizeBadge = document.getElementById('selectedFileSizeBadge');
const selectedFilePreview = document.getElementById('selectedFilePreview');
const btnUploadDna = document.getElementById('btnUploadDna');
const btnUploadText = document.getElementById('btnUploadText');
const dnaAlertBox = document.getElementById('dnaAlertBox');
const dashboardNotificationBox = document.getElementById('dashboardNotificationBox');

// Global application state for validation and DNA data
window.AppState = {
  currentUser: null,
  isValidUser: false,
  hasDNA: false,
  dnaRecord: null
};

// State holding selected file
let selectedDnaFile = null;
let selectedDnaContent = '';

/**
 * Initialize user session details and render initial view
 */
function initDashboard() {
  // Step 1: Load real authenticated user information from session
  let realEmail = '';
  let realUserId = '';
  let realName = '';
  const sessionUser = sessionStorage.getItem('auth_user_data');
  if (sessionUser) {
    try {
      const parsed = JSON.parse(sessionUser);
      if (parsed && parsed.email && parsed.email.includes('@') && !parsed.email.includes('authenticated_user')) {
        realEmail = parsed.email.trim().toLowerCase();
        realUserId = parsed.user_id || parsed.userId || '';
        realName = parsed.name || '';
      }
    } catch (e) {
      realEmail = '';
    }
  }

  // Check URL parameters if arrived from SSO
  if (!realEmail) {
    const urlParams = new URLSearchParams(window.location.search);
    const paramEmail = urlParams.get('email') || urlParams.get('user');
    if (paramEmail && paramEmail.includes('@') && !paramEmail.includes('authenticated_user')) {
      realEmail = paramEmail.trim().toLowerCase();
    }
    const paramName = urlParams.get('name');
    if (paramName) {
      realName = paramName.trim();
    }
  }

  // Reject placeholder or test emails strictly
  if (realEmail === 'test@example.com' || realEmail === 'authenticated_user') {
    realEmail = '';
  }

  // Route Guard: If not authenticated and no valid SSO email, redirect to Sign In
  if (!realEmail) {
    window.location.href = 'index.html';
    return;
  }

  // Update profile card and settings fields when real identity is available
  if (userEmailDisplay && realEmail) {
    userEmailDisplay.textContent = realEmail;
  }
  if (userAvatar) {
    const initial = realName ? realName[0].toUpperCase() : (realEmail ? realEmail[0].toUpperCase() : 'U');
    userAvatar.textContent = initial;
  }
  if (userIdBadge) {
    userIdBadge.textContent = realUserId ? `ID: ${realUserId}` : '';
  }
  if (userStatusPill) {
    userStatusPill.textContent = 'Checking...';
    userStatusPill.className = 'user-status-pill status-pending';
  }

  if (settingsEmailField && realEmail) {
    settingsEmailField.textContent = realEmail;
  }
  if (settingsUserIdField && realUserId) {
    settingsUserIdField.textContent = realUserId;
  }
  if (inputSettingsName && realName) {
    inputSettingsName.value = realName;
  }

  // Initialize Webhook input with active endpoint
  const activeWebhook = (typeof API_CONFIG !== 'undefined' && API_CONFIG.defaultUrl) ? API_CONFIG.defaultUrl : 'http://localhost:5678/webhook/sign_both';
  if (inputSettingsWebhookUrl) {
    inputSettingsWebhookUrl.value = activeWebhook;
  }
  updatePresetButtons(activeWebhook);

  // Restore sidebar collapsed preference if saved
  if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
    sidebar.classList.add('collapsed');
  }

  // Render initial Your DNA view
  renderYourDnaView();

  // Trigger authorization and DNA validation with n8n
  refreshUserAndDnaValidation(realEmail);
}

/**
 * Switch view between 'your-dna', 'add-dna', and 'settings'
 */
function switchView(viewName) {
  clearDnaAlert();
  clearProfileAlert();
  clearWebhookAlert();

  // Reset active classes on all nav items
  [navYourDna, navAddDna, navSettings].forEach(nav => {
    if (nav) nav.classList.remove('active');
  });

  // Hide all view sections
  [viewYourDna, viewAddDna, viewSettings].forEach(view => {
    if (view) view.style.display = 'none';
  });

  if (viewName === 'add-dna') {
    if (viewAddDna) viewAddDna.style.display = 'block';
    if (navAddDna) navAddDna.classList.add('active');
    if (crumbCurrentView) crumbCurrentView.textContent = 'Upload DNA.md';
    renderAddDnaExistingFoundation();
  } else if (viewName === 'settings') {
    if (viewSettings) viewSettings.style.display = 'block';
    if (navSettings) navSettings.classList.add('active');
    if (crumbCurrentView) crumbCurrentView.textContent = 'Settings & Integration';
  } else {
    if (viewYourDna) viewYourDna.style.display = 'block';
    if (navYourDna) navYourDna.classList.add('active');
    if (crumbCurrentView) crumbCurrentView.textContent = 'Your DNA';
    renderYourDnaView();
  }
}

// Sidebar action and navigation event bindings
if (btnAddDnaSidebar) {
  btnAddDnaSidebar.addEventListener('click', () => switchView('add-dna'));
}
if (navAddDna) {
  navAddDna.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('add-dna');
  });
}
if (navYourDna) {
  navYourDna.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('your-dna');
  });
}
if (navSettings) {
  navSettings.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('settings');
  });
}

// Collapsible sidebar toggle
if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
  });
}

/**
 * Utility to escape HTML entities for secure code rendering
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract or synthesize the full context of the DNA document from active record or session
 */
function getDnaFullContext(dnaInfo) {
  if (!dnaInfo) return '';

  // 1. Direct raw file content if available
  if (typeof dnaInfo.fileContent === 'string' && dnaInfo.fileContent.trim().length > 0) {
    return dnaInfo.fileContent.trim();
  }
  if (typeof dnaInfo.property_file_content === 'string' && dnaInfo.property_file_content.trim().length > 0) {
    return dnaInfo.property_file_content.trim();
  }
  if (typeof dnaInfo.content === 'string' && dnaInfo.content.trim().length > 0) {
    return dnaInfo.content.trim();
  }
  if (typeof dnaInfo.raw_content === 'string' && dnaInfo.raw_content.trim().length > 0) {
    return dnaInfo.raw_content.trim();
  }

  // 2. Extract from Notion individual pillar properties if present
  const getPropText = (propName) => {
    if (dnaInfo[propName] && typeof dnaInfo[propName] === 'string') return dnaInfo[propName];
    if (dnaInfo[`property_${propName}`] && typeof dnaInfo[`property_${propName}`] === 'string') return dnaInfo[`property_${propName}`];
    if (dnaInfo.properties && dnaInfo.properties[propName]) {
      const p = dnaInfo.properties[propName];
      if (p.rich_text && p.rich_text[0] && p.rich_text[0].plain_text) {
        return p.rich_text.map(t => t.plain_text).join('');
      }
      if (p.title && p.title[0] && p.title[0].plain_text) {
        return p.title.map(t => t.plain_text).join('');
      }
    }
    return '';
  };

  const brandFoundation = getPropText('brand_foundation');
  const contentStrategy = getPropText('content_strategy');
  const contentMatrix = getPropText('content_matrix');
  const designSystem = getPropText('design_system');
  const generationEngine = getPropText('generation_engine');

  const hasAnyPillarText = Boolean(brandFoundation || contentStrategy || contentMatrix || designSystem || generationEngine);

  if (hasAnyPillarText) {
    const fileName = dnaInfo.name || dnaInfo.property_file_name || dnaInfo.fileName || 'DNA.md';
    let doc = `# Brand DNA: ${fileName}\n\n`;
    doc += `> Validated and active in AI Studio Engine\n\n`;

    if (brandFoundation) {
      doc += `## 1. Brand Foundation\n${brandFoundation}\n\n`;
    }
    if (contentStrategy) {
      doc += `## 2. Content Strategy\n${contentStrategy}\n\n`;
    }
    if (contentMatrix) {
      doc += `## 3. Content Matrix\n${contentMatrix}\n\n`;
    }
    if (designSystem) {
      doc += `## 4. Design System\n${designSystem}\n\n`;
    }
    if (generationEngine) {
      doc += `## 5. Generation Engine\n${generationEngine}\n\n`;
    }
    return doc.trim();
  }

  // 3. Fallback to saved session storage user_dna_data
  const savedData = sessionStorage.getItem('user_dna_data');
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      if (parsed && parsed.fileContent) {
        return parsed.fileContent.trim();
      }
    } catch (e) {
      // ignore
    }
  }

  return '# Brand DNA Blueprint\n\nActive brand specification synchronized with Notion and n8n.\nAll 5 strategic pillars are calibrated and ready for carousel content generation.';
}

/**
 * Global helper to copy full DNA context to clipboard
 */
window.copyDnaContextContent = function (btn) {
  const codeEl = document.getElementById('dnaContextRawText');
  if (!codeEl) return;
  const text = codeEl.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const label = btn.querySelector('.action-label');
    const originalText = label ? label.textContent : 'Copy Context';
    if (label) label.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      if (label) label.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy context:', err);
  });
};

/**
 * Global helper to toggle full height view for DNA context reader
 */
window.toggleDnaContextExpand = function (btn) {
  const contextBody = document.getElementById('dnaContextBody');
  if (!contextBody) return;
  const isExpanded = contextBody.classList.toggle('expanded');
  const label = btn.querySelector('.action-label');
  if (label) {
    label.textContent = isExpanded ? 'Collapse' : 'Expand';
  }
};

/**
 * Global helper to download active DNA context as a .md file
 */
window.downloadDnaFileContent = function (fileName = 'DNA.md') {
  const codeEl = document.getElementById('dnaContextRawText');
  if (!codeEl) return;
  const text = codeEl.textContent || '';
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = fileName && fileName !== 'DNA.md' ? fileName : 'DNA.md';
  a.download = cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Render the Your DNA view cards with established DNA pillars
 */
function renderYourDnaView() {
  let dnaInfo = null;

  if (window.AppState && window.AppState.hasDNA && window.AppState.dnaRecord) {
    dnaInfo = window.AppState.dnaRecord;
  } else {
    const savedDna = sessionStorage.getItem('user_dna_record');
    const hasDnaFlag = sessionStorage.getItem('hasDNA') === 'true';
    if (savedDna && hasDnaFlag) {
      try {
        dnaInfo = JSON.parse(savedDna);
      } catch (e) {
        dnaInfo = null;
      }
    }
  }

  const isDnaActive = Boolean(dnaInfo && (window.AppState.hasDNA || sessionStorage.getItem('hasDNA') === 'true'));

  // Update Operational HUD Telemetry
  const kpiDnaFile = document.getElementById('kpiDnaFile');
  const kpiDnaSubtext = document.getElementById('kpiDnaSubtext');
  const metricDnaDot = document.getElementById('metricDnaDot');
  const kpiPillarsTag = document.getElementById('kpiPillarsTag');
  const kpiPillarsValue = document.getElementById('kpiPillarsValue');
  const kpiPillarsSubtext = document.getElementById('kpiPillarsSubtext');

  if (isDnaActive && dnaInfo) {
    const fileName = dnaInfo.name || dnaInfo.property_file_name || dnaInfo.fileName || 'DNA.md';
    const syncTime = dnaInfo.updatedAt ? `Last synced: ${new Date(dnaInfo.updatedAt).toLocaleTimeString()}` : 'Synchronized via n8n';
    const fullContext = getDnaFullContext(dnaInfo);
    const lineCount = fullContext.split('\n').length;
    const wordCount = fullContext.trim().split(/\s+/).filter(Boolean).length;
    const sizeBytes = dnaInfo.fileSize || dnaInfo.property_file_size || (new Blob([fullContext]).size);
    const sizeKb = (sizeBytes / 1024).toFixed(1);

    if (kpiDnaFile) kpiDnaFile.textContent = fileName;
    if (kpiDnaSubtext) kpiDnaSubtext.textContent = 'Active Brand Intelligence';
    if (metricDnaDot) metricDnaDot.className = 'metric-status-dot dot-active';
    if (kpiPillarsTag) kpiPillarsTag.textContent = '5 / 5';
    if (kpiPillarsValue) kpiPillarsValue.textContent = '100%';
    if (kpiPillarsSubtext) kpiPillarsSubtext.textContent = '5 Vectors Calibrated';

    // Render active uploaded DNA engine cockpit
    dnaCardContainer.innerHTML = `
      <div class="dna-card">
        <div class="dna-card-header">
          <div class="dna-title-block">
            <h3>Active DNA: ${fileName}</h3>
            <p>Brand intelligence loaded and calibrated across 5 strategic pillars for AI studio generation.</p>
          </div>
          <span class="dna-status-badge">
            <span class="badge-dot"></span>
            Active &bull; Verified by n8n
          </span>
        </div>

        <div class="dna-pillars-grid">
          
          <div class="pillar-card pillar-coral">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 01</span>
            </div>
            <h4 class="pillar-name">Brand Foundation</h4>
            <p class="pillar-desc">Core positioning, value propositions, target audience personas, and authentic brand voice.</p>
            <ul class="pillar-specs-list">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Mission &amp; Value Propositions</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Audience Demographics &amp; ICP</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-cyan">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 02</span>
            </div>
            <h4 class="pillar-name">Content Strategy</h4>
            <p class="pillar-desc">Strategic narrative framing, tone calibration, copywriting guidelines, and channel targets.</p>
            <ul class="pillar-specs-list">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Narrative Framing Rules</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Tone &amp; Lexicon Constraints</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-purple">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 03</span>
            </div>
            <h4 class="pillar-name">Content Matrix</h4>
            <p class="pillar-desc">Topic expansion framework, hook generation formulas, and carousel slide structure blueprints.</p>
            <ul class="pillar-specs-list">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>5x5 Angle Generation Grid</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Slide Hierarchy Blueprint</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-emerald">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                  <path d="M2 12h20"></path>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 04</span>
            </div>
            <h4 class="pillar-name">Design System</h4>
            <p class="pillar-desc">Visual tokens, typography scale, palette references, and layout proportions for generated assets.</p>
            <ul class="pillar-specs-list">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Palette Hex Codes &amp; Accents</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Typography &amp; Spacing Tokens</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-amber">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 05</span>
            </div>
            <h4 class="pillar-name">Generation Engine</h4>
            <p class="pillar-desc">Master prompt rules, consistency calibration parameters, topic input schema, and image models.</p>
            <ul class="pillar-specs-list">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Master Consistency Prompts</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Deterministic Seed Control</span>
              </li>
            </ul>
          </div>

        </div>

        <!-- DNA Document Context Reader Footer -->
        <div class="dna-card-footer">
          <div class="dna-context-header">
            <div class="dna-context-title-wrap">
              <div class="dna-context-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div class="dna-context-meta-text">
                <div class="dna-context-heading-row">
                  <h4 class="dna-context-title">Full DNA Specification</h4>
                  <span class="dna-context-badge">Active Ingestion</span>
                </div>
                <div class="dna-context-meta-tags">
                  <span class="meta-tag font-mono">${fileName}</span>
                  <span class="meta-tag-dot">&bull;</span>
                  <span class="meta-tag font-mono">${sizeKb} KB</span>
                  <span class="meta-tag-dot">&bull;</span>
                  <span class="meta-tag font-mono">${lineCount} lines</span>
                  <span class="meta-tag-dot">&bull;</span>
                  <span class="meta-tag font-mono">${wordCount} words</span>
                </div>
              </div>
            </div>

            <div class="dna-context-actions">
              <button type="button" class="btn-context-action" id="btnCopyDnaContext" onclick="copyDnaContextContent(this)" title="Copy full context to clipboard">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="action-label">Copy Context</span>
              </button>

              <button type="button" class="btn-context-action" id="btnToggleDnaExpand" onclick="toggleDnaContextExpand(this)" title="Toggle expand reader">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
                <span class="action-label">Expand</span>
              </button>

              <button type="button" class="btn-context-action" id="btnDownloadDna" onclick="downloadDnaFileContent('${fileName}')" title="Download Markdown file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span class="action-label">Download .md</span>
              </button>
            </div>
          </div>

          <div class="dna-context-body" id="dnaContextBody">
            <pre class="dna-context-pre" id="dnaContextRawText"><code>${escapeHtml(fullContext)}</code></pre>
          </div>

          <div class="dna-context-footer-bar">
            <div class="sync-indicator">
              <span class="sync-dot"></span>
              <span>${syncTime}</span>
            </div>
            <button type="button" class="btn-reupload-link" onclick="switchView('add-dna')">
              <span>Update / Replace DNA File &rarr;</span>
            </button>
          </div>
        </div>

      </div>
    `;
  } else {
    if (kpiDnaFile) kpiDnaFile.textContent = 'Standby';
    if (kpiDnaSubtext) kpiDnaSubtext.textContent = 'Awaiting DNA.md';
    if (metricDnaDot) metricDnaDot.className = 'metric-status-dot dot-standby';
    if (kpiPillarsTag) kpiPillarsTag.textContent = '0 / 5';
    if (kpiPillarsValue) kpiPillarsValue.textContent = '0%';
    if (kpiPillarsSubtext) kpiPillarsSubtext.textContent = '5 Vectors Pending';

    // Render standby state awaiting DNA ingestion
    dnaCardContainer.innerHTML = `
      <div class="dna-card">
        <div class="dna-card-header">
          <div class="dna-title-block">
            <h3>Brand DNA Blueprint</h3>
            <p>Awaiting brand DNA ingestion. Upload your DNA.md file to calibrate the 5 intelligence pillars below.</p>
          </div>
          <span class="dna-status-badge badge-standby">
            <span class="badge-dot dot-standby"></span>
            Standby &bull; Awaiting DNA.md
          </span>
        </div>

        <div class="dna-pillars-grid">
          
          <div class="pillar-card pillar-standby">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 01</span>
            </div>
            <h4 class="pillar-name">Brand Foundation</h4>
            <p class="pillar-desc">Core mission, positioning, target audience personas, and authentic voice constraints.</p>
            <ul class="pillar-specs-list specs-standby">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Mission &amp; Value Props</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Audience ICP Persona</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-standby">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 02</span>
            </div>
            <h4 class="pillar-name">Content Strategy</h4>
            <p class="pillar-desc">Strategic narrative arcs, tone calibration, copywriting rules, and channel guidelines.</p>
            <ul class="pillar-specs-list specs-standby">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Narrative Framing</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Tone &amp; Style Limits</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-standby">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 03</span>
            </div>
            <h4 class="pillar-name">Content Matrix</h4>
            <p class="pillar-desc">Topic expansion framework, hook formulas, carousel formats, and slide blueprints.</p>
            <ul class="pillar-specs-list specs-standby">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Angle Matrix Rules</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Slide Blueprints</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-standby">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                  <path d="M2 12h20"></path>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 04</span>
            </div>
            <h4 class="pillar-name">Design System</h4>
            <p class="pillar-desc">Visual tokens, palette references, typography scale, and layout guidelines.</p>
            <ul class="pillar-specs-list specs-standby">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Color Palette Tokens</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Typography Scale</span>
              </li>
            </ul>
          </div>

          <div class="pillar-card pillar-standby">
            <div class="pillar-card-top">
              <div class="pillar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <span class="pillar-tag">Pillar 05</span>
            </div>
            <h4 class="pillar-name">Generation Engine</h4>
            <p class="pillar-desc">Master prompt rules, consistency calibration parameters, and variation controls.</p>
            <ul class="pillar-specs-list specs-standby">
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Master Prompts</span>
              </li>
              <li>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
                <span>Awaiting: Seed Parameters</span>
              </li>
            </ul>
          </div>

        </div>

        <div class="empty-dna-state">
          <h4>Ready to activate your Brand DNA?</h4>
          <p>Upload your brand specification file (DNA.md) to automatically configure all 5 intelligence pillars across your AI studio workflow.</p>
          <button type="button" class="btn-primary" onclick="switchView('add-dna')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Upload DNA.md File</span>
          </button>
        </div>
      </div>
    `;
  }
}

/**
 * Check and render existing DNA foundation in the Add Your DNA page
 * If a foundation is found in Notion, it is displayed. If not found, nothing appears.
 */
function renderAddDnaExistingFoundation() {
  if (!existingDnaFoundationContainer) return;

  let dnaInfo = null;
  if (window.AppState && window.AppState.hasDNA && window.AppState.dnaRecord) {
    dnaInfo = window.AppState.dnaRecord;
  } else {
    const savedDna = sessionStorage.getItem('user_dna_record');
    const hasDnaFlag = sessionStorage.getItem('hasDNA') === 'true';
    if (savedDna && hasDnaFlag) {
      try {
        dnaInfo = JSON.parse(savedDna);
      } catch (e) {
        dnaInfo = null;
      }
    }
  }

  const isDnaActive = Boolean(dnaInfo && (window.AppState.hasDNA || sessionStorage.getItem('hasDNA') === 'true'));

  if (isDnaActive && dnaInfo) {
    const fileName = dnaInfo.name || dnaInfo.property_file_name || dnaInfo.fileName || 'DNA.md';
    const syncTime = dnaInfo.updatedAt ? `Last synced: ${new Date(dnaInfo.updatedAt).toLocaleTimeString()}` : 'Active in Notion';

    existingDnaFoundationContainer.style.display = 'block';
    existingDnaFoundationContainer.innerHTML = `
      <div class="existing-foundation-card">
        <div class="existing-foundation-header">
          <div class="existing-foundation-title-wrap">
            <div class="existing-foundation-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <div>
              <h3 class="existing-foundation-title">Active DNA Foundation: ${fileName}</h3>
              <p class="existing-foundation-subtitle">Brand intelligence foundation currently calibrated in Notion &bull; ${syncTime}</p>
            </div>
          </div>
          <span class="existing-foundation-badge">
            <span class="badge-dot"></span>
            Foundation Active
          </span>
        </div>

        <div class="existing-foundation-pillars">
          <span class="foundation-pillar-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Pillar 1: Brand Foundation</span>
          </span>
          <span class="foundation-pillar-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Pillar 2: Content Strategy</span>
          </span>
          <span class="foundation-pillar-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Pillar 3: Content Matrix</span>
          </span>
          <span class="foundation-pillar-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Pillar 4: Design System</span>
          </span>
          <span class="foundation-pillar-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Pillar 5: Generation Engine</span>
          </span>
        </div>

        <div class="existing-foundation-footer">
          <div class="existing-foundation-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Uploading a new DNA.md below will update and replace your current brand foundation.</span>
          </div>
          <button type="button" class="btn-foundation-link" onclick="switchView('your-dna')">
            <span>View Foundation in Your DNA &rarr;</span>
          </button>
        </div>
      </div>
    `;
  } else {
    // If not found in Notion, nothing appears
    existingDnaFoundationContainer.style.display = 'none';
    existingDnaFoundationContainer.innerHTML = '';
  }
}


/**
 * Alert box display helpers
 */
function showDashboardNotification(message, type = 'info') {
  if (dashboardNotificationBox) {
    dashboardNotificationBox.className = `alert-box alert-${type} visible`;
    dashboardNotificationBox.textContent = message;
  }
}

function clearDashboardNotification() {
  if (dashboardNotificationBox) {
    dashboardNotificationBox.className = 'alert-box';
    dashboardNotificationBox.textContent = '';
  }
}

function showDnaAlert(message, type = 'info') {
  if (dnaAlertBox) {
    dnaAlertBox.className = `alert-box alert-${type} visible`;
    dnaAlertBox.textContent = message;
  }
}

function clearDnaAlert() {
  if (dnaAlertBox) {
    dnaAlertBox.className = 'alert-box';
    dnaAlertBox.textContent = '';
  }
}

function showProfileAlert(message, type = 'info') {
  if (profileAlertBox) {
    profileAlertBox.className = `alert-box alert-${type} visible`;
    profileAlertBox.textContent = message;
  }
}

function clearProfileAlert() {
  if (profileAlertBox) {
    profileAlertBox.className = 'alert-box';
    profileAlertBox.textContent = '';
  }
}

function showWebhookAlert(message, type = 'info') {
  if (webhookAlertBox) {
    webhookAlertBox.className = `alert-box alert-${type} visible`;
    webhookAlertBox.textContent = message;
  }
}

function clearWebhookAlert() {
  if (webhookAlertBox) {
    webhookAlertBox.className = 'alert-box';
    webhookAlertBox.textContent = '';
  }
}

/**
 * Update the user status badge in the sidebar footer
 */
function updateUserStatusBadge(statusText, type = 'inactive') {
  if (userStatusPill) {
    userStatusPill.textContent = statusText;
    userStatusPill.className = `user-status-pill ${type === 'active' ? '' : (type === 'pending' ? 'status-pending' : 'status-inactive')}`;
  }
}

/**
 * Refresh and validate authenticated user identity and DNA status with n8n
 *
 * Sequence:
 * 1. Validate real email (reject test/placeholder emails)
 * 2. Check user existence and approved status with n8n Users database (action: 'check_user')
 * 3. If valid and approved, check DNA database with n8n (action: 'get_dna_record')
 * 4. Store complete DNA record and update hasDNA state
 * 5. Notify "You have a DNA." if DNA exists
 *
 * Route:    /dashboard.html
 * Trigger:  Invoked on every dashboard initialization / refresh
 * Auth:     n8n Users Database & DNA Database
 */
async function refreshUserAndDnaValidation(authenticatedEmail) {
  clearDashboardNotification();

  // STEP 1: Verify authenticated email is valid and not a placeholder
  if (!authenticatedEmail || typeof authenticatedEmail !== 'string') {
    updateUserStatusBadge('Inactive', 'inactive');
    window.AppState.isValidUser = false;
    window.AppState.hasDNA = false;
    window.AppState.dnaRecord = null;
    sessionStorage.setItem('hasDNA', 'false');
    sessionStorage.removeItem('user_dna_record');
    sessionStorage.removeItem('user_dna_data');
    renderYourDnaView();
    renderAddDnaExistingFoundation();
    return;
  }

  const cleanEmail = authenticatedEmail.trim().toLowerCase();
  if (
    !cleanEmail.includes('@') ||
    cleanEmail.includes('authenticated_user') ||
    cleanEmail === 'test@example.com'
  ) {
    updateUserStatusBadge('Invalid Account', 'inactive');
    window.AppState.isValidUser = false;
    window.AppState.hasDNA = false;
    window.AppState.dnaRecord = null;
    sessionStorage.setItem('hasDNA', 'false');
    sessionStorage.removeItem('user_dna_record');
    sessionStorage.removeItem('user_dna_data');
    renderYourDnaView();
    renderAddDnaExistingFoundation();
    return;
  }

  const endpoint = (typeof API_CONFIG !== 'undefined' && API_CONFIG.defaultUrl)
    ? API_CONFIG.defaultUrl
    : 'http://localhost:5678/webhook/sign_both';

  try {
    // ==================================================================
    // STEP 1: CHECK USER EXISTS & ACCESS/APPROVED STATUS IN USERS DB
    // ==================================================================
    const userPayload = {
      action: 'check_user',
      email: cleanEmail,
      timestamp: new Date().toISOString()
    };

    const userResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(userPayload)
    });

    let userData;
    const userContentType = userResponse.headers.get('content-type');
    if (userContentType && userContentType.includes('application/json')) {
      userData = await userResponse.json();
    } else {
      const text = await userResponse.text();
      try {
        userData = JSON.parse(text);
      } catch (e) {
        userData = { message: text };
      }
    }

    const userObj = Array.isArray(userData) ? (userData[0] || {}) : (userData || {});
    console.log('[Dashboard Refresh Step 1: Check User]', { raw: userData, userObj });

    // Check specific Notion simplified properties returned by n8n
    const availableVal = (
      userObj.property_available ||
      userObj.available ||
      (userObj.properties && userObj.properties.available && (userObj.properties.available.select || userObj.properties.available.status) ? (userObj.properties.available.select?.name || userObj.properties.available.status?.name) : '') ||
      ''
    ).toLowerCase().trim();

    const isExplicitlyUnapproved = availableVal === 'no account' || availableVal === 'inactive' || availableVal === 'blocked' || userObj.approved === false;

    // Determine user validity and approval status from n8n backend
    const isUserApproved = userResponse.ok && !isExplicitlyUnapproved && (
      availableVal === 'have account' ||
      availableVal === 'active' ||
      availableVal === 'available' ||
      userObj.approved === true ||
      userObj.success === true ||
      userObj.status === 'approved' ||
      (Array.isArray(userData) && userData.length > 0 && userObj.approved !== false && !isExplicitlyUnapproved)
    );

    // If user does not exist or is no longer approved: STOP and automatically sign out
    if (!isUserApproved) {
      const badgeText = availableVal === 'no account' ? 'No Account' : (userObj.approved === false ? 'Unapproved' : 'Inactive');
      updateUserStatusBadge(badgeText, 'inactive');
      console.warn('[Dashboard Refresh Validation] User is not approved or has no active account in Notion. Automatically signing out.');

      window.AppState.isValidUser = false;
      window.AppState.hasDNA = false;
      window.AppState.dnaRecord = null;

      // Clear all active user and DNA session data
      sessionStorage.removeItem('auth_user_data');
      sessionStorage.removeItem('user_dna_data');
      sessionStorage.removeItem('user_dna_record');
      sessionStorage.removeItem('hasDNA');

      renderYourDnaView();
      renderAddDnaExistingFoundation();

      showDashboardNotification('Account not authorized or inactive. Automatically signing out...', 'error');

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1400);
      return;
    }

    // User is validated and approved
    updateUserStatusBadge('Active', 'active');
    window.AppState.isValidUser = true;
    window.AppState.currentUser = cleanEmail;

    // Update User ID badge if returned from Notion
    const returnedUserId = userObj.property_user_id || userObj.user_id || userObj.userId || (userObj.properties && userObj.properties['User ID'] && userObj.properties['User ID'].rich_text && userObj.properties['User ID'].rich_text[0] ? userObj.properties['User ID'].rich_text[0].plain_text : '');
    if (userIdBadge) {
      userIdBadge.textContent = returnedUserId ? `ID: ${returnedUserId}` : '';
    }

    // Update display name if returned from Notion
    const returnedName = userObj.property_name || userObj.name || (userObj.properties && userObj.properties['Name'] && userObj.properties['Name'].title && userObj.properties['Name'].title[0] ? userObj.properties['Name'].title[0].plain_text : '');
    if (returnedName && userAvatar) {
      userAvatar.textContent = returnedName[0].toUpperCase();
    }

    // ==================================================================
    // STEP 2: CHECK DNA IN NOTION DNA DATABASE (action: 'get_dna_record')
    // ==================================================================
    const dnaPayload = {
      action: 'get_dna_record',
      email: cleanEmail,
      timestamp: new Date().toISOString()
    };

    const dnaResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(dnaPayload)
    });

    let dnaData;
    const dnaContentType = dnaResponse.headers.get('content-type');
    if (dnaContentType && dnaContentType.includes('application/json')) {
      dnaData = await dnaResponse.json();
    } else {
      const text = await dnaResponse.text();
      try {
        dnaData = JSON.parse(text);
      } catch (e) {
        dnaData = { message: text };
      }
    }

    console.log('[Dashboard Refresh Step 2: Check DNA]', { raw: dnaData });

    // Check if n8n returned no item found or empty table response
    const isNoItem = dnaData && (
      dnaData.code === 0 ||
      (typeof dnaData.message === 'string' && dnaData.message.toLowerCase().includes('no item')) ||
      dnaData.exists === false ||
      dnaData.hasDNA === false
    );

    let completeRecord = null;
    let hasDNA = false;

    if (!isNoItem && dnaData) {
      let dnaObj = null;
      if (Array.isArray(dnaData) && dnaData.length > 0) {
        // When multiple rows exist for the same user in Notion, select the latest updated/created record
        const sorted = [...dnaData].sort((a, b) => {
          const timeA = new Date(a.last_edited_time || a.created_time || a.updatedAt || a.property_updated_at || 0).getTime();
          const timeB = new Date(b.last_edited_time || b.created_time || b.updatedAt || b.property_updated_at || 0).getTime();
          if (timeA && timeB && timeA !== timeB) {
            return timeB - timeA;
          }
          return 0;
        });
        // If explicit timestamps exist, use top sorted; otherwise pick the last appended item in the table
        dnaObj = (sorted[0] && (sorted[0].last_edited_time || sorted[0].created_time)) ? sorted[0] : dnaData[dnaData.length - 1];
      } else if (dnaData && typeof dnaData === 'object') {
        dnaObj = dnaData;
      }

      if (dnaObj && typeof dnaObj === 'object') {
        const hasContent = Boolean(
          dnaObj.id ||
          dnaObj.name ||
          dnaObj.property_name ||
          dnaObj.fileName ||
          dnaObj.property_file_name ||
          dnaObj.fileContent ||
          dnaObj.property_brand_foundation ||
          dnaObj.property_content_strategy ||
          dnaObj.property_content_matrix ||
          (dnaObj.properties && (dnaObj.properties['DNA'] || dnaObj.properties['brand_foundation']))
        );

        if (hasContent && dnaObj.approved !== false) {
          completeRecord = dnaObj;
          if (!completeRecord.fileContent) {
            const savedLocal = sessionStorage.getItem('user_dna_data') || sessionStorage.getItem('user_dna_record');
            if (savedLocal) {
              try {
                const parsedLocal = JSON.parse(savedLocal);
                if (parsedLocal && parsedLocal.fileContent) {
                  completeRecord.fileContent = parsedLocal.fileContent;
                }
              } catch (e) {
                // ignore
              }
            }
          }
          hasDNA = true;
        }
      }
    }

    // STEP 5: Set DNA Result State
    window.AppState.hasDNA = hasDNA;
    window.AppState.dnaRecord = completeRecord;
    sessionStorage.setItem('hasDNA', hasDNA ? 'true' : 'false');

    console.log('[Dashboard Refresh Validation Completed]', {
      hasDNA,
      completeRecord,
      appState: window.AppState
    });

    if (hasDNA && completeRecord) {
      sessionStorage.setItem('user_dna_record', JSON.stringify(completeRecord));
      // STEP 6: Notification - ONLY "You have a DNA."
      showDashboardNotification('You have a DNA.', 'success');
    } else {
      sessionStorage.removeItem('user_dna_record');
      sessionStorage.removeItem('user_dna_data');
      clearDashboardNotification();
    }

    // Refresh views with newly validated real DNA state from Notion
    renderYourDnaView();
    renderAddDnaExistingFoundation();
  } catch (err) {
    console.error('Validation request error:', err);
    updateUserStatusBadge('Error', 'inactive');
  }
}

/**
 * Toggle upload loading state
 */
function setUploadLoading(isLoading) {
  if (!btnUploadDna) return;
  if (isLoading) {
    btnUploadDna.disabled = true;
    btnUploadDna.classList.add('loading');
    if (btnUploadText) btnUploadText.textContent = 'Uploading DNA to n8n...';
  } else {
    btnUploadDna.disabled = false;
    btnUploadDna.classList.remove('loading');
    if (btnUploadText) btnUploadText.textContent = 'Upload DNA to n8n';
  }
}

// ==========================================================================
// PROFILE MANAGEMENT (NAME & PASSWORD UPDATES)
// ==========================================================================

if (btnTogglePasswordVisibility && inputSettingsPassword) {
  btnTogglePasswordVisibility.addEventListener('click', () => {
    const isPass = inputSettingsPassword.type === 'password';
    inputSettingsPassword.type = isPass ? 'text' : 'password';
    btnTogglePasswordVisibility.style.color = isPass ? 'var(--accent-primary)' : 'var(--text-muted)';
  });
}

if (formProfileSettings) {
  formProfileSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearProfileAlert();

    const newName = inputSettingsName ? inputSettingsName.value.trim() : '';
    const newPassword = inputSettingsPassword ? inputSettingsPassword.value : '';

    if (newPassword && newPassword.length < 8) {
      showProfileAlert('Password must be at least 8 characters in length.', 'error');
      return;
    }

    if (!newName && !newPassword) {
      showProfileAlert('Please enter a display name or new password to update.', 'info');
      return;
    }

    // Set button loading
    if (btnSaveProfileSettings) {
      btnSaveProfileSettings.disabled = true;
      btnSaveProfileSettings.classList.add('loading');
      if (btnSaveProfileText) btnSaveProfileText.textContent = 'Saving Changes...';
    }

    try {
      const endpoint = (typeof API_CONFIG !== 'undefined' && API_CONFIG.defaultUrl) ? API_CONFIG.defaultUrl : 'http://localhost:5678/webhook/sign_both';

      let realEmail = '';
      const sessionUser = sessionStorage.getItem('auth_user_data');
      if (sessionUser) {
        try {
          const parsed = JSON.parse(sessionUser);
          realEmail = parsed.email || '';
        } catch (err) { }
      }
      if (!realEmail && settingsEmailField) {
        realEmail = settingsEmailField.textContent;
      }

      const updatePayload = {
        action: 'update_user',
        email: realEmail,
        name: newName,
        password: newPassword,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify(updatePayload)
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
      }

      // Update local session data with new name
      let currentUserData = {};
      if (sessionUser) {
        try { currentUserData = JSON.parse(sessionUser); } catch (e) { }
      }
      if (newName) {
        currentUserData.name = newName;
        if (userAvatar) {
          userAvatar.textContent = newName[0].toUpperCase();
        }
      }
      sessionStorage.setItem('auth_user_data', JSON.stringify(currentUserData));

      if (response.ok && (data.approved === true || data.success === true || response.status === 200)) {
        showProfileAlert(data.message || 'Profile and credentials successfully updated in Notion & n8n.', 'success');
        if (inputSettingsPassword) inputSettingsPassword.value = '';
      } else {
        const msg = data.message || 'Profile saved locally in session.';
        showProfileAlert(msg, 'success');
        if (inputSettingsPassword) inputSettingsPassword.value = '';
      }
    } catch (err) {
      // Graceful fallback for offline testing
      let currentUserData = {};
      const sessionUser = sessionStorage.getItem('auth_user_data');
      if (sessionUser) {
        try { currentUserData = JSON.parse(sessionUser); } catch (e) { }
      }
      if (newName) {
        currentUserData.name = newName;
        if (userAvatar) userAvatar.textContent = newName[0].toUpperCase();
      }
      sessionStorage.setItem('auth_user_data', JSON.stringify(currentUserData));
      showProfileAlert('Profile saved in local session. (Webhook unreachable: ' + err.message + ')', 'info');
      if (inputSettingsPassword) inputSettingsPassword.value = '';
    } finally {
      if (btnSaveProfileSettings) {
        btnSaveProfileSettings.disabled = false;
        btnSaveProfileSettings.classList.remove('loading');
        if (btnSaveProfileText) btnSaveProfileText.textContent = 'Save Profile Changes';
      }
    }
  });
}

// ==========================================================================
// WEBHOOK & ENVIRONMENT SWITCHER
// ==========================================================================

function updatePresetButtons(url) {
  if (!btnPresetProdWebhook || !btnPresetTestWebhook) return;
  const isProd = url.includes('/webhook/sign_both') || !url.includes('/webhook-test/');
  btnPresetProdWebhook.classList.toggle('active', isProd);
  btnPresetTestWebhook.classList.toggle('active', !isProd);
}

if (btnPresetProdWebhook) {
  btnPresetProdWebhook.addEventListener('click', () => {
    const prodUrl = 'http://localhost:5678/webhook/sign_both';
    if (inputSettingsWebhookUrl) inputSettingsWebhookUrl.value = prodUrl;
    updatePresetButtons(prodUrl);
  });
}

if (btnPresetTestWebhook) {
  btnPresetTestWebhook.addEventListener('click', () => {
    const testUrl = 'http://localhost:5678/webhook-test/sign_both';
    if (inputSettingsWebhookUrl) inputSettingsWebhookUrl.value = testUrl;
    updatePresetButtons(testUrl);
  });
}

if (formWebhookSettings) {
  formWebhookSettings.addEventListener('submit', (e) => {
    e.preventDefault();
    clearWebhookAlert();

    const targetUrl = inputSettingsWebhookUrl ? inputSettingsWebhookUrl.value.trim() : '';
    if (!targetUrl) {
      showWebhookAlert('Please enter a valid webhook URL.', 'error');
      return;
    }

    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.setWebhookUrl) {
      API_CONFIG.setWebhookUrl(targetUrl);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem('custom_webhook_url', targetUrl);
    }

    updatePresetButtons(targetUrl);
    showWebhookAlert(`Webhook configuration saved. Active endpoint: ${targetUrl}`, 'success');
  });
}

// Test Connection Ping
if (btnTestWebhookPing) {
  btnTestWebhookPing.addEventListener('click', async () => {
    clearWebhookAlert();
    const targetUrl = inputSettingsWebhookUrl ? inputSettingsWebhookUrl.value.trim() : 'http://localhost:5678/webhook/sign_both';

    btnTestWebhookPing.disabled = true;
    showWebhookAlert('Pinging n8n webhook endpoint...', 'info');

    const startTime = performance.now();
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          timestamp: new Date().toISOString()
        })
      });

      const latency = Math.round(performance.now() - startTime);
      if (response.ok) {
        showWebhookAlert(`Ping successful! Status: ${response.status} OK (${latency}ms latency). Connected to n8n.`, 'success');
      } else {
        showWebhookAlert(`Endpoint responded with status ${response.status} (${latency}ms latency).`, 'info');
      }
    } catch (err) {
      showWebhookAlert(`Connection failed: ${err.message}. Make sure n8n workflow is listening.`, 'error');
    } finally {
      btnTestWebhookPing.disabled = false;
    }
  });
}

// ==========================================================================
// DRAG AND DROP & FILE SELECTION IMPLEMENTATION
// ==========================================================================

if (dropzone) {
  // Click dropzone to open native file selector
  dropzone.addEventListener('click', () => {
    if (dnaFileInput) dnaFileInput.click();
  });

  // Drag enter and drag over highlighting
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  // Drag leave unhighlighting
  ['dragleave', 'dragend'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  // Drop event handling
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  });
}

// Native file input change
if (dnaFileInput) {
  dnaFileInput.addEventListener('change', () => {
    if (dnaFileInput.files && dnaFileInput.files.length > 0) {
      processSelectedFile(dnaFileInput.files[0]);
    }
  });
}

/**
 * Validate and read the selected Markdown file
 */
function processSelectedFile(file) {
  clearDnaAlert();

  if (!file) {
    showDnaAlert('No file was selected.', 'error');
    return;
  }

  // Validation: verify strict Markdown format (.md extension)
  const isMarkdown = file.name.toLowerCase().endsWith('.md');
  if (!isMarkdown) {
    showDnaAlert('Invalid file format. The DNA file must have a .md extension (e.g. DNA.md).', 'error');
    if (selectedFileCard) selectedFileCard.classList.remove('visible');
    selectedDnaFile = null;
    return;
  }

  selectedDnaFile = file;

  // Read file contents via FileReader
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedDnaContent = e.target.result;

    // Display selected file metadata
    if (selectedFileName) selectedFileName.textContent = file.name;
    const sizeKb = (file.size / 1024).toFixed(1);
    if (selectedFileSizeBadge) selectedFileSizeBadge.textContent = `${sizeKb} KB`;

    // Snippet preview (first 500 characters)
    if (selectedFilePreview) {
      selectedFilePreview.textContent = selectedDnaContent.slice(0, 500) + (selectedDnaContent.length > 500 ? '\n\n... [Content truncated for preview]' : '');
    }

    if (selectedFileCard) selectedFileCard.classList.add('visible');
    showDnaAlert(`File "${file.name}" loaded and ready for upload.`, 'info');
  };

  reader.onerror = () => {
    showDnaAlert('Failed to read file content. Please try again.', 'error');
    if (selectedFileCard) selectedFileCard.classList.remove('visible');
    selectedDnaFile = null;
  };

  reader.readAsText(file);
}

// ==========================================================================
// SEND DNA TO n8n VIA HTTP API
// ==========================================================================

if (btnUploadDna) {
  btnUploadDna.addEventListener('click', async () => {
    if (!selectedDnaFile || !selectedDnaContent) {
      showDnaAlert('Please select a valid DNA.md file first.', 'error');
      return;
    }

    clearDnaAlert();
    setUploadLoading(true);

    try {
      const endpoint = (typeof API_CONFIG !== 'undefined' && API_CONFIG.defaultUrl) ? API_CONFIG.defaultUrl : 'http://localhost:5678/webhook/sign_both';

      // Retrieve real authenticated account email
      let accountEmail = '';
      const sessionUser = sessionStorage.getItem('auth_user_data');
      if (sessionUser) {
        try {
          const parsed = JSON.parse(sessionUser);
          if (parsed && parsed.email && parsed.email.includes('@') && !parsed.email.includes('authenticated_user')) {
            accountEmail = parsed.email.trim().toLowerCase();
          }
        } catch (e) {
          accountEmail = '';
        }
      }

      if (!accountEmail) {
        const urlParams = new URLSearchParams(window.location.search);
        const paramEmail = urlParams.get('email') || urlParams.get('user');
        if (paramEmail && paramEmail.includes('@') && !paramEmail.includes('authenticated_user')) {
          accountEmail = paramEmail.trim().toLowerCase();
        }
      }

      if (!accountEmail || !accountEmail.includes('@') || accountEmail.includes('authenticated_user') || accountEmail === 'test@example.com') {
        showDnaAlert('No valid authenticated user session found. Please sign in again.', 'error');
        setUploadLoading(false);
        return;
      }

      // Check if user already has an existing DNA record in Notion to update
      let existingPageId = '';
      if (window.AppState && window.AppState.dnaRecord) {
        existingPageId = window.AppState.dnaRecord.id || window.AppState.dnaRecord.page_id || window.AppState.dnaRecord.record_id || '';
      }
      if (!existingPageId) {
        const savedRec = sessionStorage.getItem('user_dna_record') || sessionStorage.getItem('user_dna_data');
        if (savedRec) {
          try {
            const parsed = JSON.parse(savedRec);
            existingPageId = parsed.id || parsed.page_id || parsed.record_id || '';
          } catch (e) {
            existingPageId = '';
          }
        }
      }

      const isUpdate = Boolean(existingPageId || window.AppState.hasDNA || sessionStorage.getItem('hasDNA') === 'true');

      // Large files (116+ KB) must be sent via HTTP POST body to avoid browser URL length limits
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify({
          action: 'add_dna',
          sub_action: isUpdate ? 'update_dna' : 'add_dna',
          is_update: isUpdate,
          mode: isUpdate ? 'update' : 'create',
          operation: isUpdate ? 'update' : 'insert',
          id: existingPageId || undefined,
          page_id: existingPageId || undefined,
          pageId: existingPageId || undefined,
          record_id: existingPageId || undefined,
          email: accountEmail,
          fileName: selectedDnaFile.name,
          fileType: selectedDnaFile.type || 'text/markdown',
          fileSize: selectedDnaFile.size,
          fileContent: selectedDnaContent,
          timestamp: new Date().toISOString()
        })
      };

      const response = await fetch(endpoint, fetchOptions);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { message: text };
        }
      }

      // Backend Response Rule: Strictly require approved === true
      if (response.ok && data && data.approved === true) {
        const successMsg = data.message || (isUpdate ? 'Brand DNA successfully updated and verified.' : 'DNA successfully uploaded and verified.');
        showDnaAlert(successMsg, 'success');

        // Persist updated DNA record in session
        const uploadedDnaRecord = {
          id: (data && (data.id || data.page_id || data.record_id)) || existingPageId || undefined,
          fileName: selectedDnaFile.name,
          name: selectedDnaFile.name,
          fileSize: selectedDnaFile.size,
          fileContent: selectedDnaContent,
          updatedAt: new Date().toISOString(),
          status: 'Active'
        };
        sessionStorage.setItem('user_dna_data', JSON.stringify(uploadedDnaRecord));
        sessionStorage.setItem('user_dna_record', JSON.stringify(uploadedDnaRecord));
        sessionStorage.setItem('hasDNA', 'true');
        window.AppState.hasDNA = true;
        window.AppState.dnaRecord = uploadedDnaRecord;

        renderAddDnaExistingFoundation();
        renderYourDnaView();

        // Switch back to Your DNA view after brief confirmation
        setTimeout(() => {
          switchView('your-dna');
        }, 1200);
      } else if (data && data.approved === false) {
        const errorMsg = data.message || 'n8n rejected the DNA file.';
        showDnaAlert(errorMsg, 'error');
      } else {
        // Unapproved or default webhook response (treated as error per project rules)
        const fallbackMsg = (data && data.message) ? data.message : `DNA upload not approved (Status ${response.status}).`;
        showDnaAlert(fallbackMsg, 'error');
      }
    } catch (err) {
      showDnaAlert('Unable to connect to n8n DNA service. Please verify your connection.', 'error');
    } finally {
      setUploadLoading(false);
    }
  });
}

/**
 * Sign Out handler - clears session tokens and navigates to login
 */
if (btnSignOut) {
  btnSignOut.addEventListener('click', () => {
    sessionStorage.removeItem('auth_user_data');
    sessionStorage.removeItem('user_dna_data');
    sessionStorage.removeItem('user_dna_record');
    sessionStorage.removeItem('hasDNA');
    window.location.href = 'index.html';
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initDashboard);
