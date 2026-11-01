const form = document.querySelector('#login-form');
const password = document.querySelector('#password');
const errorText = document.querySelector('#login-error');
const pairing = document.querySelector('#pairing');
const statusBox = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const qr = document.querySelector('#qr');
const placeholder = document.querySelector('#placeholder');
const logoutButton = document.querySelector('#logout');
let pollTimer;

function lockPage() {
  clearInterval(pollTimer);
  form.hidden = false;
  pairing.hidden = true;
  qr.removeAttribute('src');
  qr.hidden = true;
  placeholder.hidden = false;
  password.value = '';
}

function showPage() {
  form.hidden = true;
  pairing.hidden = false;
}

async function refreshStatus() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 401) {
      lockPage();
      return false;
    }
    if (!response.ok) throw new Error('status unavailable');
    const state = await response.json();
    showPage();
    statusBox.dataset.state = state.status;
    statusText.textContent = state.message;
    if (state.qrDataUrl) {
      qr.src = state.qrDataUrl;
      qr.hidden = false;
      placeholder.hidden = true;
    } else {
      qr.removeAttribute('src');
      qr.hidden = true;
      placeholder.hidden = false;
      placeholder.textContent = state.status === 'connected'
        ? 'WhatsApp is linked. You can close this page.'
        : 'Waiting for the QR code from WhatsApp…';
    }
    return true;
  } catch {
    statusBox.dataset.state = 'waiting';
    statusText.textContent = 'Cannot reach the pairing service';
    return false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorText.textContent = '';
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password.value })
    });
    password.value = '';
    if (!response.ok) {
      errorText.textContent = response.status === 401 ? 'That password did not work.' : 'Pairing page is not configured yet.';
      return;
    }
    if (await refreshStatus()) pollTimer = setInterval(refreshStatus, 1200);
  } catch {
    errorText.textContent = 'Could not reach the pairing service. Try again.';
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  } finally {
    lockPage();
  }
});

refreshStatus().then((authenticated) => {
  if (authenticated) pollTimer = setInterval(refreshStatus, 1200);
});
