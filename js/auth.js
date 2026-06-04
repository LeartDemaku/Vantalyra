const API_URL = '/api';

const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const resetForm = document.getElementById('reset-form');
const authMessage = document.getElementById('auth-message');
const verificationGroup = document.getElementById('verification-code-group');
const verificationCodeInput = document.getElementById('verification-code');
const loginButton = document.getElementById('login-button');
const loginHelperText = document.getElementById('login-helper-text');

let pendingVerificationToken = null;
let pendingVerificationEmail = null;
let pendingResetToken = null;
let pendingResetEmail = null;

function showMessage(msg, isError = false) {
    if (!authMessage) return;
    authMessage.textContent = msg;
    authMessage.className = isError ? 'error' : 'success';
}

function setLoginVerificationStep(enabled) {
    if (verificationGroup) verificationGroup.style.display = enabled ? 'block' : 'none';
    if (verificationCodeInput) verificationCodeInput.required = enabled;
    if (loginButton) loginButton.textContent = enabled ? 'Verifiko Kodin' : 'Hyr në Llogari';

    if (loginHelperText) {
        loginHelperText.textContent = enabled
            ? 'Kontrolloni email-in tuaj dhe shkruani kodin 6-shifror të verifikimit.'
            : '';
    }
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('fullname').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName, email, password })
            });
            const data = await response.json();

            if (response.ok) {
                showMessage(data.message, false);
                setTimeout(() => window.location.href = 'login.html', 1500);
            } else {
                showMessage(data.error, true);
            }
        } catch (error) {
            showMessage('Ndodhi një gabim në server.', true);
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            if (pendingVerificationToken) {
                const code = verificationCodeInput.value.trim();

                if (!code) {
                    showMessage('Shkruani kodin e verifikimit.', true);
                    return;
                }

                const response = await fetch(`${API_URL}/verify-login-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: pendingVerificationEmail,
                        code,
                        verificationToken: pendingVerificationToken
                    })
                });
                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('fullName', data.name);
                    pendingVerificationToken = null;
                    pendingVerificationEmail = null;
                    showMessage('Kyçja u krye me sukses! Duke ju ridrejtuar...', false);
                    setTimeout(() => window.location.href = 'dashboard.html', 1000);
                } else {
                    showMessage(data.error, true);
                }
            } else {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();

                if (response.ok && data.requiresVerification) {
                    pendingVerificationToken = data.verificationToken;
                    pendingVerificationEmail = data.email;
                    setLoginVerificationStep(true);
                    showMessage(data.message, false);
                    verificationCodeInput.focus();
                } else if (!response.ok) {
                    showMessage(data.error, true);
                }
            }
        } catch (error) {
            showMessage('Ndodhi një gabim në server.', true);
        }
    });
}

if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email');
        const resetCodeInput = document.getElementById('reset-code');
        const newPasswordInput = document.getElementById('new-password');
        const resetCodeGroup = document.getElementById('reset-code-group');
        const newPasswordGroup = document.getElementById('new-password-group');
        const resetBtn = document.getElementById('reset-button');

        const email = emailInput.value.trim();

        if (!pendingResetToken) {
            try {
                const response = await fetch(`${API_URL}/request-reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();

                if (response.ok) {
                    pendingResetToken = data.resetToken;
                    pendingResetEmail = data.email;
                    emailInput.disabled = true;
                    if (resetCodeGroup) resetCodeGroup.style.display = 'block';
                    if (newPasswordGroup) newPasswordGroup.style.display = 'block';
                    if (resetCodeInput) resetCodeInput.required = true;
                    if (newPasswordInput) newPasswordInput.required = true;
                    if (resetBtn) resetBtn.textContent = 'Ndrysho Fjalëkalimin';
                    if (resetCodeInput) resetCodeInput.focus();
                    showMessage(data.message, false);
                } else {
                    showMessage(data.error, true);
                }
            } catch (error) {
                showMessage('Ndodhi një gabim gjatë procesit.', true);
            }
        } else {
            const code = resetCodeInput.value.trim();
            const newPassword = newPasswordInput.value;

            if (newPassword.length < 6) {
                showMessage('Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere.', true);
                return;
            }

            try {
                const response = await fetch(`${API_URL}/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: pendingResetEmail,
                        code,
                        resetToken: pendingResetToken,
                        newPassword
                    })
                });
                const data = await response.json();

                if (response.ok) {
                    showMessage(data.message, false);
                    setTimeout(() => window.location.href = 'login.html', 2000);
                } else {
                    showMessage(data.error, true);
                }
            } catch (error) {
                showMessage('Ndodhi një gabim gjatë procesit.', true);
            }
        }
    });
}


function updateNavigation() {
    const token = localStorage.getItem('token');
    const fullName = localStorage.getItem('fullName');
    const navLinks = document.getElementById('lidhjet-navigimit');

    if (!navLinks) return;

    if (token && fullName) {

        navLinks.innerHTML = `
            <a href="index.html" class="lidhja-kthyese">Ballina</a>
            <a href="about.html" class="lidhja-kthyese">Rreth Nesh</a>
            <a href="index.html#sherbimet" class="lidhja-kthyese">Shërbimet</a>
            <a href="index.html#si-funksionon" class="lidhja-kthyese">Si Funksionon</a>
            <a href="contact.html" class="lidhja-kthyese">Kontakti</a>
            
            <div class="user-profile-container">
                <div class="user-profile-menu">
                    <div class="user-avatar">${fullName.charAt(0).toUpperCase()}</div>
                    <div class="user-name">
                        ${fullName}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
                
                <div class="user-dropdown-content">
                    <a href="dashboard.html" class="dropdown-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        Profili
                    </a>
                    <a href="#" id="logout-btn" class="dropdown-item logout-action">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Dil nga llogaria
                    </a>
                </div>
            </div>
        `;

        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('fullName');
            window.location.href = 'index.html';
        });
    } else {


        if (window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'login.html';
        }

        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html') && !window.location.pathname.includes('forgot-password.html')) {
            navLinks.innerHTML = `
                <a href="index.html" class="lidhja-kthyese">Ballina</a>
                <a href="about.html" class="lidhja-kthyese">Rreth Nesh</a>
                <a href="index.html#sherbimet" class="lidhja-kthyese">Shërbimet</a>
                <a href="index.html#si-funksionon" class="lidhja-kthyese">Si Funksionon</a>
                <a href="contact.html" class="lidhja-kthyese">Kontakti</a>
                <a href="login.html" class="butoni-kycje">Kyçu</a>
            `;
        } else if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html') || window.location.pathname.includes('forgot-password.html')) {
            navLinks.innerHTML = `
                <a href="index.html" class="lidhja-kthyese">Ballina</a>
                <a href="about.html" class="lidhja-kthyese">Rreth Nesh</a>
                <a href="index.html#sherbimet" class="lidhja-kthyese">Shërbimet</a>
                <a href="index.html#si-funksionon" class="lidhja-kthyese">Si Funksionon</a>
                <a href="contact.html" class="lidhja-kthyese">Kontakti</a>
                <a href="login.html" class="butoni-kycje">Kyçu</a>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', updateNavigation);
document.addEventListener('DOMContentLoaded', () => setLoginVerificationStep(false));










const supabaseUrl = 'https://xzknbsdensrhdraxajkj.supabase.co';
const supabaseKey = 'sb_publishable_aUbVz6zuFEI2BRUwd9Sfqg_CNsdaXDV';

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function loginUser(email, password) {
    // Kjo rresht na ndihmon të shohim nëse kodi po ekzekutohet
    console.log("Duke provuar login për:", email);

    const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error("Gabimi:", error.message);
        alert("Gabim nga Supabase: " + error.message);
    } else {
        alert("Hyrja u krye me sukses!");
        window.location.href = "dashboard.html";
    }
}