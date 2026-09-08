const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
const notificationsBtn = document.getElementById('notificationsBtn');
const notificationsPanel = document.getElementById('notificationsPanel');
const accountTrigger = document.getElementById('profileAccountTrigger');
const accountMenu = document.getElementById('profileAccountMenu');
const xpAluno = document.getElementById('xpAluno');
const nivelAluno = document.getElementById('nivelAluno');
const xpProgressBar = document.getElementById('xpProgressBar');
const xpNextLevelText = document.getElementById('xpNextLevelText');
const summaryXP = document.getElementById('summaryXP');
const recentActivityList = document.getElementById('recentActivityList');
const profileStreakCount = document.getElementById('profileStreakCount');
const subjectSwitcherBtn = document.getElementById('subjectSwitcherBtn');
const subjectSwitcherMenu = document.getElementById('subjectSwitcherMenu');

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
    // +1 so a brand-new student reads as "Nível 1", not "Nível 0" — matches
    // the same convention used server-side (PerfilAluno.nivel, models.py).
    const level = Math.floor(xp / 100) + 1;
    const progressPercent = xp % 100;
    if (xpAluno) xpAluno.textContent = `${xp} / ${level * 100} XP`;
    if (summaryXP) summaryXP.textContent = `${xp} XP`;
    if (nivelAluno) nivelAluno.textContent = `Nível ${level}`;
    if (xpProgressBar) xpProgressBar.style.width = `${progressPercent}%`;
    if (xpNextLevelText) xpNextLevelText.textContent = `${level * 100 - xp} XP até ao nível ${level + 1}`;

    // The hexagon badge is otherwise stuck with whatever the server
    // rendered on page load — keep it showing the exact same number as the
    // text above instead of two different totals that can drift apart.
    const profileLevelBadge = document.getElementById('profileLevelBadge');
    if (profileLevelBadge) profileLevelBadge.textContent = level;

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

function applyTheme(theme) {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    themeToggleBtns.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(theme === 'dark'));
        btn.setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
    });
}

applyTheme(localStorage.getItem('explore-theme') || 'light');

themeToggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        const nextTheme = document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem('explore-theme', nextTheme);
    });
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

document.addEventListener('click', (event) => {
    if (notificationsPanel && !notificationsPanel.contains(event.target) && event.target !== notificationsBtn) {
        notificationsPanel.hidden = true;
        notificationsBtn?.setAttribute('aria-expanded', 'false');
    }

    if (accountMenu && !accountMenu.contains(event.target) && event.target !== accountTrigger) {
        accountMenu.hidden = true;
        accountTrigger?.setAttribute('aria-expanded', 'false');
    }

    if (subjectSwitcherMenu && !subjectSwitcherMenu.contains(event.target) && !subjectSwitcherBtn?.contains(event.target)) {
        subjectSwitcherMenu.hidden = true;
        subjectSwitcherBtn?.setAttribute('aria-expanded', 'false');
    }
});

subjectSwitcherBtn?.addEventListener('click', () => {
    const isOpen = subjectSwitcherBtn.getAttribute('aria-expanded') === 'true';
    subjectSwitcherBtn.setAttribute('aria-expanded', String(!isOpen));
    subjectSwitcherMenu.hidden = isOpen;
});

const heroChatBtn = document.getElementById('heroChatBtn');
const mascoteChatPanel = document.getElementById('mascoteChatPanel');
const mascoteChatMessages = document.getElementById('mascoteChatMessages');
const mascoteChatForm = document.getElementById('mascoteChatForm');
const mascoteChatInput = document.getElementById('mascoteChatInput');
const mascoteChatSend = document.getElementById('mascoteChatSend');
let mascoteChatHistory = [];

const profileLayoutEl = document.querySelector('.profile-layout');
const heroMascotCard = heroChatBtn?.closest('.profile-hero-mascot-card');

function setKimChatOpenLayout(isOpen) {
    const sidebar = document.getElementById('profileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) {
        sidebar.classList.toggle('is-chat-hidden', isOpen);
        if (isOpen) {
            sidebar.classList.remove('is-open');
            sidebar.setAttribute('aria-hidden', 'true');
            overlay?.setAttribute('hidden', '');
        }
    }
    profileLayoutEl?.classList.toggle('kim-chat-open', isOpen);
    if (heroMascotCard) heroMascotCard.hidden = isOpen;
}

function openMascoteChatPanel() {
    if (!mascoteChatPanel) return;
    mascoteChatPanel.hidden = false;
    setKimChatOpenLayout(true);
    mascoteChatInput?.focus();
}

const mascoteChatWelcome = document.getElementById('mascoteChatWelcome');

mascoteChatWelcome?.querySelectorAll('.mascote-chat-suggestion').forEach((button) => {
    button.addEventListener('click', () => {
        if (!mascoteChatInput) return;
        mascoteChatInput.value = button.dataset.suggestion || '';
        mascoteChatInput.focus();
    });
});

