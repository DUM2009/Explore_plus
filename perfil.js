import { auth } from "./firebase.js";
import {
    deleteUser,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const nomeAluno = document.getElementById("nomeAluno");
const emailAluno = document.getElementById("emailAluno");
const nivelAluno = document.getElementById("nivelAluno");
const xpAluno = document.getElementById("xpAluno");
const xpProgressBar = document.getElementById("xpProgressBar");
const xpNextLevelText = document.getElementById("xpNextLevelText");
const achievementsGrid = document.getElementById("achievementsGrid");
const profileRank = document.getElementById("profileRank");
const currentSubject = document.getElementById("currentSubject");
const remainingUnlocks = document.getElementById("remainingUnlocks");
const profileImage = document.getElementById("profileImage");
const profileAvatarFallback = document.getElementById("profileAvatarFallback");
const logoutBtn = document.getElementById("logoutBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const sidebar = document.getElementById("profileSidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const PROFILE_MISSIONS = Object.freeze([
    { id: "photosynthesis", fallbackSectionCount: 3 },
    { id: "mitosis", fallbackSectionCount: 0 },
    { id: "meiosis", fallbackSectionCount: 0 }
]);

function getNickname(user) {
    const displayName = String(user?.displayName || '').trim();

    if (displayName) {
        return displayName;
    }

    if (user?.email) {
        return user.email.split("@")[0];
    }

    return "Aluno";
}

function updateCurrentUserState(user) {
    window.exploreCurrentUser = user ? {
        uid: user.uid || null,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null
    } : null;
}

function renderProfilePhoto(user, nickname) {
    if (!profileImage || !profileAvatarFallback) {
        return;
    }

    const fallbackText = nickname.charAt(0).toUpperCase() || '👤';
    profileAvatarFallback.textContent = fallbackText;

    if (user?.photoURL) {
        profileImage.src = user.photoURL;
        profileImage.hidden = false;
        profileAvatarFallback.hidden = true;
        return;
    }

    profileImage.hidden = true;
    profileAvatarFallback.hidden = false;
}

function renderAchievements(overview) {
    if (!achievementsGrid) {
        return;
    }

    achievementsGrid.innerHTML = overview.badges.map((badge) => `
        <article class="achievement-card ${badge.unlocked ? 'is-unlocked' : 'is-locked'}" aria-label="${badge.name} ${badge.unlocked ? 'desbloqueado' : 'bloqueado'}">
            <div class="achievement-badge-art">
                <img src="${badge.icon}" alt="Emblema ${badge.name} ${badge.tone} com ilustração temática">
            </div>
            <div class="achievement-copy">
                <h3>${badge.name}</h3>
                <p>${badge.tone}</p>
                <span class="achievement-status">${badge.unlocked ? 'Desbloqueado' : 'Bloqueado'}</span>
            </div>
        </article>
    `).join('');
}

function renderRemainingUnlocks(items) {
    if (!remainingUnlocks) {
        return;
    }

    if (!items.length) {
        remainingUnlocks.innerHTML = '<li>Tudo desbloqueado. Excelente trabalho!</li>';
        return;
    }

    remainingUnlocks.innerHTML = items.map((item) => `
        <li>
            <strong>${item.label}</strong>
            <span>${item.description}</span>
        </li>
    `).join('');
}

function getMissionProgressStorageKey(user, missionId) {
    const userKey = user?.uid
        ? `uid:${user.uid}`
        : (user?.email ? `email:${String(user.email).toLowerCase()}` : "guest");

    return `mission_${userKey}_${missionId}`;
}

function getMissionProgressPercent(user, mission) {
    const rawProgress = localStorage.getItem(getMissionProgressStorageKey(user, mission.id));

    if (!rawProgress) {
        return 0;
    }

    try {
        const progress = JSON.parse(rawProgress);
        const totalSections = Number(progress.totalSections) || mission.fallbackSectionCount;
        const completedSections = new Set(Array.isArray(progress.completedSections)
            ? progress.completedSections
            : []);

        if (!totalSections) {
            return 0;
        }

        return Math.round(Math.min(completedSections.size / totalSections, 1) * 100);
    } catch {
        return 0;
    }
}

function renderMissionProgress(user) {
    PROFILE_MISSIONS.forEach((mission) => {
        const percent = getMissionProgressPercent(user, mission);
        const value = document.querySelector(`[data-mission-progress-value="${mission.id}"]`);
        const bar = document.querySelector(`[data-mission-progress-bar="${mission.id}"]`);

        if (value) {
            value.textContent = `${percent}%`;
        }

        if (bar) {
            bar.style.width = `${percent}%`;
        }
    });
}

function renderProfileXP(user) {
    if (!window.ProfileXP || !nivelAluno || !xpAluno || !xpProgressBar) {
        return;
    }

    const profile = window.ProfileXP.readProfile(localStorage, user);
    const overview = window.ProfileXP.getProfileOverview(profile);
    const nickname = getNickname(user);

    if (nomeAluno) {
        nomeAluno.textContent = `Olá, ${overview.rank}`;
    }
    if (emailAluno) {
        emailAluno.textContent = user?.email || 'Sem email disponível';
    }
    if (profileRank) {
        profileRank.textContent = overview.rank;
    }
    if (currentSubject) {
        currentSubject.textContent = overview.currentSubject;
    }

    nivelAluno.textContent = `Nível ${overview.stats.level}`;
    xpAluno.textContent = `${overview.stats.xp} XP`;
    xpProgressBar.style.width = `${overview.stats.progressPercent}%`;
    if (xpNextLevelText) {
        xpNextLevelText.textContent = `Próximo nível aos ${overview.stats.nextLevelThreshold} XP`;
    }

    renderProfilePhoto(user, nickname);
    renderAchievements(overview);
    renderRemainingUnlocks(overview.remainingUnlockables);
    renderMissionProgress(user);
}

function setSidebarState(isOpen) {
    if (!sidebar || !sidebarToggle || !sidebarOverlay) {
        return;
    }

    sidebar.classList.toggle('is-open', isOpen);
    sidebar.setAttribute('aria-hidden', String(!isOpen));
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    sidebarOverlay.hidden = !isOpen;
    document.body.classList.toggle('sidebar-open', isOpen);
}

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        setSidebarState(!sidebar.classList.contains('is-open'));
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        setSidebarState(false);
    });
}

