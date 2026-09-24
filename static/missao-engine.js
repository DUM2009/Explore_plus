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
            this.activityHeartbeatUrl = options.activityHeartbeatUrl || window.exploreActivityHeartbeatUrl || '';
            this.csrfToken = options.csrfToken || window.exploreCsrfToken || '';
            this.mascoteChatUrl = options.mascoteChatUrl || window.exploreMascoteChatUrl || '';
            this.mascotWaveVideoUrl = options.mascotWaveVideoUrl || window.exploreMascotWaveVideoUrl || '';
            this.mascotDoubtsImageUrl = options.mascotDoubtsImageUrl || window.exploreMascotDoubtsImageUrl || '';

            // Estado do painel de chat — não persiste em localStorage (tal
            // como na Fotossíntese, o chat começa sempre fechado e sem
            // histórico a cada visita/recarregamento da página).
            this.chatOpen = false;
            this.chatHistory = [];
            this.chatLimitReached = false;
            this._lastGanchoPopupKey = null;
            // Flutuante (padrão) vs. fixo na barra lateral — mesma chave e
            // comportamento do botão de expandir da Fotossíntese (ver
            // initChatDockToggle em mission.js), para a preferência ficar
            // consistente entre as duas missões.
            this.chatDocked = this.loadChatDockedPref();
            // Largura do painel quando fixo (arrastando meSidebarResizeHandle,
            // ver bindSidebarResize) — guardada à parte porque o render()
            // recria o <aside> do zero a cada chamada, perdendo qualquer
            // estilo aplicado diretamente ao elemento anterior. Mesmos
            // limites da Fotossíntese (ver initSidebarResize em mission.js).
            this.SIDEBAR_MIN_WIDTH = 240;
            this.SIDEBAR_MAX_WIDTH = 520;
            this.sidebarWidth = this.loadSidebarWidthPref();

            this.storageKey = this.buildStorageKey();
            this.state = this.loadState();

            this.render();
            window.addEventListener('explore:mascot-prefs-changed', () => this.render());
            this.startActivityHeartbeat();
        }

        /** Regista tempo de estudo (para "Hábitos de estudo" nas
         *  Estatísticas) — um ping por minuto, só enquanto o separador
         *  estiver mesmo visível, para não contar tempo com a aba em
         *  segundo plano. Falhas são silenciosas: isto é telemetria, não
         *  deve nunca bloquear ou quebrar a missão em si. */
        startActivityHeartbeat() {
            if (!this.activityHeartbeatUrl) return;
            const enviarPing = () => {
                if (document.visibilityState !== 'visible') return;
                fetch(this.activityHeartbeatUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                    body: JSON.stringify({ minutos: 1 }),
                }).catch(() => {});
            };
            setInterval(enviarPing, 60000);
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
                celebrationShown: false,
                // XP already paid out per screen — "<secao_id>::<screenIndex>"
                // -> amount. Keyed per screen so re-entering an already-paid
                // page (Anterior, then Próximo again) never pays twice, and
                // going back never removes an entry (see awardPageXP).
                xpAwardedPages: {}
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

        /** Ícone do botão de expandir/flutuar o chat — mesmos dois traçados
         *  do botão equivalente na Fotossíntese (ver initChatDockToggle em
         *  mission.js), para o símbolo ser reconhecível nas duas missões. */
        chatDockIconSvg() {
            const DOCK_ICON = '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>';
            const FLOAT_ICON = '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>';
            return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${this.chatDocked ? FLOAT_ICON : DOCK_ICON}</svg>`;
        }

        loadChatDockedPref() {
            try {
                return localStorage.getItem('explore_mission_chat_docked') === '1';
            } catch (error) {
                return false;
            }
        }

        saveChatDockedPref(isDocked) {
            try {
                localStorage.setItem('explore_mission_chat_docked', isDocked ? '1' : '0');
            } catch (error) {
                // Ignore storage errors — o botão continua a funcionar
                // nesta visita, só não fica guardado.
            }
        }

        loadSidebarWidthPref() {
            try {
                const saved = Number(localStorage.getItem('explore_mission_sidebar_width'));
                if (Number.isFinite(saved) && saved > 0) {
                    return Math.max(this.SIDEBAR_MIN_WIDTH, Math.min(this.SIDEBAR_MAX_WIDTH, saved));
                }
            } catch (error) {
                // Ignore storage access errors (private browsing).
            }
            return 280;
        }

        saveSidebarWidthPref(width) {
            try {
                localStorage.setItem('explore_mission_sidebar_width', String(width));
            } catch (error) {
                // Ignore storage errors — o arrastar continua a funcionar
                // nesta visita, só não fica guardado.
            }
        }

        // ---- Helpers de missão ---------------------------------------------

        get sections() {
            return this.missao.secoes || [];
        }

        getSection(index) {
            return this.sections[index];
        }

        // ---- XP por página ----------------------------------------------------
        // Cada ecrã (página) da missão vale 15 XP ao avançar por ele pela
        // primeira vez; o quiz_seccao é a exceção — a sua recompensa depende
        // do desempenho (ver computeQuizSectionXP). Isto substitui o antigo
        // modelo de XP fixo por secção (o campo "xp" no JSON já não é usado
        // para calcular recompensas).

        /** Maior XP que um ecrã pode valer — usado só para os badges de
         *  "recompensa" mostrados antes de começar (mapa da missão), que
         *  mostram o melhor cenário possível (quiz 100% certo). */
        screenMaxXP(screen) {
            return screen.tipo === 'quiz_seccao' ? 30 : 15;
        }

        sectionMaxXP(section) {
            return (section.ecrãs || []).reduce((sum, screen) => sum + this.screenMaxXP(screen), 0);
        }

        totalMissionXP() {
            return this.sections.reduce((sum, s) => sum + this.sectionMaxXP(s), 0);
        }

        /** Soma do que já foi mesmo pago (ver awardPageXP) — usado na
         *  celebração final, ao contrário de totalMissionXP() (que é só a
         *  pré-visualização do melhor cenário possível). */
        totalMissionXpEarned() {
            return Object.values(this.state.xpAwardedPages || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
        }

        /** Recompensa do quiz de secção, consoante o desempenho: tudo certo
         *  = 30 XP; pelo menos metade certo (mas não tudo) = 15 XP; menos de
         *  metade (incluindo zero) = 5 XP. */
        computeQuizSectionXP(section, screen) {
            const totalQuestions = (screen.perguntas || []).length;
            if (totalQuestions === 0) return 5;
            const quizState = this.state.quizState[section.secao_id];
            const correct = quizState ? quizState.answers.filter((a) => a.correct).length : 0;
            if (correct === totalQuestions) return 30;
            if (correct >= totalQuestions / 2) return 15;
            return 5;
        }

        /** Paga a recompensa de um ecrã exatamente uma vez — a chave
         *  (secao::índice do ecrã) já ficar registada em xpAwardedPages
         *  impede um segundo pagamento se o aluno voltar a passar por este
         *  ecrã (Anterior e depois Próximo outra vez); nada aqui alguma vez
         *  remove uma entrada, por isso ir para trás nunca tira XP já
         *  ganho. */
        awardPageXP(section, screenIndex, screen) {
            const key = `${section.secao_id}::${screenIndex}`;
            if (this.state.xpAwardedPages[key]) return;

            const amount = screen.tipo === 'quiz_seccao'
                ? this.computeQuizSectionXP(section, screen)
                : 15;

            this.state.xpAwardedPages[key] = amount;
            this.saveState();

            if (window.ProfileXP) {
                // A source tem de ser única por página, não só por missão —
                // awardXPToCurrentUser recusa silenciosamente (0 XP, sem
                // erro) uma segunda chamada com a mesma source, para nunca
                // pagar duas vezes a mesma recompensa. Usar sempre
                // "missao:<id>" aqui faria com que só a primeira página
                // desta missão alguma vez desse XP a sério.
                const source = window.ProfileXP.buildRewardSource
                    ? window.ProfileXP.buildRewardSource('missao', `${this.missao.missao_id}:${key}`)
                    : undefined;
                window.ProfileXP.awardXPToCurrentUser(amount, source);
            }
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
                            <span class="mo-index-icon" style="background:#1f8a5b22; color:#1f8a5b">${section.icone || (index + 1)}</span>
                            <span class="mo-index-copy">
                                <strong>${escapeHtml(section.titulo)}</strong>
                                <span>~${section.tempo_estimado_min || 0} min</span>
                            </span>
                            <span class="mo-index-meta">
                                ${statusHtml}
                                <span class="mo-index-xp">${xpStarIconSvg} +${this.sectionMaxXP(section)} XP</span>
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

        /** Deixa arrastar a fronteira entre a barra lateral e o conteúdo
         *  principal para alargar/apertar o painel de chat — mesma lógica
         *  de initSidebarResize em mission.js (Fotossíntese), adaptada para
         *  gravar a largura em this.sidebarWidth em vez de só no elemento,
         *  porque aqui o <aside> é recriado do zero a cada render(). Só faz
         *  algo quando o chat está fixo (.is-chat-docked) — flutuante não
         *  tem a pega visível (ver CSS). */
        bindSidebarResize() {
            const handle = this.root.querySelector('#meSidebarResizeHandle');
            const sidebar = this.root.querySelector('#meMissionSidebar');
            if (!handle || !sidebar) return;

            const applyWidth = (width) => {
                const clamped = Math.max(this.SIDEBAR_MIN_WIDTH, Math.min(this.SIDEBAR_MAX_WIDTH, width));
                sidebar.style.setProperty('--mission-sidebar-width', `${clamped}px`);
                this.sidebarWidth = clamped;
                return clamped;
            };

            let startX = 0;
            let startWidth = 0;

            const onPointerMove = (event) => {
                // A barra lateral fica à direita, por isso arrastar para a
                // esquerda (delta negativo em clientX) é o que a alarga —
                // sinal invertido em relação a um painel fixo à esquerda.
                const width = applyWidth(startWidth - (event.clientX - startX));
                this.saveSidebarWidthPref(width);
            };

            const onPointerUp = () => {
                handle.classList.remove('is-dragging');
                document.body.style.removeProperty('cursor');
                document.body.style.removeProperty('user-select');
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
            };

            handle.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                startX = event.clientX;
                startWidth = sidebar.getBoundingClientRect().width;
                handle.classList.add('is-dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
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
            return `<span class="me-mascot-avatar--fallback"></span>`;
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
                    ${this.mascotDoubtsImageUrl ? `<img src="${this.mascotDoubtsImageUrl}" class="mascote-chat-welcome-video" alt="Mascote com dúvidas">` : ''}
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
            // Limpa a marca de "popup já mostrado" ao mudar de ecrã, para
            // que voltar a um ecrã já visitado (ex: "Anterior") reavalie
            // showEntryPopupIfNeeded do zero em vez de assumir que já foi
            // tratado da última vez que lá se esteve.
            this._lastGanchoPopupKey = null;
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
                    xpStat = `<span class="lesson-stat">${stats.xp} XP</span>`;
                } catch (error) {
                    xpStat = '';
                }
            }

            this.root.innerHTML = `
                <div class="mission-shell ${this.chatOpen ? '' : 'is-sidebar-collapsed'} ${this.chatDocked ? 'is-chat-docked' : ''}">
                    <aside class="mission-sidebar" id="meMissionSidebar" style="--mission-sidebar-width:${this.sidebarWidth}px">
                        <div class="mascote-chat-panel">
                            <div class="mascote-chat-header">
                                <button type="button" class="mascote-chat-close" id="meChatCloseBtn" aria-label="Fechar o chat">✕</button>
                                <span>Fala com a mascote</span>
                                <button type="button" class="mascote-chat-dock-btn" id="meChatDockBtn" aria-label="${this.chatDocked ? 'Flutuar o chat' : 'Fixar o chat à página'}">
                                    ${this.chatDockIconSvg()}
                                </button>
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
                    <div class="mission-sidebar-resize-handle" id="meSidebarResizeHandle"></div>
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
                // "Anterior" só troca de ecrã — nunca mexe na pergunta
                // atual do quiz (isso é o par de setas dentro do próprio
                // painel, ver #meQuizPrevQuestionBtn/#meQuizContinueBtn em
                // renderQuizSeccao/bindScreenInteractions).
                this.setScreenIndex(section, screenIndex - 1);
                this.render();
            });

            this.root.querySelector('#meNextBtn')?.addEventListener('click', () => {
                this.advance(section, sectionIndex, screenIndex, screens);
            });

            this.bindThemeToggle(this.root.querySelector('#meThemeToggle'));
            this.bindSidebarResize();

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

            this.root.querySelector('#meChatDockBtn')?.addEventListener('click', () => {
                this.chatDocked = !this.chatDocked;
                this.saveChatDockedPref(this.chatDocked);
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
            // Paga a página que está a ser deixada para trás — antes de
            // qualquer outra mudança de estado, para o quiz_seccao (sempre a
            // última página de uma secção) já ter a secção incluída em
            // completedSections quando syncProgressWithDjango correr mais
            // abaixo.
            this.awardPageXP(section, screenIndex, screens[screenIndex]);

            const isLastScreen = screenIndex === screens.length - 1;

            if (!isLastScreen) {
                this.setScreenIndex(section, screenIndex + 1);
                this.syncProgressWithDjango();
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
            this.syncProgressWithDjango();
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
         * Procura, para trás a partir de screenIndex, o ecrã de gancho ou
         * diagrama mais recente (ex: o do lago com os peixes) — usado como
         * pano de fundo visual atrás do popup de uma pergunta de
         * micro-verificação (ver renderMicroVerificacao), para o conteúdo
         * a que a pergunta se refere continuar visível.
         */
        findBackdropScreen(section, screenIndex) {
            const screens = section.ecrãs || [];
            for (let i = screenIndex - 1; i >= 0; i--) {
                if (screens[i].tipo === 'gancho' || screens[i].tipo === 'diagrama_interativo') {
                    return screens[i];
                }
            }
            return null;
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
                : `<span class="mascot-overlay-figure me-mascot-avatar--fallback"></span>`;
            return `
                <div class="mascot-overlay-card mascot-overlay-card--split me-mascot-inline">
                    <div class="mascot-overlay-split-figure">${figureHtml}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text">${escapeHtml(texto).replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        }

        renderGancho(screen) {
            // A fala da mascote nunca aparece inline aqui — todo ecrã de
            // gancho com mascote_texto abre num popup à parte (mascote à
            // esquerda, texto à direita — ver showMascotPopup, chamado
            // pelo renderSeccao/showEntryPopupIfNeeded). O painel deste
            // ecrã só leva a imagem própria (quando existe) e o título.
            if (screen.imagem) {
                return `
                    <div class="mascot-overlay-card me-mascot-inline me-gancho-card">
                        <img class="me-gancho-hero-image" src="/static/images/${encodeURIComponent(screen.imagem)}" alt="${escapeHtml(screen.titulo || '')}" onerror="this.style.display='none'">
                        <h3 class="screen-title-lg">${escapeHtml(screen.texto)}</h3>
                    </div>
                `;
            }
            return `
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
            if (this.mascotDoubtsImageUrl) {
                return `<img class="mascot-overlay-figure" src="${this.mascotDoubtsImageUrl}" alt="Mascote com dúvidas">`;
            }
            if (this.mascotImageUrl) {
                return `<img class="mascot-overlay-figure" src="${this.mascotImageUrl}" alt="Mascote">`;
            }
            return `<span class="mascot-overlay-figure me-mascot-avatar--fallback"></span>`;
        }

        showMascotPopup(texto) {
            if (!this.mascotEnabled() || !texto) return;
            document.querySelector('.me-mascot-popup')?.remove();

            const overlay = document.createElement('div');
            overlay.className = 'mascot-overlay me-mascot-popup';
            overlay.innerHTML = `
                <div class="mascot-overlay-card mascot-overlay-card--split" role="dialog" aria-modal="true" aria-label="Mensagem da mascote">
                    <button type="button" class="mascot-overlay-close" aria-label="Fechar">✕</button>
                    <div class="mascot-overlay-split-figure">${this.mascotOverlayFigureHtml()}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text">${escapeHtml(texto).replace(/\n/g, '<br>')}</p>
                        <button type="button" class="mascot-overlay-btn">Bora!</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) close();
            });
            overlay.querySelector('.mascot-overlay-btn')?.addEventListener('click', close);
            overlay.querySelector('.mascot-overlay-close')?.addEventListener('click', close);
        }

        /** Só mostra o popup na primeira vez que se entra neste ecrã em
         *  concreto — reentradas por causa de outro re-render (ex: abrir/
         *  fechar o chat) não o voltam a mostrar. */
        showEntryPopupIfNeeded(section, screen, screenIndex) {
            const popupKey = `${section.secao_id}::${screenIndex}`;
            if (this._lastGanchoPopupKey === popupKey) return;

            // Nas analogias sem cartao_estilo, o mascote_texto já aparece
            // inline (ver mascotInlineCardHtml em renderAnalogia) — só as
            // de cartao_estilo (sem esse cartão inline) entram aqui, para
            // não sair duplicado (popup + cartão inline ao mesmo tempo).
            const temGancho = screen.tipo === 'gancho'
                || screen.tipo === 'diagrama_interativo'
                || (screen.tipo === 'analogia' && screen.cartao_estilo);
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
                return;
            }

            // Perguntas de micro-verificação: a pergunta e as opções
            // aparecem sempre num popup (mascote à esquerda, pergunta +
            // opções à direita) ao entrar neste ecrã — tanto na primeira
            // vez como ao voltar a ele com "Anterior" (nesse caso em modo
            // de revisão, já com a resposta e o feedback visíveis) — para
            // nunca haver um ecrã por baixo só com o feedback (ver
            // renderMicroVerificacao).
            if (screen.tipo === 'micro_verificacao' && screen.pergunta) {
                this._lastGanchoPopupKey = popupKey;
                this.showMicroVerificacaoPopup(section, screen, screenIndex);
            }
        }

        /**
         * Popup de pergunta: igual ao mascot-overlay-card--split (mascote à
         * esquerda), mas o lado direito é a própria pergunta com as opções
         * clicáveis, em vez de só texto + botão "Entendido" — responder
         * aqui grava a resposta tal como responder no ecrã (mesma
         * data-option-index e mesma chave em this.state.answers, ver
         * bindScreenInteractions). O feedback (certo/errado) aparece dentro
         * do próprio popup, junto da mascote e da pergunta. Se a pergunta
         * já tinha sido respondida antes (ex: ao rever com "Anterior", ou um
         * aluno que já terminou o quiz e está a rever a matéria), abre logo
         * em modo de revisão — opções e feedback já preenchidos — e
         * "Continuar" (tal como o X e clicar fora) só fecha o popup, sem
         * avançar de ecrã. Avançar automaticamente aqui prendia quem revê
         * para trás com "Anterior" num ciclo: o clique em "Continuar"
         * empurrava-o de volta para a frente, e o "Anterior" seguinte
         * voltava a mostrar o mesmo popup.
         */
        showMicroVerificacaoPopup(section, screen, screenIndex) {
            if (!this.mascotEnabled()) return;
            document.querySelector('.me-mascot-popup')?.remove();

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

            const feedbackSlotHtml = saved
                ? `
                    ${this.buildFeedbackHtml(saved.correct, screen.mascote_feedback_certo, screen.mascote_feedback_errado)}
                    <button type="button" class="mascot-overlay-btn">Continuar</button>
                `
                : '';

            const overlay = document.createElement('div');
            overlay.className = 'mascot-overlay me-mascot-popup';
            overlay.innerHTML = `
                <div class="mascot-overlay-card mascot-overlay-card--split" role="dialog" aria-modal="true" aria-label="Pergunta">
                    <button type="button" class="mascot-overlay-close" aria-label="Fechar">✕</button>
                    <div class="mascot-overlay-split-figure">${this.mascotOverlayFigureHtml()}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text quiz-question">${escapeHtml(screen.pergunta)}</p>
                        <div class="quiz-options" data-answer-key="${answerKey}">${optionsHtml}</div>
                        <div class="me-popup-feedback-slot">${feedbackSlotHtml}</div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            if (saved) {
                // Modo de revisão: já respondida antes — "Continuar", o X e
                // clicar fora fecham sem avançar de ecrã, para o aluno poder
                // navegar livremente (para a frente ou para trás) com as
                // setas da própria página.
                const closeReview = () => overlay.remove();
                overlay.querySelector('.mascot-overlay-btn')?.addEventListener('click', closeReview);
                overlay.querySelector('.mascot-overlay-close')?.addEventListener('click', closeReview);
                overlay.addEventListener('click', (event) => {
                    if (event.target === overlay) closeReview();
                });
                return;
            }

            const screens = section.ecrãs || [];
            const sectionIndex = this.state.activeSectionIndex;

            // O X fecha sem responder nem avançar — o aluno volta a ver o
            // ecrã por baixo (o diagrama/gancho, via findBackdropScreen em
            // renderMicroVerificacao) e reabre a pergunta ao navegar de novo
            // para este ecrã (ver showEntryPopupIfNeeded).
            overlay.querySelector('.mascot-overlay-close')?.addEventListener('click', () => overlay.remove());

            // Sem botão de "Entendido" nem fecho ao clicar fora: como o
            // ecrã por baixo já não mostra a pergunta/opções nem repete o
            // feedback (ver renderMicroVerificacao), o botão "Continuar"
            // (depois de responder) avança logo para o ecrã seguinte, em
            // vez de deixar o aluno num ecrã residual só com o feedback.
            overlay.querySelectorAll('[data-option-index]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const selected = Number(btn.dataset.optionIndex);
                    const correct = selected === screen.correta;
                    this.state.answers[answerKey] = { selected, correct };
                    this.saveState();

                    overlay.querySelectorAll('[data-option-index]').forEach((optionBtn) => {
                        const optionIndex = Number(optionBtn.dataset.optionIndex);
                        optionBtn.disabled = true;
                        if (optionIndex === screen.correta) optionBtn.classList.add('correct');
                        else if (optionIndex === selected) optionBtn.classList.add('incorrect');
                    });

                    const slot = overlay.querySelector('.me-popup-feedback-slot');
                    if (slot) {
                        slot.innerHTML = `
                            ${this.buildFeedbackHtml(correct, screen.mascote_feedback_certo, screen.mascote_feedback_errado)}
                            <button type="button" class="mascot-overlay-btn">Continuar</button>
                        `;
                        slot.querySelector('.mascot-overlay-btn')?.addEventListener('click', () => {
                            overlay.remove();
                            this.advance(section, sectionIndex, screenIndex, screens);
                        });
                    }
                });
            });
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

        /** Botão colapsável "Saber mais" com ponto.saber_mais, se existir —
         *  usado tanto no cartão "Nível X de N" (pontoDetailInnerHtml) como
         *  no painel "did-you-know" genérico (ver bindDiagramaChips), para
         *  não duplicar este bocado de HTML nos dois formatos. */
        saberMaisHtml(ponto) {
            if (!ponto.saber_mais) return '';
            return `
                <details class="me-ponto-saber-mais">
                    <summary>Saber mais</summary>
                    <p>${escapeHtml(ponto.saber_mais)}</p>
                </details>
            `;
        }

        /**
         * Conteúdo do cartão "Nível X de N" (ver .me-escada-detail no CSS) —
         * imagem opcional, título, explicação e o botão "Saber mais" (ver
         * saberMaisHtml). Reaproveitado tanto no primeiro render (escada/
         * árvore/cartao_estilo, sempre com um ponto pré-selecionado) como
         * no clique num ponto (ver bindDiagramaChips), para não duplicar
         * este bocado de HTML nos dois sítios.
         */
        pontoDetailInnerHtml(ponto) {
            return `
                ${ponto.imagem ? `<img class="me-escada-detail-image" src="/static/images/${encodeURIComponent(ponto.imagem)}" alt="${escapeHtml(ponto.label || '')}" onerror="this.style.display='none'">` : ''}
                <h4 class="me-escada-detail-title">${escapeHtml(ponto.label || '')}</h4>
                <p class="me-escada-detail-text">${escapeHtml(ponto.explicacao || '')}</p>
                ${this.saberMaisHtml(ponto)}
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

        /**
         * Formato "árvore": pontos de topo (sem screen.pai) numa lista
         * vertical, com os filhos de cada um (pontos cujo "pai" é o id
         * desse ponto de topo) indentados por baixo, ligados por uma linha
         * — para grupos com dois níveis (ex: célula procariótica/
         * eucariótica, e esta última a dividir-se em animal/vegetal), em
         * vez de um formato plano onde essa relação não se via. Reaproveita
         * data-ponto-index (o índice real em screen.pontos) para o clique,
         * tal como os outros formatos.
         */
        renderDiagramaArvore(pontos) {
            const nodeHtml = (ponto, index, isFilho) => `
                <button type="button" class="me-arvore-node ${isFilho ? 'me-arvore-node--filho' : ''} ${index === 0 ? 'is-active' : ''}" data-ponto-index="${index}">
                    ${escapeHtml(ponto.label)}
                </button>
            `;
            // Organograma clássico (ligações em "chavena" entre irmãos, tronco
            // vertical até ao pai) em vez da lista indentada anterior — <ul>
            // aninhados, um por cada ponto de topo com filhos, com as linhas
            // desenhadas a CSS (ver .me-arvore-tree).
            const topo = pontos.filter((ponto) => !ponto.pai);
            const itensHtml = topo.map((ponto) => {
                const index = pontos.indexOf(ponto);
                const filhos = pontos.filter((filho) => filho.pai === ponto.id);
                const filhosHtml = filhos.length
                    ? `
                        <ul>
                            ${filhos.map((filho) => `
                                <li>${nodeHtml(filho, pontos.indexOf(filho), true)}</li>
                            `).join('')}
                        </ul>
                    `
                    : '';
                return `
                    <li>
                        ${nodeHtml(ponto, index, false)}
                        ${filhosHtml}
                    </li>
                `;
            }).join('');
            return `<div class="me-arvore-wrap"><ul class="me-arvore-tree">${itensHtml}</ul></div>`;
        }

        /**
         * Formato "mapa": a própria imagem do diagrama com um marcador
         * numerado sobre cada ponto (posicionado por percentagem, via
         * ponto.pos.x/ponto.pos.y — 0-100, relativo ao canto superior
         * esquerdo da imagem), em vez de uma fila de chips ao lado. Para
         * quando a imagem já mostra visualmente onde cada estrutura está
         * (ex: os organelos numa célula) e faz mais sentido apontar
         * diretamente para lá do que descrever por texto. Reaproveita
         * data-ponto-index para o clique, tal como os outros formatos.
         */
        renderDiagramaMapa(screen, pontos) {
            const marcadoresHtml = pontos.map((ponto, i) => {
                const x = (ponto.pos && typeof ponto.pos.x === 'number') ? ponto.pos.x : 50;
                const y = (ponto.pos && typeof ponto.pos.y === 'number') ? ponto.pos.y : 50;
                return `
                    <button type="button" class="me-mapa-marker ${i === 0 ? 'is-active' : ''}" data-ponto-index="${i}" style="left:${x}%; top:${y}%;" aria-label="${escapeHtml(ponto.label)}" title="${escapeHtml(ponto.label)}">
                        <span class="me-mapa-marker-num">${i + 1}</span>
                    </button>
                `;
            }).join('');
            return `
                <div class="me-mapa-wrap">
                    <img class="me-mapa-image" src="/static/images/${encodeURIComponent(screen.imagem)}" alt="${escapeHtml(screen.titulo || '')}" onerror="this.style.display='none'">
                    ${marcadoresHtml}
                </div>
            `;
        }

        renderDiagrama(screen) {
            const pontos = screen.pontos || [];
            const isEscada = screen.layout === 'escada';
            const isTimeline = screen.layout === 'timeline';
            const isArvore = screen.layout === 'arvore';
            const isMapa = screen.layout === 'mapa';
            // screen.cartao_estilo pré-seleciona o primeiro chip (tal como
            // a escada), para o cartão branco já aparecer preenchido em vez
            // de escondido à espera de um clique.
            const pontosHtml = isEscada
                ? this.renderDiagramaEscada(pontos)
                : isTimeline
                    ? this.renderDiagramaTimeline(pontos)
                    : isArvore
                        ? this.renderDiagramaArvore(pontos)
                        : isMapa
                            ? this.renderDiagramaMapa(screen, pontos)
                            : `<div class="me-diagrama-chips">${pontos.map((ponto, i) => `
                        <button type="button" class="me-diagrama-chip ${(screen.cartao_estilo && i === 0) ? 'is-active' : ''}" data-ponto-index="${i}">
                            <span class="me-diagrama-chip-num">${i + 1}</span>
                            <span>${escapeHtml(ponto.label)}</span>
                        </button>
                    `).join('')}</div>`;

            // Introdução opcional (gancho fundido neste ecrã, ver
            // showMascotPopupIfNeeded): imagem + frase-isco + frase-ponte a
            // ligar esse isco ao diagrama que se segue. A imagem é opcional
            // — a frase-ponte, sozinha, já chega para fundir o gancho neste
            // ecrã (ver hasIntro abaixo). Na timeline, o título e a
            // frase-ponte saem daqui — passam a aparecer juntos por cima da
            // própria linha temporal (ver tituloPonteHtml).
            const hasIntro = Boolean(screen.intro_imagem || screen.intro_texto || (!isTimeline && screen.ponte_texto));
            const hasIntroTexto = Boolean(screen.intro_texto || (!isTimeline && screen.ponte_texto));
            // Isco + ponte partilham uma caixa com traço fino (ver
            // .me-diagrama-intro-bloco no CSS) para se lerem como um bloco
            // único, separado da imagem por cima e do diagrama por baixo —
            // screen.intro_sem_caixa salta essa caixa (só texto solto),
            // para quando o guião pede o texto sem painel à volta.
            const introParagrafosHtml = `
                ${screen.intro_texto ? `<p class="me-diagrama-intro-texto">${escapeHtml(screen.intro_texto)}</p>` : ''}
                ${(!isTimeline && screen.ponte_texto) ? `<p class="me-diagrama-ponte-texto">${escapeHtml(screen.ponte_texto)}</p>` : ''}
            `;
            const introTextoHtml = hasIntroTexto
                ? (screen.intro_sem_caixa
                    ? introParagrafosHtml
                    : `<div class="me-diagrama-intro-bloco">${introParagrafosHtml}</div>`)
                : '';
            const introHtml = hasIntro
                ? `
                    ${screen.intro_imagem ? `<img class="me-gancho-hero-image" src="/static/images/${encodeURIComponent(screen.intro_imagem)}" alt="" onerror="this.style.display='none'">` : ''}
                    ${introTextoHtml}
                `
                : '';

            // A escada, a árvore e o mapa já são a própria visualização —
            // sem imagem de diagrama por cima (o mapa tem a sua própria
            // imagem, com os marcadores em cima dela), e o painel de
            // explicação ganha o formato "Nível X de N" em vez do
            // "did-you-know" genérico. O mesmo cartão pode ser pedido para
            // chips normais via screen.cartao_estilo, sem mudar o layout da
            // fila de pontos.
            const useCardDetail = isEscada || isArvore || isMapa || screen.cartao_estilo === true;
            const primeiroPonto = pontos[0] || {};
            const explicacaoHtml = useCardDetail
                ? `<div class="me-escada-detail" id="meDiagramaExplicacao">${this.pontoDetailInnerHtml(primeiroPonto)}</div>`
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
                ${(isEscada || isArvore || isMapa) ? '' : (screen.video
                    ? `<video class="me-video-chroma-source" data-chroma-key="white" src="/static/${encodeURIComponent(screen.video)}" autoplay loop muted playsinline style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></video>
                       <canvas class="card-visual me-video-chroma-canvas"></canvas>`
                    : `<img class="card-visual" src="/static/images/${encodeURIComponent(screen.imagem)}" alt="${escapeHtml(screen.titulo || '')}" onerror="this.style.display='none'">`)}
                ${isTimeline ? '' : instrucaoHtml}
                ${pontosHtml}
                ${isTimeline ? instrucaoHtml : ''}
                ${explicacaoHtml}
            `;

            // "Queres saber mais?" opcional, dentro do mesmo painel branco
            // do diagrama (ver screen.aprofundar) — sem breakout de largura
            // nem caixa própria (ver .me-gancho-card .did-you-know no CSS),
            // fundido aqui em vez de ser um ecrã à parte só para um botão.
            const aprofundarHtml = this.aprofundarHtml(screen.aprofundar);

            // Com introdução, "saber mais" ou screen.cartao_estilo (gancho
            // fundido, ou só o painel pedido para chips normais), tudo —
            // título, instrução, pontos e explicação — partilha o mesmo
            // painel com traço fino em vez de flutuar solto na página. A
            // timeline recebe uma modificadora extra: precisa de mais
            // largura do que o painel estreito normal para caberem os
            // nomes em diagonal sem scroll horizontal (ver
            // .me-gancho-card--timeline, que quebra a coluna de leitura
            // estreita de .section-body tal como .plant-diagram-card).
            if (hasIntro || screen.aprofundar || screen.cartao_estilo) {
                const cardModifier = screen.layout === 'timeline' ? ' me-gancho-card--timeline' : '';
                return `
                    <div class="mascot-overlay-card me-mascot-inline me-gancho-card${cardModifier}">
                        ${introHtml}
                        ${diagramaHtml}
                        ${aprofundarHtml}
                    </div>
                `;
            }
            return diagramaHtml;
        }

        renderMicroVerificacao(section, screen, screenIndex) {
            const answerKey = `${section.secao_id}::${screenIndex}`;
            const saved = this.state.answers[answerKey];
            const feedbackHtml = saved
                ? this.buildFeedbackHtml(saved.correct, screen.mascote_feedback_certo, screen.mascote_feedback_errado)
                : '';

            // Com a mascote ativa, a pergunta, as opções e o feedback
            // aparecem sempre no popup ao entrar neste ecrã — tanto para
            // responder como para rever (ver showMicroVerificacaoPopup).
            // Em vez de deixar o ecrã por baixo vazio, mostra-se o último
            // ecrã de gancho/diagrama (ex: o do lago com os peixes) como
            // pano de fundo, para o aluno continuar a ver o conteúdo a que
            // a pergunta se refere enquanto o popup está aberto. Sem
            // mascote (o popup nunca chega a aparecer), mantém-se a
            // pergunta e as opções aqui para a pergunta continuar
            // respondível.
            if (this.mascotEnabled() && screen.pergunta) {
                const backdrop = this.findBackdropScreen(section, screenIndex);
                return backdrop ? this.renderScreen(section, backdrop, screenIndex) : '';
            }

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
            // screen.cartao_estilo troca o callout azul-claro padrão por um
            // cartão branco com a imagem, e o texto ganha o seu próprio
            // bloco destacado (castanho-rosado) lá dentro — em vez de
            // reaproveitar tal e qual .me-escada-detail (o painel creme dos
            // pontos de um diagrama, ver renderDiagrama), que aqui ficaria
            // com a imagem e o texto na mesma cor, sem os separar.
            if (screen.cartao_estilo) {
                const paragrafosHtml = texto.split(/\n\s*\n/).filter(Boolean)
                    .map((p) => `<p class="me-escada-detail-text">${escapeHtml(p)}</p>`).join('');
                // .me-gancho-hero-image (maior, ver renderGancho) em vez de
                // .me-escada-detail-image (pensada para ícones pequenos nos
                // degraus da escada) — aqui a imagem é um diagrama com
                // texto (ex: a teia alimentar), que precisa de mais espaço
                // para se conseguir ler.
                const imagemHtml = screen.imagem
                    ? `<img class="me-gancho-hero-image" src="/static/images/${encodeURIComponent(screen.imagem)}" alt="" onerror="this.style.display='none'">`
                    : '';
                // Também leva a classe me-gancho-card só para herdar a
                // largura total (e o "escape" da coluna estreita de
                // leitura, ver .screen-card:has(.me-gancho-card) no CSS) —
                // as próprias cores/bordas de .me-analogia-cartao/-texto-
                // bloco continuam a ganhar por virem depois no CSS.
                return `
                    <div class="me-analogia-cartao me-gancho-card">
                        ${imagemHtml}
                        <div class="me-analogia-texto-bloco">${paragrafosHtml}</div>
                        ${this.aprofundarHtml(screen.aprofundar)}
                    </div>
                `;
            }
            return `
                ${this.mascotInlineCardHtml(screen.mascote_texto)}
                <div class="mission-intro-callout">
                    <span class="mission-intro-callout-icon">💡</span>
                    <div class="mission-intro-callout-text">${textToHtml(texto)}</div>
                </div>
            `;
        }

        /** Reaproveitado tanto pelo ecrã dedicado (renderAprofundar) como
         *  pelo bloco "Queres saber mais?" opcional dentro de um diagrama
         *  (ver screen.aprofundar em renderDiagrama), para não haver dois
         *  sítios a construir o mesmo <details>. */
        aprofundarHtml(aprofundar) {
            if (!aprofundar) return '';
            // aprofundar.rotulo troca o texto padrão do botão ("Queres
            // saber mais? — <titulo>") por um rótulo próprio (ex: "Guia de
            // estudo"), para quando o conteúdo não é uma curiosidade extra
            // mas antes algo como uma analogia/resumo que merece o seu
            // próprio nome — sem precisar de um screen.titulo à parte.
            const rotulo = aprofundar.rotulo ? escapeHtml(aprofundar.rotulo) : `Queres saber mais? — ${escapeHtml(aprofundar.titulo)}`;
            return `
                <details class="did-you-know">
                    <summary>${rotulo}</summary>
                    <div class="did-you-know-body">
                        <div class="did-you-know-text">${textToHtml(aprofundar.texto)}</div>
                    </div>
                </details>
            `;
        }

        renderAprofundar(screen) {
            return this.aprofundarHtml(screen);
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

        /** Lista de opções só de leitura (sem clique), para a revisão do
         *  resultado — reaproveita tal e qual o visual de .quiz-option da
         *  pergunta em curso (correta a verde, a escolhida errada a
         *  vermelho, as restantes neutras), só que mostra todas as opções
         *  de uma vez em vez de só a que foi escolhida. */
        quizOptionsReviewHtml(opcoes, correta, selected) {
            return (opcoes || []).map((opcao, i) => {
                let stateClass = '';
                if (i === correta) stateClass = 'correct';
                else if (i === selected) stateClass = 'incorrect';
                return `
                    <div class="quiz-option me-quiz-resultado-option ${stateClass}">
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(opcao)}</span>
                    </div>
                `;
            }).join('');
        }

        renderQuizSeccao(section, screen) {
            const perguntas = screen.perguntas || [];
            const quizState = this.getQuizState(section);

            if (quizState.current >= perguntas.length) {
                const correctCount = quizState.answers.filter((a) => a.correct).length;
                const total = perguntas.length;
                const ratio = total ? correctCount / total : 0;
                const allCorrect = total > 0 && correctCount === total;

                // Verde se acertar tudo, amarelo se acertar metade ou mais,
                // vermelho caso contrário — proporcional ao nº de perguntas
                // da secção, não fixo em "3".
                const resultModifier = allCorrect ? 'green' : (ratio >= 0.5 ? 'yellow' : 'red');

                // Revisão: pergunta a pergunta, com todas as opções (não só
                // a escolhida) — a certa sempre a verde, a errada que
                // escolheste a vermelho, as restantes neutras — para dar
                // para comparar, em vez da mascote, que aqui só repetia o
                // resultado sem dar detalhe nenhum.
                const revisaoHtml = perguntas.length
                    ? `
                        <div class="me-quiz-resultado-revisao">
                            ${perguntas.map((pergunta, i) => {
                                const resposta = quizState.answers[i];
                                if (!resposta) return '';
                                return `
                                    <div class="me-quiz-resultado-item">
                                        <p class="me-quiz-resultado-pergunta">${i + 1}. ${escapeHtml(pergunta.pergunta)}</p>
                                        <div class="quiz-options me-quiz-resultado-options">
                                            ${this.quizOptionsReviewHtml(pergunta.opcoes, pergunta.correta, resposta.selected)}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `
                    : '';

                const conclusaoHtml = screen.mascote_conclusao
                    ? `
                        <div class="me-escada-detail me-quiz-resultado-conclusao-painel">
                            <p class="me-quiz-resultado-conclusao">${escapeHtml(screen.mascote_conclusao)}</p>
                        </div>
                    `
                    : '';

                return `
                    <div class="me-quiz-seccao">
                        <div class="me-quiz-resultado">
                            ${allCorrect ? `<div class="me-confetti">${this.buildConfettiHtml(50)}</div>` : ''}
                            <h3 class="me-quiz-resultado-title">Resultado do quiz</h3>
                            <div class="me-quiz-resultado-circle me-quiz-resultado-circle--${resultModifier}">${correctCount}/${total}</div>
                            ${revisaoHtml}
                            ${conclusaoHtml}
                        </div>
                    </div>
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

            // Navegação entre perguntas do quiz vive dentro do próprio
            // painel (setas), separada do "Anterior" de fora (que só troca
            // de ecrã, ver bindScreenInteractions/#mePrevBtn) — a seta
            // esquerda volta a uma pergunta já respondida, a direita avança
            // para a seguinte. Só a última pergunta usa o botão "Ver
            // resultado" (fora do painel, ver quizContinueHtml abaixo), que
            // sai do quiz para o ecrã de resultado.
            const isLastQuestion = questionIndex === perguntas.length - 1;
            const quizPrevArrowHtml = questionIndex > 0
                ? `
                    <button type="button" class="me-quiz-nav-arrow me-quiz-nav-arrow--prev" id="meQuizPrevQuestionBtn" aria-label="Pergunta anterior">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
                    </button>
                `
                : '';
            const quizNextArrowHtml = (savedAnswer && !isLastQuestion)
                ? `
                    <button type="button" class="me-quiz-nav-arrow me-quiz-nav-arrow--next" id="meQuizContinueBtn" aria-label="Pergunta seguinte">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                `
                : '';
            const quizArrowsHtml = (quizPrevArrowHtml || quizNextArrowHtml)
                ? `<div class="me-quiz-nav-arrows">${quizPrevArrowHtml}${quizNextArrowHtml}</div>`
                : '';

            const quizContinueHtml = (savedAnswer && isLastQuestion)
                ? `
                    <div class="lesson-quiz-actions">
                        <button type="button" class="lesson-primary-btn quiz-nav-btn--next" id="meQuizContinueBtn">Ver resultado</button>
                    </div>
                `
                : '';

            return `
                <div class="me-quiz-seccao me-quiz-seccao--pergunta">
                    ${introHtml}
                    <p class="quiz-progress-label">Pergunta ${questionIndex + 1} de ${perguntas.length}</p>
                    <p class="quiz-question">${escapeHtml(question.pergunta)}</p>
                    <div class="quiz-options">${optionsHtml}</div>
                    ${feedbackHtml}
                    ${quizArrowsHtml}
                </div>
                ${quizContinueHtml}
            `;
        }

        // ---- Interações -------------------------------------------------------

        /** Liga o clique em cada chip/degrau ([data-ponto-index]) de um
         *  diagrama à atualização do painel de explicação — reaproveitado
         *  tanto para o diagrama do ecrã atual como para uma cópia dele a
         *  aparecer só como pano de fundo (ver findBackdropScreen). */
        bindDiagramaChips(diagramScreen) {
            const isEscada = diagramScreen.layout === 'escada';
            const isArvore = diagramScreen.layout === 'arvore';
            const isMapa = diagramScreen.layout === 'mapa';
            const useCardDetail = isEscada || isArvore || isMapa || diagramScreen.cartao_estilo === true;
            const explicacaoEl = this.root.querySelector('#meDiagramaExplicacao');
            const activeSelector = isEscada ? '.me-escada-step' : (isArvore ? '.me-arvore-node' : (isMapa ? '.me-mapa-marker' : '.me-diagrama-chip'));
            this.root.querySelectorAll('[data-ponto-index]').forEach((chip) => {
                chip.addEventListener('click', () => {
                    const ponto = diagramScreen.pontos[Number(chip.dataset.pontoIndex)];
                    this.root.querySelectorAll(activeSelector).forEach((c) => c.classList.remove('is-active'));
                    chip.classList.add('is-active');
                    if (useCardDetail) {
                        if (explicacaoEl) {
                            explicacaoEl.hidden = false;
                            explicacaoEl.innerHTML = this.pontoDetailInnerHtml(ponto);
                        }
                        return;
                    }
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
                                    ${this.saberMaisHtml(ponto)}
                                </div>
                            </div>
                        `;
                    }
                });
            });
        }

        /** Vídeos decorativos (ex: molécula a girar) vêm com fundo branco
         *  gravado nos próprios pixels — sem canal alfa num .mp4, um
         *  filtro CSS não consegue distinguir "fundo branco" de "peça
         *  branca da própria molécula" (ambos ficam com a mesma
         *  luminosidade). Por isso desenha-se cada frame num <canvas>
         *  escondido atrás do vídeo e torna-se transparente só o que está
         *  muito perto do branco puro do fundo (ver amostragem em
         *  sample_video_pixels: cantos ~253-255, molécula bem mais escura
         *  que isso) — a molécula em si fica intacta. */
        startChromaKeyLoop(video) {
            const canvas = video.nextElementSibling;
            if (!canvas || !canvas.classList.contains('me-video-chroma-canvas')) return;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const NEAR = 10;
            const FAR = 60;
            const draw = () => {
                if (!video.isConnected || !canvas.isConnected) return;
                if (video.videoWidth && video.videoHeight) {
                    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                    }
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = frame.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const dist = (255 - data[i]) + (255 - data[i + 1]) + (255 - data[i + 2]);
                        if (dist <= NEAR) {
                            data[i + 3] = 0;
                        } else if (dist < FAR) {
                            data[i + 3] = Math.round(255 * (dist - NEAR) / (FAR - NEAR));
                        }
                    }
                    ctx.putImageData(frame, 0, 0);
                }
                video.requestVideoFrameCallback ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
            };
            video.requestVideoFrameCallback ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
        }

        bindScreenInteractions(section, screen, screenIndex) {
            // Re-render substitui o <video> por um elemento novo a cada
            // vez (troca de ponto, popup, etc.) — o atributo autoplay do
            // HTML nem sempre chega a tempo de arrancar (a promise de
            // play() pode ser interrompida pela própria substituição do
            // nó), ficando um vídeo parado e invisível. Chamar .play()
            // explicitamente aqui, já muted, garante que arranca sempre.
            this.root.querySelectorAll('video[autoplay]').forEach((video) => {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {});
                }
            });
            this.root.querySelectorAll('video[data-chroma-key]').forEach((video) => {
                this.startChromaKeyLoop(video);
            });

            if (screen.tipo === 'diagrama_interativo') {
                this.bindDiagramaChips(screen);
            }

            // Quando o ecrã de baixo é uma micro-verificação com pano de
            // fundo (o último diagrama/gancho, ver renderMicroVerificacao e
            // findBackdropScreen), os degraus/chips aparecem também por lá
            // — sem isto, cliques nesse pano de fundo não faziam nada, o
            // que parecia um bug de "a escada não responde ao clique".
            if (screen.tipo === 'micro_verificacao' && this.mascotEnabled() && screen.pergunta) {
                const backdrop = this.findBackdropScreen(section, screenIndex);
                if (backdrop) this.bindDiagramaChips(backdrop);
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

                    this.root.querySelector('#meQuizPrevQuestionBtn')?.addEventListener('click', () => {
                        quizState.current -= 1;
                        this.saveState();
                        this.render();
                    });
                }
            }
        }

        // ---- Conclusão da missão -----------------------------------------------

        completeMission() {
            // O XP já foi todo pago página a página (e no quiz de cada
            // secção) por awardPageXP, chamado em advance() antes de chegar
            // aqui — nada a pagar de novo, só sincronizar o estado final
            // (completedSections já inclui a última secção neste ponto).
            this.syncProgressWithDjango();

            this.state.view = 'celebracao';
            this.state.celebrationShown = true;
            this.saveState();
            this.render();
        }

        syncProgressWithDjango(totalXP = this.totalMissionXpEarned()) {
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

        /** Gera N peças de confetti (cor, posição e duração aleatórias) para
         *  dentro de um contentor ".me-confetti" (position:relative na mãe,
         *  ver missao-engine.css) — reaproveitado na celebração de fim de
         *  missão e no resultado do quiz de secção quando acerta tudo. */
        buildConfettiHtml(count) {
            return Array.from({ length: count }, () => {
                const left = Math.random() * 100;
                const delay = Math.random() * 1.2;
                const duration = 2.2 + Math.random() * 1.6;
                const hue = Math.floor(Math.random() * 360);
                return `<span class="me-confetti-piece" style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s; background:hsl(${hue}, 80%, 60%);"></span>`;
            }).join('');
        }

        renderCelebration() {
            const totalXP = this.totalMissionXpEarned();
            const confettiHtml = this.buildConfettiHtml(60);
            const badgeIconHtml = this.missao.badge?.icone || '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/></svg>';

            this.root.innerHTML = `
                <div class="me-shell me-shell--celebracao">
                    <div class="me-confetti">${confettiHtml}</div>
                    <div class="me-celebracao-card">
                        <span class="me-celebracao-badge">${badgeIconHtml}</span>
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
