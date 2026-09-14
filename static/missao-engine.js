/**
 * Motor de missões reutilizável — Explore+
 *
 * Lê um ficheiro de missão (ver missoes/*.json para o formato) e percorre
 * secções/ecrãs pela ordem, renderizando cada "tipo" de ecrã com o layout
 * correspondente. Para criar uma missão nova basta escrever um novo JSON
 * no mesmo formato — este ficheiro não conhece nada específico de nenhuma
 * missão em concreto.
 *
 * Tipos de ecrã suportados: gancho, diagrama_interativo, micro_verificacao,
 * analogia, aprofundar, quiz_seccao.
 */
(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Plain text with line breaks (\n\n) turned into paragraphs — content
    // comes from our own missoes/*.json, not user input, so this only ever
    // needs to handle that trusted authoring format.
    function textToHtml(value) {
        const paragraphs = String(value ?? '').split(/\n\s*\n/).filter(Boolean);
        if (paragraphs.length <= 1) {
            return `<p>${escapeHtml(value)}</p>`;
        }
        return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    }

    class MissaoEngine {
        constructor(missao, options = {}) {
            this.missao = missao;
            this.root = options.root;
            this.missionsIndexUrl = options.missionsIndexUrl || '#';
            this.mascotImageUrl = options.mascotImageUrl || '';
            this.progressSyncUrl = options.progressSyncUrl || window.exploreProgressSyncUrl || '';
            this.csrfToken = options.csrfToken || window.exploreCsrfToken || '';
            this.mascoteChatUrl = options.mascoteChatUrl || window.exploreMascoteChatUrl || '';
            this.mascotWaveVideoUrl = options.mascotWaveVideoUrl || window.exploreMascotWaveVideoUrl || '';

            // Estado do painel de chat — não persiste em localStorage (tal
            // como na Fotossíntese, o chat começa sempre fechado e sem
            // histórico a cada visita/recarregamento da página).
            this.chatOpen = false;
            this.chatHistory = [];
            this.chatLimitReached = false;
            this._lastGanchoPopupKey = null;

            this.storageKey = this.buildStorageKey();
            this.state = this.loadState();

            this.render();
            window.addEventListener('explore:mascot-prefs-changed', () => this.render());
        }

        // ---- Persistência -------------------------------------------------

        buildStorageKey() {
            const user = window.exploreCurrentUser;
            const userKey = user?.uid ? `uid:${user.uid}` : (user?.email ? `email:${user.email.toLowerCase()}` : 'guest');
            return `missao_engine_${userKey}_${this.missao.missao_id}`;
        }

        defaultState() {
            return {
                view: 'mapa',
                activeSectionIndex: 0,
                screenIndexBySection: {},
                answers: {},
                quizState: {},
                completedSections: [],
                celebrationShown: false
            };
        }

        loadState() {
            try {
                const raw = localStorage.getItem(this.storageKey);
                if (!raw) return this.defaultState();
                const parsed = JSON.parse(raw);
                return { ...this.defaultState(), ...parsed };
            } catch (error) {
                return this.defaultState();
            }
        }

        saveState() {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.state));
            } catch (error) {
                // Ignore storage errors (private browsing / quota).
            }
        }

        // ---- Helpers de missão ---------------------------------------------

        get sections() {
            return this.missao.secoes || [];
        }

        getSection(index) {
            return this.sections[index];
        }

        totalMissionXP() {
            return this.sections.reduce((sum, s) => sum + (Number(s.xp) || 0), 0);
        }

        isSectionUnlocked(index) {
            if (index === 0) return true;
            const previous = this.sections[index - 1];
            return this.state.completedSections.includes(previous.secao_id);
        }

        mascotEnabled() {
            return window.MascotPrefs ? window.MascotPrefs.isEnabled() : true;
        }

        // ---- Render raiz ----------------------------------------------------

        render() {
            if (!this.root) return;

            if (this.state.view === 'celebracao') {
                this.renderCelebration();
                return;
            }

            if (this.state.view === 'mapa') {
                this.renderMapa();
                return;
            }

            this.renderSeccao();
        }

        // ---- Vista: mapa da missão ------------------------------------------

        // Reaproveita exatamente as classes "mo-*" de mission-styles.css (a
        // mesma folha de estilo usada pelo ecrã de percurso da missão da
        // Fotossíntese) para que qualquer missão deste motor genérico tenha
        // a mesma aparência de índice/hero/progresso, sem CSS duplicado.
        renderMapa() {
            const totalXP = this.totalMissionXP();
            const completedCount = this.state.completedSections.length;
            const totalCount = this.sections.length;
            const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

            const xpStarIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="yellow" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';
            const checkIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
            const chevronIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

            const rowsHtml = this.sections.map((section, index) => {
                const isDone = this.state.completedSections.includes(section.secao_id);
                const isLocked = !this.isSectionUnlocked(index);
                const isActive = !isDone && !isLocked;
                const statusHtml = isLocked
                    ? '<span class="mo-index-status mo-index-status--locked">🔒 Bloqueada</span>'
                    : (isDone
                        ? `<span class="mo-index-status mo-index-status--done">${checkIconSvg} Concluída</span>`
                        : '<span class="mo-index-status mo-index-status--active">Em progresso</span>');

                return `
                    <li class="mo-index-row ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}">
                        <button type="button" class="mo-index-row-btn" data-section-index="${index}" ${isLocked ? 'disabled' : ''}>
                            <span class="mo-index-icon" style="background:#1f8a5b22; color:#1f8a5b">${index + 1}</span>
                            <span class="mo-index-copy">
                                <strong>${escapeHtml(section.titulo)}</strong>
                                <span>~${section.tempo_estimado_min || 0} min</span>
                            </span>
                            <span class="mo-index-meta">
                                ${statusHtml}
                                <span class="mo-index-xp">${xpStarIconSvg} +${section.xp || 0} XP</span>
                            </span>
                            <span class="mo-index-chevron" aria-hidden="true">${chevronIconSvg}</span>
                        </button>
                    </li>
                `;
            }).join('');

            const logoUrl = window.exploreLogoUrl || '';
            const planoIsPro = window.explorePlano === 'pro';
            const avatarInitial = (window.exploreUsername || '').trim().charAt(0).toUpperCase() || '?';

            this.root.innerHTML = `
                <div class="mo-page" id="moPage">
                    <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>
                    <aside class="profile-sidebar" id="profileSidebar" aria-hidden="true">
                        <div class="profile-sidebar-brand"><div><img src="${logoUrl}" alt="Logotipo Explore+"></div></div>
                        <nav class="profile-sidebar-nav">
                            <div class="sidebar-plan-card">
                                <div class="sidebar-plan-info">
                                    <span class="sidebar-plan-label">Plano</span>
                                    <strong class="sidebar-plan-name">${planoIsPro ? 'Pro' : 'Gratuito'}</strong>
                                </div>
                                ${planoIsPro ? '<span class="sidebar-plan-cta sidebar-plan-cta--badge">SuperExplore</span>' : `<a href="${window.exploreSuperExploreUrl || '#'}" class="sidebar-plan-cta">SuperExplore</a>`}
                            </div>
                            <a href="${window.explorePerfilUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span>
                            <span class="profile-sidebar-label">Perfil</span>
                            </a>
                            <a href="${this.missionsIndexUrl}" class="is-active" aria-current="page"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
                            <span class="profile-sidebar-label">Missões</span>
                            </a>
                            <a href="${window.exploreTestesUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg></span>
                            <span class="profile-sidebar-label">Testes</span>
                            </a>
                            <a href="${window.exploreExamesUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg></span>
                            <span class="profile-sidebar-label">Exames</span>
                            </a>
                            <a href="${window.exploreBibliotecaUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg></span>
                            <span class="profile-sidebar-label">Biblioteca do Explorador</span>
                            </a>
                            <a href="${window.exploreResumosUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg></span>
                            <span class="profile-sidebar-label">Resumos</span>
                            </a>
                        </nav>
                        <div class="sidebar-theme-card">
                            <span class="sidebar-theme-label">Tema</span>
                            <button class="header-icon-btn theme-toggle-btn" id="sidebarThemeToggleBtn" type="button" aria-label="Ativar modo escuro" aria-pressed="false">
                                <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                                <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
                            </button>
                        </div>
                        <div class="profile-account">
                            <button class="profile-account-trigger" id="profileAccountTrigger" type="button" aria-expanded="false" aria-controls="profileAccountMenu">
                                <span class="profile-account-avatar" id="profileAccountAvatar">${avatarInitial}</span>
                                <span class="profile-account-info">
                                    <strong id="profileAccountName">${escapeHtml(window.exploreUsername || '')}</strong>
                                    <span id="profileAccountEmail">${escapeHtml(this.missao ? (window.exploreCurrentUser?.email || '') : '')}</span>
                                </span>
                                <span class="profile-account-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
                            </button>
                            <div class="profile-account-menu" id="profileAccountMenu" hidden>
                                <a href="${window.exploreConfiguracoesUrl || '#'}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></svg>
                                    <span>Configurações</span>
                                </a>
                                <a href="${window.exploreLogoutUrl || '#'}" class="profile-account-logout">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></svg>
                                    <span>Terminar sessão</span>
                                </a>
                            </div>
                        </div>
                    </aside>

                    <div class="mo-body">
                        <div class="mo-topbar">
                            <a href="${window.explorePaginaInicialUrl || '#'}" class="mo-header-logo"><img src="${logoUrl}" alt="Explore+"></a>
                            <button type="button" class="nav-drawer-toggle" id="navDrawerToggle" aria-label="Abrir menu">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                            </button>
                        </div>

                        <nav class="mo-breadcrumb" aria-label="Navegação">
                            <a href="${this.missionsIndexUrl}">Missões</a>
                            <span class="mo-breadcrumb-sep">›</span>
                            <span>${escapeHtml(this.missao.titulo)}</span>
                        </nav>

                        <section class="mo-hero">
                            <div class="mo-hero-info">
                                <h1>${escapeHtml(this.missao.titulo)}</h1>
                                ${this.missao.descricao ? `<p>${escapeHtml(this.missao.descricao)}</p>` : ''}
                                <div class="mo-hero-meta">
                                    <span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg> ${totalCount} secções</span>
                                    <span>${xpStarIconSvg} +${totalXP} XP</span>
                                    ${this.missao.badge ? `<span>${this.missao.badge.icone || '🏆'} ${escapeHtml(this.missao.badge.nome || '')}</span>` : ''}
                                </div>
                            </div>
                        </section>

                        <section class="mo-index">
                            <h2>Índice da Missão</h2>
                            <p class="mo-index-subtitle">Completa todos os passos para ganhares a tua recompensa!</p>
                            <div class="mo-layout">
                                <ol class="mo-index-list">${rowsHtml}</ol>
                                <aside class="mo-sidebar">
                                    <div class="mo-card mo-progress-card">
                                        <h3>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                                            O teu progresso
                                        </h3>
                                        <div class="mo-progress-row">
                                            <div class="mo-progress-ring" style="--progress: ${progressPercent}">
                                                <span>${completedCount}/${totalCount}</span>
                                            </div>
                                            <strong class="mo-progress-percent">${progressPercent}%</strong>
                                        </div>
                                        <div class="mo-progress-bar"><div class="mo-progress-bar-fill" style="width:${progressPercent}%"></div></div>
                                    </div>
                                    <div class="mo-card mo-rewards-card">
                                        <h3>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>
                                            Recompensas da missão
                                        </h3>
                                        <div class="mo-reward-buttons">
                                            <span class="mo-reward-btn">+${totalXP} XP</span>
                                            ${this.missao.badge ? `<span class="mo-reward-btn">${escapeHtml(this.missao.badge.nome || '')}</span>` : ''}
                                        </div>
                                    </div>
                                </aside>
                            </div>
                        </section>
                    </div>
                </div>
            `;

            this.bindMapaChrome();

            this.root.querySelectorAll('[data-section-index]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const index = Number(btn.dataset.sectionIndex);
                    this.state.activeSectionIndex = index;
                    this.state.view = 'seccao';
                    if (!(this.getSection(index).secao_id in this.state.screenIndexBySection)) {
                        this.state.screenIndexBySection[this.getSection(index).secao_id] = 0;
                    }
                    this.saveState();
                    this.render();
                });
            });
        }

        /**
         * Liga o hamburger/sidebar, o toggle de tema e o menu da conta do
         * ecrã de mapa — mission-styles.css espera este comportamento (ver
         * a mesma lógica em mission.js/renderPathScreen), e como este HTML
         * é gerado dinamicamente, nav-drawer.js/header-actions.js (que só
         * ligam elementos já presentes no momento em que correm) nunca
         * chegam a encontrar estes botões.
         */
        bindMapaChrome() {
            const page = this.root.querySelector('#moPage');
            const drawer = this.root.querySelector('#profileSidebar');
            const overlay = this.root.querySelector('#sidebarOverlay');
            const toggle = this.root.querySelector('#navDrawerToggle');

            const setSidebarOpen = (isOpen) => {
                if (!drawer || !overlay) return;
                drawer.classList.toggle('is-open', isOpen);
                drawer.setAttribute('aria-hidden', String(!isOpen));
                overlay.toggleAttribute('hidden', !isOpen);
                page?.classList.toggle('sidebar-open', isOpen);
            };

            toggle?.addEventListener('click', () => setSidebarOpen(!drawer?.classList.contains('is-open')));
            overlay?.addEventListener('click', () => setSidebarOpen(false));

            this.bindThemeToggle(this.root.querySelector('#sidebarThemeToggleBtn'));

            const accountTrigger = this.root.querySelector('#profileAccountTrigger');
            const accountMenu = this.root.querySelector('#profileAccountMenu');
            accountTrigger?.addEventListener('click', (event) => {
                event.stopPropagation();
                const isOpen = !accountMenu.hidden;
                accountMenu.hidden = isOpen;
                accountTrigger.setAttribute('aria-expanded', String(!isOpen));
            });

            if (!this._mapaGlobalChromeBound) {
                this._mapaGlobalChromeBound = true;
                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') setSidebarOpen(false);
                });
                document.addEventListener('click', (event) => {
                    const menu = this.root.querySelector('#profileAccountMenu');
                    const trigger = this.root.querySelector('#profileAccountTrigger');
                    if (menu && !menu.hidden && !menu.contains(event.target) && event.target !== trigger && !trigger?.contains(event.target)) {
                        menu.hidden = true;
                        trigger?.setAttribute('aria-expanded', 'false');
                    }
                });
            }
        }

        /** Partilhado pelo botão de tema do mapa e pelo do topbar da secção. */
        bindThemeToggle(themeToggle) {
            if (!themeToggle) return;
            const isDark = document.documentElement.classList.contains('dark-mode');
            themeToggle.setAttribute('aria-pressed', String(isDark));
            themeToggle.addEventListener('click', () => {
                const nextDark = !document.documentElement.classList.contains('dark-mode');
                document.documentElement.classList.toggle('dark-mode', nextDark);
                document.documentElement.dataset.theme = nextDark ? 'dark' : 'light';
                try {
                    localStorage.setItem('explore-theme', nextDark ? 'dark' : 'light');
                } catch (error) {
                    // Ignora erros de acesso ao storage (navegação privada).
                }
                themeToggle.setAttribute('aria-pressed', String(nextDark));
            });
        }

        // ---- Painel de chat com a mascote -------------------------------------
        // Reaproveita tal e qual o botão flutuante (.mascot-chat-fab) e o
        // painel (.mascote-chat-panel, dentro de .mission-sidebar) da missão
        // da Fotossíntese, incluindo o próprio endpoint /api/mascote-chat/
        // (já agnóstico da missão) — ver mascote_chat() em views.py e
        // sendMascoteChatMessage() em mission.js, que este código espelha.

        mascotFabFigureHtml() {
            if (this.mascotWaveVideoUrl) {
                return `<video src="${this.mascotWaveVideoUrl}" autoplay loop muted playsinline></video>`;
            }
            if (this.mascotImageUrl) {
                return `<img src="${this.mascotImageUrl}" alt="Mascote">`;
            }
            return `<span class="me-mascot-avatar--fallback">🐢</span>`;
        }

        chatBubbleHtml(role, text, isTyping = false) {
            return `<div class="mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}">${escapeHtml(text)}</div>`;
        }

        chatWelcomeHtml() {
            const username = window.exploreUsername || '';
            const suggestions = [
                'Podes explicar-me este conceito de forma simples?',
                'Podes resumir a matéria desta unidade?',
                'Podes dar-me um exemplo prático?'
            ];
            return `
                <div class="mascote-chat-welcome" id="meChatWelcome">
                    ${this.mascotWaveVideoUrl ? `<video src="${this.mascotWaveVideoUrl}" class="mascote-chat-welcome-video" autoplay loop muted playsinline></video>` : ''}
                    <div class="mascote-chat-welcome-copy">
                        <p class="mascote-chat-welcome-greeting">${username ? `Olá, ${escapeHtml(username)}!` : 'Olá!'}</p>
                        <h3 class="mascote-chat-welcome-title">Como posso ajudar?</h3>
                        <p class="mascote-chat-welcome-subtitle">Escolhe uma sugestão ou escreve a tua pergunta!</p>
                    </div>
                    <div class="mascote-chat-suggestions">
                        ${suggestions.map((s) => `<button type="button" class="mascote-chat-suggestion" data-suggestion="${s.replace(/"/g, '&quot;')}">${escapeHtml(s)}</button>`).join('')}
                    </div>
                </div>
            `;
        }

        renderChatMessagesHtml() {
            if (!this.chatHistory.length) return this.chatWelcomeHtml();
            return this.chatHistory.map((m) => this.chatBubbleHtml(m.role, m.text)).join('');
        }

        appendChatBubble(role, text, isTyping = false) {
            const messagesEl = this.root.querySelector('#meChatMessages');
            if (!messagesEl) return null;
            this.root.querySelector('#meChatWelcome')?.remove();
            const bubble = document.createElement('div');
            bubble.className = `mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}`;
            bubble.textContent = text;
            messagesEl.appendChild(bubble);
            messagesEl.scrollTop = messagesEl.scrollHeight;
            return bubble;
        }

        disableChatInput() {
            this.chatLimitReached = true;
            const input = this.root.querySelector('#meChatInput');
            const sendBtn = this.root.querySelector('#meChatSend');
            if (input) {
                input.disabled = true;
                input.placeholder = 'Sem perguntas disponíveis esta semana';
            }
            if (sendBtn) sendBtn.disabled = true;
        }

        async sendChatMessage(section) {
            const input = this.root.querySelector('#meChatInput');
            const text = input?.value.trim();
            if (!text || !this.mascoteChatUrl) return;

            input.value = '';
            this.appendChatBubble('user', text);
            const historyBeforeThisMessage = this.chatHistory.map((m) => ({ role: m.role, text: m.text }));
            this.chatHistory.push({ role: 'user', text });

            const typingEl = this.appendChatBubble('assistant', '…', true);
            const context = (this.root.querySelector('.screen-card')?.textContent || '').trim().slice(0, 6000);

            try {
                const response = await fetch(this.mascoteChatUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        message: text,
                        missionTitle: this.missao.titulo,
                        sectionTitle: section?.titulo || '',
                        context,
                        history: historyBeforeThisMessage
                    })
                });

                const data = await response.json().catch(() => ({}));
                typingEl?.remove();

                if (!response.ok) {
                    this.appendChatBubble('assistant', data.erro || 'Não consegui responder agora. Tenta mais tarde.');
                    if (data.limiteAtingido) this.disableChatInput();
                    return;
                }

                this.appendChatBubble('assistant', data.reply || '...');
                this.chatHistory.push({ role: 'assistant', text: data.reply || '' });
            } catch (error) {
                typingEl?.remove();
                this.appendChatBubble('assistant', 'Não consegui ligar ao servidor. Verifica a tua ligação.');
            }
        }

        // ---- Vista: dentro de uma secção -------------------------------------

        getScreenIndex(section) {
            return this.state.screenIndexBySection[section.secao_id] || 0;
        }

        setScreenIndex(section, index) {
            this.state.screenIndexBySection[section.secao_id] = index;
            this.saveState();
        }

        // Classes "lesson-*"/"screen-*"/"quiz-*"/"did-you-know"/"mission-intro-callout"
        // abaixo são as mesmas de mission-styles.css usadas pelas páginas onde
        // se aprende o conteúdo da missão da Fotossíntese — reaproveitadas tal
        // e qual, para qualquer missão deste motor ter a mesma aparência.
        renderSeccao() {
            const sectionIndex = this.state.activeSectionIndex;
            const section = this.getSection(sectionIndex);
            const screens = section.ecrãs || [];
            const screenIndex = Math.max(0, Math.min(this.getScreenIndex(section), screens.length - 1));
            const screen = screens[screenIndex];
            const percent = Math.round(((screenIndex + 1) / screens.length) * 100);

            const isAnswerGate = ['micro_verificacao'].includes(screen.tipo);
            const answerKey = `${section.secao_id}::${screenIndex}`;
            const hasAnswered = !!this.state.answers[answerKey];
            const canContinue = screen.tipo === 'quiz_seccao'
                ? this.isQuizFullyAnswered(section, screen)
                : (!isAnswerGate || hasAnswered);
            const isLastScreen = screenIndex === screens.length - 1;

            // O quiz_seccao gere a sua própria progressão pergunta a
            // pergunta (ver renderQuizSeccao) — o "Continuar" genérico só
            // aparece depois de chegar ao resultado, tal como o
            // .screen-nav original escondia o botão "next" em modo quiz.
            const showNextBtn = screen.tipo !== 'quiz_seccao' || canContinue;
            const nextLabel = isLastScreen
                ? (sectionIndex === this.sections.length - 1 ? 'Concluir missão' : 'Concluir secção')
                : '';
            const nextBtnHtml = showNextBtn
                ? `
                    <button type="button"
                        class="screen-nav-btn ${nextLabel ? '' : 'screen-nav-btn--icon'}"
                        id="meNextBtn"
                        data-nav-action="next"
                        aria-label="${nextLabel || 'Continuar'}"
                        ${canContinue ? '' : 'disabled'}>
                        ${nextLabel || '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'}
                    </button>
                `
                : '';

            let xpStat = '';
            if (window.ProfileXP) {
                try {
                    const stats = window.ProfileXP.getProfileStats(window.ProfileXP.getCurrentUserProfile());
                    xpStat = `<span class="lesson-stat">⭐ ${stats.xp} XP</span>`;
                } catch (error) {
                    xpStat = '';
                }
            }

            this.root.innerHTML = `
                <div class="mission-shell ${this.chatOpen ? '' : 'is-sidebar-collapsed'}">
                    <aside class="mission-sidebar" id="meMissionSidebar">
                        <div class="mascote-chat-panel">
                            <div class="mascote-chat-header">
                                <button type="button" class="mascote-chat-close" id="meChatCloseBtn" aria-label="Fechar o chat">✕</button>
                                <span>Fala com a mascote</span>
                            </div>
                            <div class="mascote-chat-messages" id="meChatMessages">${this.renderChatMessagesHtml()}</div>
                            <form class="mascote-chat-form" id="meChatForm">
                                <input type="text" class="mascote-chat-input" id="meChatInput" placeholder="${this.chatLimitReached ? 'Sem perguntas disponíveis esta semana' : 'Escreve a tua pergunta...'}" autocomplete="off" maxlength="500" ${this.chatLimitReached ? 'disabled' : ''}>
                                <button type="submit" class="mascote-chat-send" id="meChatSend" aria-label="Enviar" ${this.chatLimitReached ? 'disabled' : ''}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                </button>
                            </form>
                        </div>
                    </aside>
                    <div class="mission-sidebar-resize-handle"></div>
                    <div class="mission-main">
                        <div class="lesson-topbar">
                            <button type="button" class="lesson-topbar-close" id="meBackToMap" aria-label="Voltar ao mapa da missão">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                            <div class="lesson-topbar-titles">
                                <span class="lesson-topbar-title">${escapeHtml(section.titulo)}</span>
                                <div class="lesson-progress-row">
                                    <div class="lesson-progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
                                        <div class="lesson-progress-fill" style="width:${percent}%"></div>
                                    </div>
                                    <span class="lesson-progress-percent">${percent}%</span>
                                </div>
                            </div>
                            <div class="lesson-topbar-actions">
                                <div class="lesson-stats">${xpStat}</div>
                                <button type="button" class="lesson-theme-toggle" id="meThemeToggle" aria-label="Alternar modo claro/escuro">
                                    <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                                    <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="mission-content">
                            <div class="section-body">
                                <div class="section-content">
                                    <div class="screen-card">${this.renderScreen(section, screen, screenIndex)}</div>
                                </div>
                                <div class="me-gancho-nav-wrap">
                                    <div class="screen-nav">
                                        <button type="button" class="screen-nav-btn" id="mePrevBtn" ${screenIndex === 0 ? 'disabled' : ''}>Anterior</button>
                                        ${nextBtnHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <button type="button" class="mascot-chat-fab" id="meMascotFab" aria-label="Falar com a mascote" ${this.chatOpen ? 'hidden' : ''}>
                    ${this.mascotFabFigureHtml()}
                </button>
            `;

            this.bindScreenInteractions(section, screen, screenIndex);

            this.root.querySelector('#meBackToMap')?.addEventListener('click', () => {
                this.state.view = 'mapa';
                this.saveState();
                this.render();
            });

            this.root.querySelector('#mePrevBtn')?.addEventListener('click', () => {
                this.setScreenIndex(section, screenIndex - 1);
                this.render();
            });

            this.root.querySelector('#meNextBtn')?.addEventListener('click', () => {
                this.advance(section, sectionIndex, screenIndex, screens);
            });

            this.bindThemeToggle(this.root.querySelector('#meThemeToggle'));

            const chatMessagesEl = this.root.querySelector('#meChatMessages');
            if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

            this.root.querySelector('#meMascotFab')?.addEventListener('click', () => {
                this.chatOpen = true;
                this.render();
            });

            this.root.querySelector('#meChatCloseBtn')?.addEventListener('click', () => {
                this.chatOpen = false;
                this.render();
            });

            this.root.querySelector('#meChatForm')?.addEventListener('submit', (event) => {
                event.preventDefault();
                this.sendChatMessage(section);
            });

            this.root.querySelectorAll('.mascote-chat-suggestion').forEach((button) => {
                button.addEventListener('click', () => {
                    const input = this.root.querySelector('#meChatInput');
                    if (!input) return;
                    input.value = button.dataset.suggestion || '';
                    input.focus();
                });
            });

            this.showEntryPopupIfNeeded(section, screen, screenIndex);
        }

        advance(section, sectionIndex, screenIndex, screens) {
            const isLastScreen = screenIndex === screens.length - 1;

            if (!isLastScreen) {
                this.setScreenIndex(section, screenIndex + 1);
                this.render();
                return;
            }

            // Última tela da secção (o quiz_seccao) — marca a secção como
            // concluída e avança para a próxima, ou celebra se for a última.
            if (!this.state.completedSections.includes(section.secao_id)) {
                this.state.completedSections.push(section.secao_id);
            }

            const isLastSection = sectionIndex === this.sections.length - 1;
            if (isLastSection) {
                this.completeMission();
                return;
            }

            this.state.activeSectionIndex = sectionIndex + 1;
            const nextSection = this.getSection(sectionIndex + 1);
            if (!(nextSection.secao_id in this.state.screenIndexBySection)) {
                this.state.screenIndexBySection[nextSection.secao_id] = 0;
            }
            this.saveState();
            this.render();
        }

        // ---- Render por tipo de ecrã -----------------------------------------

        renderScreen(section, screen, screenIndex) {
            switch (screen.tipo) {
                case 'gancho': return this.renderGancho(screen);
                case 'diagrama_interativo': return this.renderDiagrama(screen);
                case 'micro_verificacao': return this.renderMicroVerificacao(section, screen, screenIndex);
                case 'analogia': return this.renderAnalogia(screen);
                case 'aprofundar': return this.renderAprofundar(screen);
                case 'quiz_seccao': return this.renderQuizSeccao(section, screen);
                default: return '';
            }
        }

        /**
         * Cartão inline com o avatar + fala da mascote, reaproveitando o
         * visual de .mascot-overlay-card--split (o mesmo usado nos diálogos
         * flutuantes da Fotossíntese) mas exibido dentro do próprio ecrã em
         * vez de num modal — não há botão de fechar porque não é modal.
         */
        mascotInlineCardHtml(texto) {
            if (!this.mascotEnabled() || !texto) return '';
            const figureHtml = this.mascotImageUrl
                ? `<img class="mascot-overlay-figure" src="${this.mascotImageUrl}" alt="Mascote">`
                : `<span class="mascot-overlay-figure me-mascot-avatar--fallback">🐢</span>`;
            return `
                <div class="mascot-overlay-card mascot-overlay-card--split me-mascot-inline">
                    <div class="mascot-overlay-split-figure">${figureHtml}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text">${escapeHtml(texto)}</p>
                    </div>
                </div>
            `;
        }

        renderGancho(screen) {
            if (screen.imagem) {
                // Com imagem própria: o painel branco só leva a imagem e o
                // título — a fala da mascote aparece à parte, num popup
                // (ver showMascotPopup, chamado pelo renderSeccao).
                return `
                    <div class="mascot-overlay-card me-mascot-inline me-gancho-card">
                        <img class="me-gancho-hero-image" src="/static/images/${encodeURIComponent(screen.imagem)}" alt="${escapeHtml(screen.titulo || '')}" onerror="this.style.display='none'">
                        <h3 class="screen-title-lg">${escapeHtml(screen.texto)}</h3>
                    </div>
                `;
            }
            return `
                ${this.mascotInlineCardHtml(screen.mascote_texto)}
                <h3 class="screen-title-lg">${escapeHtml(screen.texto)}</h3>
            `;
        }

        /**
         * Popup com a mascote à esquerda e a fala à direita — reaproveita
         * tal e qual .mascot-overlay-card--split (o mesmo diálogo modal
         * usado nas saudações/curiosidades da Fotossíntese). Chamado uma
         * vez por cada vez que se entra num ecrã de gancho com imagem
         * própria, ou no quiz de fim de secção (ver showEntryPopupIfNeeded).
         */
        mascotOverlayFigureHtml() {
            if (this.mascotWaveVideoUrl) {
                return `<video class="mascot-overlay-figure" src="${this.mascotWaveVideoUrl}" autoplay loop muted playsinline></video>`;
            }
            if (this.mascotImageUrl) {
                return `<img class="mascot-overlay-figure" src="${this.mascotImageUrl}" alt="Mascote">`;
            }
            return `<span class="mascot-overlay-figure me-mascot-avatar--fallback">🐢</span>`;
        }

        showMascotPopup(texto) {
            if (!this.mascotEnabled() || !texto) return;
            document.querySelector('.me-mascot-popup')?.remove();

            const overlay = document.createElement('div');
            overlay.className = 'mascot-overlay me-mascot-popup';
            overlay.innerHTML = `
                <div class="mascot-overlay-card mascot-overlay-card--split" role="dialog" aria-modal="true" aria-label="Mensagem da mascote">
                    <div class="mascot-overlay-split-figure">${this.mascotOverlayFigureHtml()}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text">${escapeHtml(texto)}</p>
                        <button type="button" class="mascot-overlay-btn">Entendido</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) close();
            });
            overlay.querySelector('.mascot-overlay-btn')?.addEventListener('click', close);
        }

        /** Só mostra o popup na primeira vez que se entra neste ecrã em
         *  concreto — reentradas por causa de outro re-render (ex: abrir/
         *  fechar o chat) não o voltam a mostrar. */
        showEntryPopupIfNeeded(section, screen, screenIndex) {
            const popupKey = `${section.secao_id}::${screenIndex}`;
            if (this._lastGanchoPopupKey === popupKey) return;

            const temGancho = (screen.tipo === 'gancho' && screen.imagem)
                || (screen.tipo === 'diagrama_interativo' && screen.intro_imagem);
            if (temGancho && screen.mascote_texto) {
                this._lastGanchoPopupKey = popupKey;
                this.showMascotPopup(screen.mascote_texto);
                return;
            }

            // Ao chegar ao quiz da secção (só na primeira pergunta, antes
            // de qualquer resposta), avisa que vem aí um desafio — genérico
            // do motor, não depende de nenhum campo do JSON da missão.
            if (screen.tipo === 'quiz_seccao') {
                const quizState = this.getQuizState(section);
                if (quizState.current === 0 && quizState.answers.length === 0) {
                    this._lastGanchoPopupKey = popupKey;
                    this.showMascotPopup(`Agora que já viste "${section.titulo}", tenho um desafio para ti.`);
                }
            }
        }

        /**
         * Formato alternativo aos chips: pontos numa linha do tempo
         * horizontal, com o nome em diagonal por cima do ponto e o ano por
         * baixo (extraído de labels do tipo "Nome (ano)"). Só é usado quando
         * o próprio ecrã pede explicitamente screen.layout === "timeline"
         * (ver renderDiagrama) — os outros diagramas mantêm os chips atuais.
         * Reaproveita a classe "me-diagrama-chip" e o atributo
         * data-ponto-index nos botões para que o clique continue a
         * funcionar tal e qual (ver bindScreenInteractions), sem precisar
         * de nenhuma lógica de clique nova.
         */
        renderDiagramaTimeline(pontos) {
            const itemsHtml = pontos.map((ponto, i) => {
                const partido = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(ponto.label || '');
                const nome = partido ? partido[1].trim() : (ponto.label || '');
                const ano = partido ? partido[2].trim() : '';
                return `
                    <li class="me-timeline-item">
                        ${nome ? `<span class="me-timeline-label">${escapeHtml(nome)}</span>` : ''}
                        <button type="button" class="me-diagrama-chip me-timeline-dot" data-ponto-index="${i}" aria-label="${escapeHtml(ponto.label || '')}" title="${escapeHtml(ponto.label || '')}"></button>
                        ${ano ? `<span class="me-timeline-caption">${escapeHtml(ano)}</span>` : ''}
                    </li>
                `;
            }).join('');

            return `
                <div class="me-timeline-scroll">
                    <div class="me-timeline-rail-wrap">
                        <div class="me-timeline-rail" aria-hidden="true"></div>
                        <ol class="me-timeline-dots" role="list">${itemsHtml}</ol>
                    </div>
                </div>
            `;
        }

        /**
         * Formato "escada": um degrau por ponto, com altura crescente
         * (--step-index) para se ler como uma escada ascendente — sem
         * imagem de diagrama própria (os próprios degraus já são a
         * visualização). Reaproveita data-ponto-index para o clique (ver
         * bindScreenInteractions), tal como os outros formatos.
         */
        renderDiagramaEscada(pontos) {
            const stepsHtml = pontos.map((ponto, i) => `
                <button type="button" class="me-escada-step ${i === 0 ? 'is-active' : ''}" data-ponto-index="${i}" style="--step-index:${i}">
                    <span class="me-escada-step-num">${i + 1}</span>
                    <span class="me-escada-step-label">${escapeHtml(ponto.label)}</span>
                </button>
            `).join('');
            return `<div class="me-escada-track">${stepsHtml}</div>`;
        }

        renderDiagrama(screen) {
            const pontos = screen.pontos || [];
            const isEscada = screen.layout === 'escada';
            const isTimeline = screen.layout === 'timeline';
            const pontosHtml = isEscada
                ? this.renderDiagramaEscada(pontos)
                : isTimeline
                    ? this.renderDiagramaTimeline(pontos)
                    : `<div class="me-diagrama-chips">${pontos.map((ponto, i) => `
                        <button type="button" class="me-diagrama-chip" data-ponto-index="${i}">
                            <span class="me-diagrama-chip-num">${i + 1}</span>
                            <span>${escapeHtml(ponto.label)}</span>
                        </button>
                    `).join('')}</div>`;

            // Introdução opcional (gancho fundido neste ecrã, ver
            // showMascotPopupIfNeeded): imagem + frase-isco + frase-ponte a
            // ligar esse isco ao diagrama que se segue. Na timeline, o
            // título e a frase-ponte saem daqui — passam a aparecer juntos
            // por cima da própria linha temporal (ver tituloPonteHtml).
            const introHtml = screen.intro_imagem
                ? `
                    <img class="me-gancho-hero-image" src="/static/images/${encodeURIComponent(screen.intro_imagem)}" alt="" onerror="this.style.display='none'">
                    ${screen.intro_texto ? `<p class="me-diagrama-intro-texto">${escapeHtml(screen.intro_texto)}</p>` : ''}
                    ${(!isTimeline && screen.ponte_texto) ? `<p class="me-diagrama-ponte-texto">${escapeHtml(screen.ponte_texto)}</p>` : ''}
                `
                : '';

            // A escada já é a própria visualização — sem imagem de diagrama
            // por cima, e o painel de explicação ganha o formato "Nível X
            // de N" em vez do "did-you-know" genérico.
            const primeiroPonto = pontos[0] || {};
            const explicacaoHtml = isEscada
                ? `
                    <div class="me-escada-detail" id="meDiagramaExplicacao">
                        ${primeiroPonto.imagem ? `<img class="me-escada-detail-image" src="/static/images/${encodeURIComponent(primeiroPonto.imagem)}" alt="${escapeHtml(primeiroPonto.label || '')}" onerror="this.style.display='none'">` : ''}
                        <h4 class="me-escada-detail-title">${escapeHtml(primeiroPonto.label || '')}</h4>
                        <p class="me-escada-detail-text">${escapeHtml(primeiroPonto.explicacao || '')}</p>
                    </div>
                `
                : `<div class="me-diagrama-explicacao did-you-know" id="meDiagramaExplicacao" hidden></div>`;

            // Título + frase-ponte centrados por cima da linha temporal —
            // título primeiro, frase-ponte logo a seguir.
            const tituloPonteHtml = isTimeline
                ? `
                    ${screen.titulo ? `<h3 class="me-timeline-titulo">${escapeHtml(screen.titulo)}</h3>` : ''}
                    ${screen.ponte_texto ? `<p class="me-diagrama-ponte-texto me-timeline-ponte">${escapeHtml(screen.ponte_texto)}</p>` : ''}
                `
                : '';

            // Na timeline, a dica "Clica em cada marco..." passa a aparecer
            // por baixo da linha temporal (junto ao início da explicação),
            // em vez de por cima como nos outros formatos de diagrama.
            const instrucaoHtml = `<p class="plant-diagram-hint">${escapeHtml(screen.instrucao || 'Clica num ponto para veres a explicação.')}</p>`;

            const diagramaHtml = `
                ${isTimeline ? tituloPonteHtml : (screen.titulo ? `<h3>${escapeHtml(screen.titulo)}</h3>` : '')}
                ${isEscada ? '' : `<img class="card-visual" src="/static/images/${encodeURIComponent(screen.imagem)}" alt="${escapeHtml(screen.titulo || '')}" onerror="this.style.display='none'">`}
                ${isTimeline ? '' : instrucaoHtml}
                ${pontosHtml}
                ${isTimeline ? instrucaoHtml : ''}
                ${explicacaoHtml}
            `;

            // Com introdução (gancho fundido), tudo — imagem-isco, textos e
            // diagrama — partilha o mesmo painel branco em vez de flutuar
            // solto na página. A timeline recebe uma modificadora extra:
            // precisa de mais largura do que o painel estreito normal para
            // caberem os nomes em diagonal sem scroll horizontal (ver
            // .me-gancho-card--timeline, que quebra a coluna de leitura
            // estreita de .section-body tal como .plant-diagram-card).
            if (screen.intro_imagem) {
                const cardModifier = screen.layout === 'timeline' ? ' me-gancho-card--timeline' : '';
                return `
                    <div class="mascot-overlay-card me-mascot-inline me-gancho-card${cardModifier}">
                        ${introHtml}
                        ${diagramaHtml}
                    </div>
                `;
            }
            return diagramaHtml;
        }

        renderMicroVerificacao(section, screen, screenIndex) {
            const answerKey = `${section.secao_id}::${screenIndex}`;
            const saved = this.state.answers[answerKey];

            const optionsHtml = (screen.opcoes || []).map((opcao, i) => {
                let stateClass = '';
                if (saved) {
                    if (i === screen.correta) stateClass = 'correct';
                    else if (i === saved.selected) stateClass = 'incorrect';
                }
                return `
                    <button type="button" class="quiz-option ${stateClass}" data-option-index="${i}" ${saved ? 'disabled' : ''}>
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(opcao)}</span>
                    </button>
                `;
            }).join('');

            const feedbackHtml = saved
                ? this.buildFeedbackHtml(saved.correct, screen.mascote_feedback_certo, screen.mascote_feedback_errado)
                : '';

            return `
                ${this.mascotInlineCardHtml(screen.mascote_texto)}
                <p class="quiz-question">${escapeHtml(screen.pergunta)}</p>
                <div class="quiz-options" data-answer-key="${answerKey}">${optionsHtml}</div>
                ${feedbackHtml}
            `;
        }

        buildFeedbackHtml(isCorrect, textoCerto, textoErrado) {
            const mascotText = isCorrect ? textoCerto : textoErrado;
            const showMascotText = this.mascotEnabled() && mascotText;
            return `
                <div class="quiz-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
                    <span class="feedback-icon">${isCorrect ? '✓' : '✕'}</span>
                    <span class="feedback-text">${isCorrect ? 'Certo!' : 'Não é bem isso.'}${showMascotText ? ` ${escapeHtml(mascotText)}` : ''}</span>
                </div>
            `;
        }

        renderAnalogia(screen) {
            // O ícone do callout já assume o papel do 💡 — o guião escreve-o
            // também no início do texto, então tira-se aqui para não sair
            // duplicado no ecrã.
            const texto = (screen.texto || '').replace(/^\s*💡\s*/, '');
            return `
                ${this.mascotInlineCardHtml(screen.mascote_texto)}
                <div class="mission-intro-callout">
                    <span class="mission-intro-callout-icon">💡</span>
                    <div class="mission-intro-callout-text">${textToHtml(texto)}</div>
                </div>
            `;
        }

        renderAprofundar(screen) {
            return `
                <details class="did-you-know">
                    <summary>Queres saber mais? — ${escapeHtml(screen.titulo)}</summary>
                    <div class="did-you-know-body">
                        <div class="did-you-know-text">${textToHtml(screen.texto)}</div>
                    </div>
                </details>
            `;
        }

        getQuizState(section) {
            if (!this.state.quizState[section.secao_id]) {
                this.state.quizState[section.secao_id] = { current: 0, answers: [] };
            }
            return this.state.quizState[section.secao_id];
        }

        isQuizFullyAnswered(section, screen) {
            const quizState = this.getQuizState(section);
            return quizState.current >= (screen.perguntas || []).length;
        }

        renderQuizSeccao(section, screen) {
            const perguntas = screen.perguntas || [];
            const quizState = this.getQuizState(section);

            if (quizState.current >= perguntas.length) {
                const correctCount = quizState.answers.filter((a) => a.correct).length;
                const conclusaoHtml = this.mascotInlineCardHtml(screen.mascote_conclusao);
                return `
                    <h3>Resultado do quiz</h3>
                    <p class="quiz-question">${correctCount} / ${perguntas.length} corretas</p>
                    ${conclusaoHtml}
                `;
            }

            const introHtml = quizState.current === 0 ? this.mascotInlineCardHtml(screen.mascote_texto) : '';

            const questionIndex = quizState.current;
            const question = perguntas[questionIndex];
            const savedAnswer = quizState.answers[questionIndex];

            const optionsHtml = (question.opcoes || []).map((opcao, i) => {
                let stateClass = '';
                if (savedAnswer) {
                    if (i === question.correta) stateClass = 'correct';
                    else if (i === savedAnswer.selected) stateClass = 'incorrect';
                }
                return `
                    <button type="button" class="quiz-option ${stateClass}" data-quiz-option-index="${i}" ${savedAnswer ? 'disabled' : ''}>
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(opcao)}</span>
                    </button>
                `;
            }).join('');

            const feedbackHtml = savedAnswer
                ? this.buildFeedbackHtml(savedAnswer.correct, question.mascote_feedback_certo, question.mascote_feedback_errado)
                : '';

            const quizContinueHtml = savedAnswer
                ? `
                    <div class="lesson-quiz-actions">
                        <button type="button" class="lesson-primary-btn quiz-nav-btn--next" id="meQuizContinueBtn">${questionIndex === perguntas.length - 1 ? 'Ver resultado' : 'Continuar'}</button>
                    </div>
                `
                : '';

            return `
                ${introHtml}
                <p class="quiz-progress-label">Pergunta ${questionIndex + 1} de ${perguntas.length}</p>
                <p class="quiz-question">${escapeHtml(question.pergunta)}</p>
                <div class="quiz-options">${optionsHtml}</div>
                ${feedbackHtml}
                ${quizContinueHtml}
            `;
        }

        // ---- Interações -------------------------------------------------------

        bindScreenInteractions(section, screen, screenIndex) {
            if (screen.tipo === 'diagrama_interativo') {
                const isEscada = screen.layout === 'escada';
                const explicacaoEl = this.root.querySelector('#meDiagramaExplicacao');
                this.root.querySelectorAll('[data-ponto-index]').forEach((chip) => {
                    chip.addEventListener('click', () => {
                        const ponto = screen.pontos[Number(chip.dataset.pontoIndex)];
                        if (isEscada) {
                            this.root.querySelectorAll('.me-escada-step').forEach((c) => c.classList.remove('is-active'));
                            chip.classList.add('is-active');
                            if (explicacaoEl) {
                                explicacaoEl.innerHTML = `
                                    ${ponto.imagem ? `<img class="me-escada-detail-image" src="/static/images/${encodeURIComponent(ponto.imagem)}" alt="${escapeHtml(ponto.label)}" onerror="this.style.display='none'">` : ''}
                                    <h4 class="me-escada-detail-title">${escapeHtml(ponto.label)}</h4>
                                    <p class="me-escada-detail-text">${escapeHtml(ponto.explicacao)}</p>
                                `;
                            }
                            return;
                        }
                        this.root.querySelectorAll('.me-diagrama-chip').forEach((c) => c.classList.remove('is-active'));
                        chip.classList.add('is-active');
                        if (explicacaoEl) {
                            explicacaoEl.hidden = false;
                            // ponto.imagem/ponto.intro são opcionais — um
                            // ponto (ex: Robert Hooke) pode ter foto própria
                            // e uma frase de abertura antes da explicação em
                            // si, para ligar ao contexto da secção.
                            const fotoHtml = ponto.imagem
                                ? `<img class="curiosity-illustration" src="/static/images/${encodeURIComponent(ponto.imagem)}" alt="${escapeHtml(ponto.label)}" onerror="this.remove()">`
                                : '';
                            const introHtml = ponto.intro
                                ? `<p class="me-diagrama-explicacao-intro">${escapeHtml(ponto.intro)}</p>`
                                : '';
                            explicacaoEl.innerHTML = `
                                <div class="did-you-know-body">
                                    ${fotoHtml}
                                    <div class="did-you-know-text">
                                        <strong>${escapeHtml(ponto.label)}</strong>
                                        ${introHtml}
                                        <p>${escapeHtml(ponto.explicacao)}</p>
                                    </div>
                                </div>
                            `;
                        }
                    });
                });
            }

            if (screen.tipo === 'micro_verificacao') {
                const answerKey = `${section.secao_id}::${screenIndex}`;
                if (!this.state.answers[answerKey]) {
                    this.root.querySelectorAll('[data-option-index]').forEach((btn) => {
                        btn.addEventListener('click', () => {
                            const selected = Number(btn.dataset.optionIndex);
                            this.state.answers[answerKey] = { selected, correct: selected === screen.correta };
                            this.saveState();
                            this.render();
                        });
                    });
                }
            }

            if (screen.tipo === 'quiz_seccao') {
                const quizState = this.getQuizState(section);
                const perguntas = screen.perguntas || [];

                if (quizState.current < perguntas.length) {
                    const question = perguntas[quizState.current];
                    const savedAnswer = quizState.answers[quizState.current];

                    if (!savedAnswer) {
                        this.root.querySelectorAll('[data-quiz-option-index]').forEach((btn) => {
                            btn.addEventListener('click', () => {
                                const selected = Number(btn.dataset.quizOptionIndex);
                                quizState.answers[quizState.current] = { selected, correct: selected === question.correta };
                                this.saveState();
                                this.render();
                            });
                        });
                    }

                    this.root.querySelector('#meQuizContinueBtn')?.addEventListener('click', () => {
                        quizState.current += 1;
                        this.saveState();
                        this.render();
                    });
                }
            }
        }

        // ---- Conclusão da missão -----------------------------------------------

        completeMission() {
            const totalXP = this.totalMissionXP();

            if (window.ProfileXP) {
                window.ProfileXP.awardXPToCurrentUser(
                    totalXP,
                    window.ProfileXP.buildRewardSource ? window.ProfileXP.buildRewardSource('missao', this.missao.missao_id) : undefined
                );
            }

            this.syncProgressWithDjango(totalXP);

            this.state.view = 'celebracao';
            this.state.celebrationShown = true;
            this.saveState();
            this.render();
        }

        syncProgressWithDjango(totalXP) {
            if (!this.progressSyncUrl || !this.csrfToken) return;

            const sectionScores = {};
            this.sections.forEach((section) => {
                const quizScreen = (section.ecrãs || []).find((e) => e.tipo === 'quiz_seccao');
                const quizState = this.state.quizState[section.secao_id];
                if (quizScreen && quizState && quizState.answers.length) {
                    const correct = quizState.answers.filter((a) => a.correct).length;
                    sectionScores[section.secao_id] = Math.round((correct / quizScreen.perguntas.length) * 100);
                }
            });

            const xpAfter = window.ProfileXP
                ? window.ProfileXP.getProfileStats(window.ProfileXP.getCurrentUserProfile()).xp
                : totalXP;

            fetch(this.progressSyncUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                credentials: 'same-origin',
                body: JSON.stringify({
                    missionId: this.missao.missao_id,
                    progress: {
                        totalSections: this.sections.length,
                        completedSections: this.state.completedSections,
                        sectionScores
                    },
                    xp: xpAfter
                })
            }).catch(() => {
                // Fire-and-forget — o progresso local (localStorage) já foi guardado.
            });
        }

        renderCelebration() {
            const totalXP = this.totalMissionXP();
            const confettiHtml = Array.from({ length: 60 }, (_, i) => {
                const left = Math.random() * 100;
                const delay = Math.random() * 1.2;
                const duration = 2.2 + Math.random() * 1.6;
                const hue = Math.floor(Math.random() * 360);
                return `<span class="me-confetti-piece" style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s; background:hsl(${hue}, 80%, 60%);"></span>`;
            }).join('');

            this.root.innerHTML = `
                <div class="me-shell me-shell--celebracao">
                    <div class="me-confetti">${confettiHtml}</div>
                    <div class="me-celebracao-card">
                        ${this.missao.badge?.icone ? `<span class="me-celebracao-badge">${this.missao.badge.icone}</span>` : '<span class="me-celebracao-badge">🏆</span>'}
                        <h1>Missão concluída!</h1>
                        <p>Completaste "${escapeHtml(this.missao.titulo)}".</p>
                        <div class="me-celebracao-xp">
                            <span>+</span><span id="meCelebracaoXpValue">0</span><span>XP</span>
                        </div>
                        <button type="button" class="lesson-primary-btn" id="meCelebracaoContinueBtn">Voltar ao mapa de missões</button>
                    </div>
                </div>
            `;

            const valueEl = this.root.querySelector('#meCelebracaoXpValue');
            if (valueEl) {
                const start = performance.now();
                const durationMs = 1200;
                const tick = (now) => {
                    const progress = Math.min(1, (now - start) / durationMs);
                    valueEl.textContent = Math.round(progress * totalXP);
                    if (progress < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }

            this.root.querySelector('#meCelebracaoContinueBtn')?.addEventListener('click', () => {
                // Sem isto, uma visita futura a esta missão (voltar atrás,
                // ou reabrir o link) encontrava view:'celebracao' guardado
                // e mostrava sempre a festa de novo em vez do mapa.
                this.state.view = 'mapa';
                this.saveState();
                window.location.href = this.missionsIndexUrl;
            });
        }
    }

    window.MissaoEngine = MissaoEngine;
})();