if (sidebar) {
    sidebar.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setSidebarState(false));
    });
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        setSidebarState(false);
    }
});

onAuthStateChanged(auth, (user) => {
    updateCurrentUserState(user);

    if (user) {
        renderProfileXP(user);
    } else {
        window.location.href = "login.html";
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth)
            .then(() => {
                updateCurrentUserState(null);
                window.location.href = "index.html";
            })
            .catch((erro) => {
                alert("Erro ao terminar sessão: " + erro.message);
            });
    });
}

if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', () => {
        if (!auth.currentUser) {
            return;
        }

        const confirmed = window.confirm(
            'Queres mesmo eliminar esta conta? Esta ação é permanente.'
        );

        if (!confirmed) {
            return;
        }

        const user = auth.currentUser;
        deleteUser(user)
            .then(() => {
                updateCurrentUserState(null);
                window.alert('Conta eliminada com sucesso.');
                window.location.href = 'signup.html';
            })
            .catch((erro) => {
                if (erro?.code === 'auth/requires-recent-login') {
                    window.alert('Por segurança, termina sessão e volta a entrar antes de eliminares a conta.');
                    return;
                }

                window.alert('Erro ao eliminar conta: ' + erro.message);
            });
    });
}

window.addEventListener('storage', () => {
    if (auth.currentUser) {
        renderProfileXP(auth.currentUser);
    }
});

window.addEventListener('explore:profile-updated', () => {
    if (auth.currentUser) {
        renderProfileXP(auth.currentUser);
    }
});

window.addEventListener('explore:mission-progress-updated', () => {
    if (auth.currentUser) {
        renderMissionProgress(auth.currentUser);
    }
});
