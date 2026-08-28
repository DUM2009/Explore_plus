const themeToggleBtn = document.getElementById('themeToggleBtn');
const notificationsBtn = document.getElementById('notificationsBtn');
const notificationsPanel = document.getElementById('notificationsPanel');
const accountTrigger = document.getElementById('profileAccountTrigger');
const accountMenu = document.getElementById('profileAccountMenu');
const sidebar = document.getElementById('profileSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');
const biologyAverageProgress = document.getElementById('biologyAverageProgress');
const biologyMissionsDone = document.getElementById('biologyMissionsDone');
const xpAluno = document.getElementById('xpAluno');
const nivelAluno = document.getElementById('nivelAluno');
const xpProgressBar = document.getElementById('xpProgressBar');
const xpNextLevelText = document.getElementById('xpNextLevelText');
const summaryXP = document.getElementById('summaryXP');
const recentActivityList = document.getElementById('recentActivityList');
const profileStreakCount = document.getElementById('profileStreakCount');

function escapeActivityText(value) {
    return String(value || '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[character]));
}

function getActivityMissionName(source) {
    const normalizedSource = String(source || '').toLowerCase();
    const missionNames = {
        'introducao': 'Introdução',
        'componentes-da-planta': 'Componentes da planta',
        'fase-clara': 'Fase clara',
        'fase-escura': 'Fase escura (ciclo de Calvin)',
        'importancia': 'Importância da fotossíntese',
        'desafio-final': 'Desafio final',
        'luz-vira-energia': 'Definição e estruturas da fotossíntese',
        'do-ar-ao-açúcar': 'Fase clara',
        'liga-os-pontos': 'Fase escura (ciclo de Calvin)'
    };

    const missionId = Object.keys(missionNames).find((id) => normalizedSource.includes(id));
    if (missionId) return missionNames[missionId];
    if (normalizedSource === 'mission:photosynthesis') return 'uma missão do capítulo Fotossíntese';
    if (normalizedSource.includes('photosynthesis')) return 'Fotossíntese';
    if (normalizedSource.includes('mitosis')) return 'Mitose';
    if (normalizedSource.includes('meiosis')) return 'Meiose';
    if (normalizedSource.includes('dna')) return 'DNA';
    return 'uma missão';
}

function formatActivityAge(createdAt) {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return 'Agora';

    const elapsedDays = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
    if (elapsedDays <= 0) return 'Há menos de 1 dia';
    return `Há ${elapsedDays} ${elapsedDays === 1 ? 'dia' : 'dias'}`;
}

function getStoredMissionActivities() {
    return ['photosynthesis', 'mitosis', 'meiosis'].map((missionId) => {
        const keys = [
            `mission_uid:django-${window.exploreUserId}_${missionId}`,
            `mission_email:${String(window.exploreUserEmail || '').toLowerCase()}_${missionId}`
        ];
        const raw = keys.map((key) => localStorage.getItem(key)).find(Boolean);
        if (!raw) return null;

        try {
            const snapshot = JSON.parse(raw);
            const xp = Math.max(0, Number(snapshot.earnedXP) || 0);
            if (xp <= 0) return null;

            const sectionNames = {
                'introducao': 'Introdução',
                'componentes-da-planta': 'Componentes da planta',
                'fase-clara': 'Fase clara',
                'fase-escura': 'Fase escura (ciclo de Calvin)',
                'importancia': 'Importância da fotossíntese',
                'desafio-final': 'Desafio final',
                'luz-vira-energia': 'Definição e estruturas da fotossíntese',
                'do-ar-ao-açúcar': 'Fase clara',
                'liga-os-pontos': 'Fase escura (ciclo de Calvin)'
            };
            const completedSections = Array.isArray(snapshot.completedSections)
                ? snapshot.completedSections
                : [];
            const sectionActivities = completedSections
                .filter((sectionId) => sectionNames[sectionId])
                .map((sectionId) => ({
                    source: `quiz:${missionId}:${sectionId}`,
                    type: 'quiz',
                    percentage: null,
                    xp: Math.round(xp / completedSections.length),
                    createdAt: snapshot.updatedAt || snapshot.savedAt || Date.now()
                }));

            return sectionActivities.length > 0 ? sectionActivities : [{
                source: `mission:${missionId}`,
                xp,
                createdAt: snapshot.updatedAt || snapshot.savedAt || Date.now()
            }];
        } catch {
            return null;
        }
    }).filter(Boolean);
}

function renderRecentActivity(profile) {
    if (!recentActivityList) return;

    let activities = Array.isArray(profile?.activities) ? profile.activities.slice().reverse() : [];
    activities = activities.filter((activity) => String(activity.source || '').toLowerCase() !== 'mission:photosynthesis');
    if (!activities.length) {
        activities = getStoredMissionActivities();
    }
    if (!activities.length) {
        recentActivityList.innerHTML = '<p class="profile-empty-activity">Ainda não existem atividades registadas.</p>';
        return;
    }

    const rows = activities.slice(0, 5).map((activity) => {
        const missionName = getActivityMissionName(activity.source);
        const normalizedSource = String(activity.source || '').toLowerCase();
        const isQuiz = activity.type === 'quiz' || normalizedSource.includes('quiz') || normalizedSource.includes('challenge');
        const percentage = Number.isFinite(Number(activity.percentage))
            ? ` - ${Math.round(Number(activity.percentage))}%`
            : '';
        const activityLabel = isQuiz
            ? `Quiz "${missionName}"${percentage}`
            : `Concluíste a missão "${missionName}"`;
        const xp = Math.max(0, Number(activity.xp) || 0);
        return `
            <tr class="profile-activity-row">
                <td class="profile-activity-status-cell"><span class="profile-activity-status ${isQuiz ? 'is-quiz' : ''}">${isQuiz ? '★' : '✓'}</span></td>
                <td class="profile-activity-copy">
                    <strong>${escapeActivityText(activityLabel)}</strong>
                </td>
                <td class="profile-activity-xp">+${xp} XP</td>
                <td class="profile-activity-time">${escapeActivityText(formatActivityAge(activity.createdAt))}</td>
            </tr>
        `;
    }).join('');

    recentActivityList.innerHTML = `
        <div class="profile-activity-table-wrapper">
            <table class="profile-activity-table">
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function getStoredProfile() {
    const keys = [
        `explore_profile_uid:django-${window.exploreUserId}`,
        `explore_profile_email:${String(window.exploreUserEmail || '').toLowerCase()}`
    ];

    for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
            return JSON.parse(raw);
        } catch {
            continue;
        }
    }

    const userMarkers = [`django-${window.exploreUserId}`, String(window.exploreUserEmail || '').toLowerCase()];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (!key.startsWith('explore_profile_') || !userMarkers.some((marker) => marker && key.toLowerCase().includes(marker))) continue;
        try {
            const profile = JSON.parse(localStorage.getItem(key));
            if (profile && Number(profile.xp) > 0) return profile;
        } catch {
            continue;
        }
    }

    const missionIds = ['photosynthesis', 'mitosis', 'meiosis'];
    const legacyProfile = { xp: 0 };

    missionIds.forEach((missionId) => {
        const keys = [
            `mission_uid:django-${window.exploreUserId}_${missionId}`,
            `mission_email:${String(window.exploreUserEmail || '').toLowerCase()}_${missionId}`
        ];
        const rawMission = keys.map((key) => localStorage.getItem(key)).find(Boolean);
        if (!rawMission) return;

        try {
            legacyProfile.xp += Math.max(0, Number(JSON.parse(rawMission).earnedXP) || 0);
        } catch {
            return;
        }
    });

    return legacyProfile.xp > 0 ? legacyProfile : null;
}

const storedProfile = getStoredProfile();
renderRecentActivity(storedProfile || {});
if (storedProfile) {
    const xp = Math.max(0, Number(storedProfile.xp) || 0);
    const level = Math.floor(xp / 100);
    const progressPercent = xp % 100;
    if (xpAluno) xpAluno.textContent = `${xp} XP`;
    if (summaryXP) summaryXP.textContent = `${xp} XP`;
    if (nivelAluno) nivelAluno.textContent = `Nível ${level}`;
    if (xpProgressBar) xpProgressBar.style.width = `${progressPercent}%`;
    if (xpNextLevelText) xpNextLevelText.textContent = `Próximo nível aos ${(level + 1) * 100} XP`;

    const streakDays = Math.max(0, Number(storedProfile.streak?.current) || 0);
    if (profileStreakCount) profileStreakCount.textContent = streakDays;
}

function getMissionProgressPercent(missionId) {
    const keys = [
        `mission_uid:django-${window.exploreUserId}_${missionId}`,
        `mission_email:${String(window.exploreUserEmail || '').toLowerCase()}_${missionId}`
    ];

    let raw = keys.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) {
        const marker = `_${missionId}`;
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index) || '';
            if (key.startsWith('mission_') && key.endsWith(marker) && (key.includes(`django-${window.exploreUserId}`) || key.toLowerCase().includes(String(window.exploreUserEmail || '').toLowerCase()))) {
                raw = localStorage.getItem(key);
                break;
            }
        }
    }
    if (!raw) return 0;

    try {
        const snapshot = JSON.parse(raw);
        const total = Number(snapshot.totalSections) || 0;
        const completed = Array.isArray(snapshot.completedSections)
            ? snapshot.completedSections.length
            : 0;
        return total ? Math.round(Math.min(completed / total, 1) * 100) : 0;
    } catch {
        return 0;
    }
}

document.querySelectorAll('[data-progress]').forEach((element) => {
    const progress = Math.max(0, Math.min(100, Number(element.dataset.progress) || 0));
    element.style.width = `${progress}%`;
});

const missionProgress = ['photosynthesis', 'mitosis', 'meiosis'].map((missionId) => ({
    missionId,
    percent: getMissionProgressPercent(missionId)
}));

missionProgress.forEach(({ missionId, percent }) => {
    const value = document.querySelector(`[data-mission-progress-value="${missionId}"]`);
    const bar = document.querySelector(`[data-mission-progress-bar="${missionId}"]`);
    if (value) value.textContent = `${percent}%`;
    if (bar) bar.style.width = `${percent}%`;
});

const averageProgress = Math.round(
    missionProgress.reduce((sum, item) => sum + item.percent, 0) / missionProgress.length
);
const completedMissions = missionProgress.filter(({ percent }) => percent >= 100).length;
if (biologyAverageProgress) biologyAverageProgress.textContent = `${averageProgress}%`;
if (biologyMissionsDone) biologyMissionsDone.textContent = `${completedMissions}/${missionProgress.length}`;

function setSidebarOpen(isOpen) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', isOpen);
    sidebar.setAttribute('aria-hidden', String(!isOpen));
    sidebarOverlay?.toggleAttribute('hidden', !isOpen);
    sidebarToggle?.setAttribute('aria-expanded', String(isOpen));
}

sidebarToggle?.addEventListener('click', () => {
    setSidebarOpen(!sidebar.classList.contains('is-open'));
});

sidebarOverlay?.addEventListener('click', () => setSidebarOpen(false));

sidebarCollapseToggle?.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('is-collapsed');
    sidebarCollapseToggle.setAttribute('aria-expanded', String(!isCollapsed));
    sidebarCollapseToggle.setAttribute('aria-label', isCollapsed ? 'Mostrar menu' : 'Esconder menu');
    const label = sidebarCollapseToggle.querySelector('.profile-sidebar-label');
    if (label) label.textContent = isCollapsed ? 'Mostrar' : 'Esconder';
    localStorage.setItem('explore-sidebar-collapsed', String(isCollapsed));
});

if (sidebar && localStorage.getItem('explore-sidebar-collapsed') === 'true') {
    sidebar.classList.add('is-collapsed');
    sidebarCollapseToggle?.setAttribute('aria-expanded', 'false');
    sidebarCollapseToggle?.setAttribute('aria-label', 'Mostrar menu');
    const label = sidebarCollapseToggle?.querySelector('.profile-sidebar-label');
    if (label) label.textContent = 'Mostrar';
}

function applyTheme(theme) {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    if (themeToggleBtn) {
        themeToggleBtn.setAttribute('aria-pressed', String(theme === 'dark'));
        themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
    }
}

applyTheme(localStorage.getItem('explore-theme') || 'light');

themeToggleBtn?.addEventListener('click', () => {
    const nextTheme = document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem('explore-theme', nextTheme);
});

notificationsBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = !notificationsPanel.hidden;
    notificationsPanel.hidden = isOpen;
    notificationsBtn.setAttribute('aria-expanded', String(!isOpen));
});

accountTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = !accountMenu.hidden;
    accountMenu.hidden = isOpen;
    accountTrigger.setAttribute('aria-expanded', String(!isOpen));
});

document.querySelectorAll('.profile-sidebar-nav a').forEach((link) => {
    link.addEventListener('click', () => setSidebarOpen(false));
});

document.addEventListener('click', (event) => {
    if (notificationsPanel && !notificationsPanel.contains(event.target) && event.target !== notificationsBtn) {
        notificationsPanel.hidden = true;
        notificationsBtn?.setAttribute('aria-expanded', 'false');
    }

    if (accountMenu && !accountMenu.contains(event.target) && event.target !== accountTrigger) {
        accountMenu.hidden = true;
        accountTrigger?.setAttribute('aria-expanded', 'false');
    }
});
