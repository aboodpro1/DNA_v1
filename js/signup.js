/**
 * Sign Up Form Handler
 *
 * Handles client-side form validation, manages loading states,
 * dispatches HTTP requests (GET query parameters or POST JSON)
 * to the n8n registration webhook, strictly validates backend CREATE approval,
 * and redirects to dashboard upon confirmed account creation.
 *
 * Route:    /signup.html
 * Trigger:  Form submission event
 * Auth:     n8n Sign-Up Webhook Endpoint
 */

const signUpForm = document.getElementById('signUpForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const alertBox = document.getElementById('alertBox');

/**
 * Display alert messages with appropriate visual styling
 */
function showAlert(message, type = 'info') {
  alertBox.className = `alert-box alert-${type} visible`;
  alertBox.textContent = message;
}

/**
 * Clear any active alert message
 */
function clearAlert() {
  alertBox.className = 'alert-box';
  alertBox.textContent = '';
}

/**
 * Toggle form loading state during asynchronous requests
 */
function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    btnText.textContent = 'Creating account...';
    emailInput.disabled = true;
    passwordInput.disabled = true;
    confirmPasswordInput.disabled = true;
  } else {
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    btnText.textContent = 'Create Account';
    emailInput.disabled = false;
    passwordInput.disabled = false;
    confirmPasswordInput.disabled = false;
  }
}

/**
 * Validate email format with standard regex
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Handle Sign Up form submission
 */
async function handleSignUp(e) {
  e.preventDefault();
  clearAlert();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Basic client-side validation
  if (!email) {
    showAlert('Please enter your email address.', 'error');
    emailInput.focus();
    return;
  }

  if (!isValidEmail(email)) {
    showAlert('Please enter a valid email address.', 'error');
    emailInput.focus();
    return;
  }

  if (!password) {
    showAlert('Please enter a password.', 'error');
    passwordInput.focus();
    return;
  }

  if (password.length < 8) {
    showAlert('Password must be at least 8 characters long.', 'error');
    passwordInput.focus();
    return;
  }

  if (password !== confirmPassword) {
    showAlert('Passwords do not match. Please re-enter your password.', 'error');
    confirmPasswordInput.focus();
    return;
  }

  // Set loading state and wait for real n8n response
  setLoading(true);

    const signupPayload = {
      action: 'signup',
      email: email,
      password: password,
      timestamp: new Date().toISOString()
    };

    let requestUrl = '/api/webhook';
    let fetchOptions = { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' } };

    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.buildRequest) {
      const built = API_CONFIG.buildRequest(signupPayload, null, 'GET');
      requestUrl = built.url;
      fetchOptions = built.options;
    } else {
      const params = new URLSearchParams(signupPayload);
      requestUrl = `/api/webhook?${params.toString()}`;
    }

    const response = await fetch(requestUrl, fetchOptions);

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        data = { message: text };
      }
    }

    // Normalize response if n8n returned an array of items [ { ... } ]
    const result = Array.isArray(data) ? (data[0] || {}) : (data || {});

    // Backend is the single source of truth: strictly require approved === true or success === true
    const isApproved = response.ok && (result.approved === true || result.success === true) && result.approved !== false && result.available !== 'no account';

    if (isApproved) {
      // Store returned backend verified user data into session state
      const verifiedUserId = result.user_id || result.userId || (result.user && result.user.user_id) || (result.data && result.data.user_id) || '';
      const verifiedEmail = result.email || (result.user && result.user.email) || email;
      const verifiedName = result.name || (result.user && result.user.name) || '';
      const userPayload = {
        email: verifiedEmail.trim().toLowerCase(),
        user_id: verifiedUserId,
        name: verifiedName
      };
      sessionStorage.setItem('auth_user_data', JSON.stringify(userPayload));

      const successMsg = result.message || 'Account verified and created successfully. Redirecting to dashboard...';
      showAlert(successMsg, 'success');
      signUpForm.reset();

      // Navigate to dashboard
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } else if (result && (result.approved === false || result.available === 'no account')) {
      const errorMsg = result.message || 'Account creation rejected by backend.';
      showAlert(errorMsg, 'error');
    } else {
      // Malformed or unapproved response
      const fallbackMsg = (result && result.message) ? result.message : `Account creation failed (Status ${response.status}).`;
      showAlert(fallbackMsg, 'error');
    }
  } catch (err) {
    // Network or server unreachable error
    showAlert('Unable to connect to the authentication service. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
}

// Bind submission event
signUpForm.addEventListener('submit', handleSignUp);
