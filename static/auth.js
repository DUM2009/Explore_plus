import { auth } from "./firebase.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

function updateCurrentUser(user) {
    if (user) {
        window.exploreCurrentUser = {
            uid: user.uid || null,
            email: user.email || null
        };
    } else {
        window.exploreCurrentUser = null;
    }

    window.dispatchEvent(new CustomEvent('explore:auth-changed', {
        detail: window.exploreCurrentUser
    }));
}

// Check authentication state on all pages
onAuthStateChanged(auth, (user) => {
    updateCurrentUser(user);
    const header = document.querySelector('header');
    if (!header) return;
    
    const nav = header.querySelector('nav');
    if (!nav) return;

    // Remove existing auth-injected items before re-adding them
    nav.querySelectorAll('.auth-nav-item').forEach((item) => item.remove());

    if (user) {
        // User is logged in - show profile and logout
        const profileLink = document.createElement('a');
        profileLink.href = 'perfil.html';
        profileLink.textContent = 'Perfil';
        profileLink.className = 'auth-nav-item';

        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'headerLogout';
        logoutBtn.textContent = 'Sair';
        logoutBtn.className = 'auth-nav-item';
        logoutBtn.dataset.tabVariant = 'danger';

        logoutBtn.addEventListener('click', () => {
            signOut(auth)
                .then(() => {
                    window.location.href = 'index.html';
                })
                .catch((erro) => {
                    alert('Erro ao sair: ' + erro.message);
                });
        });
        
        nav.appendChild(profileLink);
        nav.appendChild(logoutBtn);
    } else {
        // User is not logged in - show login button
        const loginBtn = document.createElement('a');
        loginBtn.href = '/login/';
        loginBtn.textContent = 'Entrar';
        loginBtn.className = 'auth-nav-item';
        nav.appendChild(loginBtn);
    }
});

export { auth };