function appendMascoteChatMessage(role, text, isTyping = false) {
    if (!mascoteChatMessages) return null;
    mascoteChatWelcome?.remove();
    const bubble = document.createElement('div');
    bubble.className = `mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}`;
    bubble.textContent = text;
    mascoteChatMessages.appendChild(bubble);
    mascoteChatMessages.scrollTop = mascoteChatMessages.scrollHeight;
    return bubble;
}

async function sendMascoteChatMessage() {
    const text = mascoteChatInput?.value.trim();
    if (!text) return;

    mascoteChatInput.value = '';
    appendMascoteChatMessage('user', text);
    const historyBeforeThisMessage = [...mascoteChatHistory];
    mascoteChatHistory = [...historyBeforeThisMessage, { role: 'user', text }];

    const typingEl = appendMascoteChatMessage('assistant', '…', true);

    try {
        const response = await fetch(window.exploreMascoteChatUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.exploreCsrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                message: text,
                missionTitle: 'Perfil',
                sectionTitle: '',
                context: '',
                history: historyBeforeThisMessage
            })
        });

        const data = await response.json().catch(() => ({}));
        typingEl?.remove();

        if (!response.ok) {
            appendMascoteChatMessage('assistant', data.erro || 'Não consegui responder agora. Tenta mais tarde.');
            if (data.limiteAtingido && mascoteChatInput && mascoteChatSend) {
                mascoteChatInput.disabled = true;
                mascoteChatInput.placeholder = 'Sem perguntas disponíveis esta semana';
                mascoteChatSend.disabled = true;
            }
            return;
        }

        appendMascoteChatMessage('assistant', data.reply || '...');
        mascoteChatHistory.push({ role: 'assistant', text: data.reply || '' });
    } catch (error) {
        typingEl?.remove();
        appendMascoteChatMessage('assistant', 'Não consegui ligar ao servidor. Verifica a tua ligação.');
    }
}

heroChatBtn?.addEventListener('click', openMascoteChatPanel);

document.getElementById('mascoteChatClose')?.addEventListener('click', () => {
    if (mascoteChatPanel) mascoteChatPanel.hidden = true;
    setKimChatOpenLayout(false);
});

mascoteChatForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMascoteChatMessage();
});

/** Perfil/Conquistas tabs swap which panel shows in the main column —
 *  no page navigation, the aside (quote + resumo rápido) never changes. */
const profileTabButtons = document.querySelectorAll('.profile-tab[data-tab-target]');
const profileTabPanels = document.querySelectorAll('.profile-tab-panel[data-tab-panel]');

profileTabButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const target = button.dataset.tabTarget;

        profileTabButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
        profileTabPanels.forEach((panel) => {
            panel.hidden = panel.dataset.tabPanel !== target;
        });
    });
});

/** Motivational quote card cycles through real science quotes every 5s. */
const SCIENCE_QUOTES = [
    { text: 'A ciência é a forma mais bonita de explorar o mundo.', author: 'Explore+' },
    { text: 'Nada na vida deve ser temido, apenas compreendido.', author: 'Marie Curie' },
    { text: 'A imaginação é mais importante que o conhecimento.', author: 'Albert Einstein' },
    { text: 'Somos feitos de poeira de estrelas.', author: 'Carl Sagan' },
    { text: 'Não é o mais forte que sobrevive, mas o que melhor se adapta à mudança.', author: 'Charles Darwin' },
    { text: 'A sorte favorece a mente preparada.', author: 'Louis Pasteur' },
    { text: 'Se vi mais longe, foi por estar sobre ombros de gigantes.', author: 'Isaac Newton' },
];

const profileQuoteCard = document.querySelector('.profile-quote-card');
const profileQuoteText = document.getElementById('profileQuoteText');
const profileQuoteAuthor = document.getElementById('profileQuoteAuthor');
const profileSubjectCard = document.querySelector('.profile-subject-card');

/** Keeps the quote card's height matched to the subject card next to it
 *  (same row, two different grid columns, so CSS alone can't align them). */
function syncQuoteCardHeight() {
    if (!profileQuoteCard || !profileSubjectCard) return;
    profileQuoteCard.style.minHeight = `${profileSubjectCard.offsetHeight}px`;
}

if (profileQuoteCard && profileQuoteText && profileQuoteAuthor) {
    syncQuoteCardHeight();
    window.addEventListener('resize', syncQuoteCardHeight);

    let quoteIndex = 0;

    setInterval(() => {
        quoteIndex = (quoteIndex + 1) % SCIENCE_QUOTES.length;
        profileQuoteCard.classList.add('is-fading');

        setTimeout(() => {
            const quote = SCIENCE_QUOTES[quoteIndex];
            profileQuoteText.textContent = quote.text;
            profileQuoteAuthor.textContent = `— ${quote.author}`;
            profileQuoteCard.classList.remove('is-fading');
            syncQuoteCardHeight();
        }, 350);
    }, 5000);
}

document.querySelectorAll('.mission-card-toggle').forEach((toggle) => {
    const subtopics = toggle.closest('.mission-card')?.querySelector('.mission-card-subtopics');
    if (!subtopics) return;

    toggle.addEventListener('click', () => {
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isOpen));
        subtopics.hidden = isOpen;
    });
});
