/**
 * Mission System - Core Logic
 * Handles mission progression, quizzes, XP earning, and user progress tracking
 */

class MissionSystem {
    constructor(missionData) {
        this.mission = missionData;
        this.augmentSectionsWithSummaryCards();
        this.currentSectionIndex = 0;
        this.activeSectionIndex = 0;
        this.userAnswers = {};
        this.sectionScreenProgress = {};
        this.openAnswerDrafts = {};
        this.guideAnswerState = {};
        this.quizEntryState = {};
        this.chapterCompletionView = false;
        this.earnedXP = 0;
        this.completedSections = new Set();
        // Guards one-off interactive widgets (the formula builder, the
        // phase-clara sequence) so their small XP reward is only ever
        // granted once per widget, even if the student redoes it later.
        this.widgetCompletions = {};
        this.isInFinalQuiz = false;
        this.finalQuizAnswers = [];
        this.activeCardAudioButton = null;
        this.mascotIntroShown = {};
        this.mascotQuizIntroShown = {};
        this.quizViewActive = {};
        // Transient (not persisted): which just-answered question is still
        // showing its feedback, waiting for "Continuar".
        this.awaitingContinue = {};
        this.progressStorageKey = this.resolveProgressStorageKey();
        this.loadProgress();
        this.registerPersistenceListeners();
        this.saveProgress();
        this.streak = window.ProfileXP?.recordActivityStreakForCurrentUser?.() || { current: 0, longest: 0 };

        // Percurso (path) screen: forest scene with a circle per section.
        // It's always the first thing shown when entering a mission
        // (fresh visit or "Retomar"), so the student always picks their
        // section from the map — it only clears once they click a circle.
        this.showPathScreen = true;
        // The mascot's explanation of how missions work is a ONE-TIME thing
        // across the whole app, not per mission — it only plays the very
        // first time a student ever opens a mission, whichever one that is.
        this.mascotIntroSeenKey = 'explore_mascot_intro_seen';
        this.pathIntroActive = localStorage.getItem(this.mascotIntroSeenKey) !== '1';
        this.pathIntroStep = 0;
    }
    

    buildSummaryCardHtml(section) {
        if (section.formulaBuilder) {
            return this.buildFormulaBuilderCardHtml();
        }

        const hasSummary = Array.isArray(section.summarySteps) && section.summarySteps.length > 0;

        if (!hasSummary) {
            return '';
        }

        const summaryHtml = `
            <div class="mission-summary-box">
                <p class="mission-summary-heading">Em resumo: o que acontece nesta etapa?</p>
                <div class="mission-summary-steps">
                    ${section.summarySteps.map((step, index) => `
                        ${index > 0 ? '<span class="mission-summary-arrow">→</span>' : ''}
                        <div class="mission-summary-step">
                            <span class="mission-summary-step-icon">${step.icon}</span>
                            <span class="mission-summary-step-label">${step.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        return `<div class="screen-card mission-summary-card">${summaryHtml}</div>`;
    }

    /**
     * Instead of showing the photosynthesis equation already complete, the
     * student drags each term into its slot — 6CO2 + 6H2O -> C6H12O6 + 6O2 —
     * and earns a small XP bonus once it's right (bindFormulaBuilder wires
     * the actual drag-and-drop after this HTML is in the DOM).
     */
    buildFormulaBuilderCardHtml() {
        const co2Icon = '<span class="molecule-icon"><span class="atom atom--oxygen"></span><span class="atom atom--carbon"></span><span class="atom atom--oxygen"></span></span>';
        const o2Icon = '<span class="molecule-icon"><span class="atom atom--oxygen"></span><span class="atom atom--oxygen"></span></span>';
        const pieces = [
            { key: 'co2', label: '6CO<sub>2</sub>', icon: co2Icon },
            { key: 'h2o', label: '6H<sub>2</sub>O', icon: '💧' },
            { key: 'glicose', label: 'C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>', icon: '🍬' },
            { key: 'o2', label: '6O<sub>2</sub>', icon: o2Icon }
        ];
        const pieceByKey = Object.fromEntries(pieces.map((piece) => [piece.key, piece]));
        // Shuffled so the pool isn't already in the correct order.
        const poolOrder = ['glicose', 'o2', 'co2', 'h2o'];

        // Reactants (CO2 + H2O) and products (glicose + O2) can go in either
        // of their two slots — the order within each side of the equation
        // doesn't change its meaning, so bindFormulaBuilder checks the pair
        // as a set rather than a fixed position.
        const slotsHtml = `
            <div class="formula-slot" data-slot="reactant-1" data-zone="reactant"><span class="formula-slot-placeholder">?</span></div>
            <span class="formula-operator">+</span>
            <div class="formula-slot" data-slot="reactant-2" data-zone="reactant"><span class="formula-slot-placeholder">?</span></div>
            <span class="formula-operator formula-operator--arrow">→</span>
            <div class="formula-slot" data-slot="product-1" data-zone="product"><span class="formula-slot-placeholder">?</span></div>
            <span class="formula-operator">+</span>
            <div class="formula-slot" data-slot="product-2" data-zone="product"><span class="formula-slot-placeholder">?</span></div>
        `;

        const poolHtml = poolOrder.map((key) => {
            const piece = pieceByKey[key];
            return `
                <div class="formula-piece" draggable="true" data-piece="${piece.key}">
                    <span class="formula-piece-label">${piece.label}</span>
                    <span class="formula-piece-arrow">↓</span>
                    <span class="formula-piece-icon">${piece.icon}</span>
                </div>
            `;
        }).join('');

        const summaryHtml = `
            <div class="mission-summary-box formula-builder">
                <p class="mission-summary-heading">Em resumo: o que acontece nesta etapa?</p>
                <p class="formula-builder-hint">Arrasta cada peça para o espaço certo da equação da fotossíntese.</p>
                <div class="formula-equation">${slotsHtml}</div>
                <div class="formula-pool">${poolHtml}</div>
                <p class="formula-builder-feedback"></p>
                <button type="button" class="formula-builder-reset-btn">↺ Repetir</button>
            </div>
        `;

        return `<div class="screen-card mission-summary-card">${summaryHtml}</div>`;
    }

    buildIntroHighlightHtml(section) {
        if (typeof section.introHighlight !== 'string' || !section.introHighlight.trim()) {
            return '';
        }

        return `
            <div class="mission-intro-callout">
                <span class="mission-intro-callout-icon">${section.introIcon || '☀️'}</span>
                <div class="mission-intro-callout-text">${section.introHighlight}</div>
            </div>
        `;
    }

    /**
     * Render the full-width "Sabias que?" banner below the 3-column layout
     * for the currently active section (separate from the paginated
     * screen-card flow, to match the reference design).
     */
    renderFactBanner(section) {
        const banner = document.getElementById('missionFactBanner');
        if (!banner) return;

        const hasFact = typeof section?.factOfTheDay === 'string' && section.factOfTheDay.trim().length > 0;
        if (!hasFact) {
            banner.innerHTML = '';
            banner.classList.remove('show');
            return;
        }

        banner.innerHTML = `
            <span class="mission-fact-banner-icon">⭐</span>
            <strong>Sabias que?</strong>
            <span>${section.factOfTheDay}</span>
        `;
        banner.classList.add('show');
    }

    /**
     * Bake the "Em resumo" diagram into each section's content string once
     * (as a real screen-card), so the regex-based screen-card counting in
     * enforceProgressIntegrity() stays in sync with what actually renders —
     * appending it later at render time would create a mismatch.
     */
    augmentSectionsWithSummaryCards() {
        this.mission.sections.forEach((section) => {
            if (section.__summaryCardAppended || typeof section.content !== 'string') {
                return;
            }

            const summaryCardHtml = this.buildSummaryCardHtml(section);
            if (summaryCardHtml) {
                const trimmed = section.content.trimEnd();
                if (trimmed.endsWith('</div>')) {
                    section.content = `${trimmed.slice(0, -'</div>'.length)}${summaryCardHtml}</div>`;
                }
            }

            section.__summaryCardAppended = true;
        });
    }

    buildProgressStorageKey(user) {
        const userKey = user?.uid
            ? `uid:${user.uid}`
            : (user?.email ? `email:${user.email.toLowerCase()}` : 'guest');
        return `mission_${userKey}_${this.mission.id}`;
    }

    scoreProgressSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            return 0;
        }

        const completed = Array.isArray(snapshot.completedSections) ? snapshot.completedSections.length : 0;
        const answered = snapshot.userAnswers && typeof snapshot.userAnswers === 'object'
            ? Object.values(snapshot.userAnswers).reduce((count, state) => {
                const answers = Array.isArray(state?.answers) ? state.answers.length : 0;
                return count + answers;
            }, 0)
            : 0;
        const screenAdvance = snapshot.sectionScreenProgress && typeof snapshot.sectionScreenProgress === 'object'
            ? Object.values(snapshot.sectionScreenProgress).reduce((sum, value) => sum + (Number.isInteger(value) ? value : 0), 0)
            : 0;
        const earned = Number.isFinite(snapshot.earnedXP) ? snapshot.earnedXP : 0;

        return (completed * 10000) + (answered * 100) + (screenAdvance * 10) + earned;
    }

    resolveProgressStorageKey() {
        const user = window.exploreCurrentUser;
        const preferredKey = this.buildProgressStorageKey(user);
        const isAuthenticated = !!(user?.uid || user?.email);
        const candidateKeys = [preferredKey];

        if (user?.uid && user?.email) {
            candidateKeys.push(this.buildProgressStorageKey({ email: user.email }));
        }

        // Nunca misturar progresso de guest com contas autenticadas.
        if (!isAuthenticated) {
            candidateKeys.push(this.buildProgressStorageKey(null));
        }

        const parsedSnapshots = candidateKeys
            .filter((key, index, array) => array.indexOf(key) === index)
            .map((key) => {
                const raw = localStorage.getItem(key);
                if (!raw) {
                    return null;
                }

                try {
                    return { key, raw, data: JSON.parse(raw) };
                } catch (error) {
                    return null;
                }
            })
            .filter(Boolean);

        if (!parsedSnapshots.length) {
            return preferredKey;
        }

        let best = parsedSnapshots[0];
        let bestScore = this.scoreProgressSnapshot(best.data);

        parsedSnapshots.slice(1).forEach((item) => {
            const score = this.scoreProgressSnapshot(item.data);
            if (score > bestScore) {
                best = item;
                bestScore = score;
            }
        });

        const preferredRaw = localStorage.getItem(preferredKey);
        if (!preferredRaw && best.key !== preferredKey) {
            localStorage.setItem(preferredKey, best.raw);
            return preferredKey;
        }

        if (preferredRaw && best.key !== preferredKey) {
            try {
                const preferredData = JSON.parse(preferredRaw);
                const preferredScore = this.scoreProgressSnapshot(preferredData);
                if (bestScore > preferredScore) {
                    localStorage.setItem(preferredKey, best.raw);
                }
            } catch (error) {
                localStorage.setItem(preferredKey, best.raw);
            }
            return preferredKey;
        }

        return preferredKey;
    }

    getProgressStorageKey() {
        return this.progressStorageKey || this.buildProgressStorageKey(window.exploreCurrentUser);
    }

    handleAuthStateSync() {
        const nextKey = this.resolveProgressStorageKey();
        const previousKey = this.progressStorageKey;

        if (!previousKey) {
            this.progressStorageKey = nextKey;
            return;
        }

        if (nextKey === previousKey) {
            return;
        }

        const previousRaw = localStorage.getItem(previousKey);
        const nextRaw = localStorage.getItem(nextKey);

        if (previousRaw && !nextRaw) {
            localStorage.setItem(nextKey, previousRaw);
        } else if (previousRaw && nextRaw) {
            try {
                const previousData = JSON.parse(previousRaw);
                const nextData = JSON.parse(nextRaw);
                const previousScore = this.scoreProgressSnapshot(previousData);
                const nextScore = this.scoreProgressSnapshot(nextData);
                if (previousScore > nextScore) {
                    localStorage.setItem(nextKey, previousRaw);
                }
            } catch (error) {
                localStorage.setItem(nextKey, previousRaw);
            }
        }

        this.progressStorageKey = nextKey;
        this.loadProgress();
        this.render();
    }

    /**
     * Load user progress from localStorage
     */
    loadProgress() {
        const savedProgress = localStorage.getItem(this.getProgressStorageKey());

        if (savedProgress) {
            try {
                const data = JSON.parse(savedProgress);
                this.currentSectionIndex = Number.isInteger(data.currentSectionIndex) ? data.currentSectionIndex : 0;
                this.activeSectionIndex = Number.isInteger(data.activeSectionIndex) ? data.activeSectionIndex : this.currentSectionIndex;
                this.userAnswers = data.userAnswers && typeof data.userAnswers === 'object' ? data.userAnswers : {};
                this.sectionScreenProgress = data.sectionScreenProgress && typeof data.sectionScreenProgress === 'object' ? data.sectionScreenProgress : {};
                this.openAnswerDrafts = data.openAnswerDrafts && typeof data.openAnswerDrafts === 'object' ? data.openAnswerDrafts : {};
                this.guideAnswerState = data.guideAnswerState && typeof data.guideAnswerState === 'object' ? data.guideAnswerState : {};
                this.quizEntryState = data.quizEntryState && typeof data.quizEntryState === 'object' ? data.quizEntryState : {};
                this.chapterCompletionView = data.chapterCompletionView === true;
                this.earnedXP = Number.isFinite(data.earnedXP) ? data.earnedXP : 0;
                this.completedSections = new Set(Array.isArray(data.completedSections) ? data.completedSections : []);
                this.widgetCompletions = data.widgetCompletions && typeof data.widgetCompletions === 'object' ? data.widgetCompletions : {};
            } catch (error) {
                console.warn('Could not parse mission progress from localStorage:', error);
                this.currentSectionIndex = 0;
                this.activeSectionIndex = 0;
                this.userAnswers = {};
                this.sectionScreenProgress = {};
                this.openAnswerDrafts = {};
                this.guideAnswerState = {};
                this.quizEntryState = {};
                this.chapterCompletionView = false;
                this.earnedXP = 0;
                this.completedSections = new Set();
                this.widgetCompletions = {};
            }
        }

        this.enforceProgressIntegrity();
    }

    /**
     * Ensure progression cannot skip locked sections
     */
    enforceProgressIntegrity() {
        const orderedCompleted = [];
        const validSectionIds = new Set(this.mission.sections.map(section => section.id));

        this.sectionScreenProgress = Object.entries(this.sectionScreenProgress || {}).reduce((acc, [sectionId, index]) => {
            if (!validSectionIds.has(sectionId)) {
                return acc;
            }

            const section = this.mission.sections.find(item => item.id === sectionId);
            const screenCount = section?.content
                ? ((section.content.match(/class=\"screen-card/g) || []).length)
                : 0;
            const maxIndex = Math.max(0, screenCount - 1);
            const safeIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, maxIndex)) : 0;
            acc[sectionId] = safeIndex;
            return acc;
        }, {});

        this.openAnswerDrafts = Object.entries(this.openAnswerDrafts || {}).reduce((acc, [sectionId, drafts]) => {
            if (!validSectionIds.has(sectionId) || !drafts || typeof drafts !== 'object') {
                return acc;
            }

            const normalizedDrafts = Object.entries(drafts).reduce((draftAcc, [questionIndex, value]) => {
                if (typeof value !== 'string') {
                    return draftAcc;
                }

                draftAcc[questionIndex] = value;
                return draftAcc;
            }, {});

            if (Object.keys(normalizedDrafts).length > 0) {
                acc[sectionId] = normalizedDrafts;
            }

            return acc;
        }, {});

        this.guideAnswerState = Object.entries(this.guideAnswerState || {}).reduce((acc, [sectionId, state]) => {
            if (!validSectionIds.has(sectionId) || !state || typeof state !== 'object') {
                return acc;
            }

            const selectedChoice = typeof state.selectedChoice === 'string' ? state.selectedChoice : null;
            const isCorrect = state.isCorrect === true;
            if (!selectedChoice) {
                return acc;
            }

            acc[sectionId] = { selectedChoice, isCorrect };
            return acc;
        }, {});

        this.quizEntryState = Object.entries(this.quizEntryState || {}).reduce((acc, [sectionId, isOpen]) => {
            if (!validSectionIds.has(sectionId) || isOpen !== true) {
                return acc;
            }

            acc[sectionId] = true;
            return acc;
        }, {});

        for (const section of this.mission.sections) {
            const isStoredComplete = this.completedSections.has(section.id);
            const questions = this.getSectionQuestions(section);
            const answerState = this.getSectionAnswerState(section.id);
            const hasCompletedQuizAnswers = questions.length > 0
                && questions.every((_, questionIndex) => !!answerState.answers?.[questionIndex]);

            if (isStoredComplete || hasCompletedQuizAnswers) {
                orderedCompleted.push(section.id);
            } else {
                break;
            }
        }

        this.completedSections = new Set(orderedCompleted);

        const lastSectionIndex = Math.max(0, this.mission.sections.length - 1);
        const minimumUnlockedIndex = Math.min(orderedCompleted.length, lastSectionIndex);
        this.currentSectionIndex = Math.max(minimumUnlockedIndex, this.currentSectionIndex);
        this.currentSectionIndex = Math.max(0, Math.min(lastSectionIndex, this.currentSectionIndex));

        const maxVisibleIndex = this.completedSections.size === this.mission.sections.length
            ? this.mission.sections.length - 1
            : this.currentSectionIndex;
        this.activeSectionIndex = Math.max(0, Math.min(maxVisibleIndex, this.activeSectionIndex));

        if (this.completedSections.size !== this.mission.sections.length) {
            this.chapterCompletionView = false;
        }
    }

    /**
     * Builds a { sectionId: quizPercentage } map for every completed section,
     * so the profile page can show how well each topic went (not just whether
     * it was finished).
     */
    buildSectionScores() {
        const scores = {};
        for (const sectionId of this.completedSections) {
            const section = this.mission.sections.find((s) => s.id === sectionId);
            if (!section) continue;
            const questions = this.getSectionQuestions(section);
            if (!questions.length) continue;
            const answerState = this.getSectionAnswerState(sectionId);
            const correct = answerState.answers?.filter((a) => a?.isCorrect === true).length || 0;
            scores[sectionId] = Math.round((correct / questions.length) * 100);
        }
        return scores;
    }

    /**
     * Save user progress to localStorage
     */
    saveProgress() {
        const data = {
            missionId: this.mission.id,
            totalSections: this.mission.sections.length,
            currentSectionIndex: this.currentSectionIndex,
            activeSectionIndex: this.activeSectionIndex,
            userAnswers: this.userAnswers,
            sectionScreenProgress: this.sectionScreenProgress,
            openAnswerDrafts: this.openAnswerDrafts,
            guideAnswerState: this.guideAnswerState,
            quizEntryState: this.quizEntryState,
            chapterCompletionView: this.chapterCompletionView,
            earnedXP: this.earnedXP,
            completedSections: Array.from(this.completedSections),
            widgetCompletions: this.widgetCompletions,
            sectionScores: this.buildSectionScores(),
            updatedAt: new Date().toISOString()
        };

        const key = this.getProgressStorageKey();
        const existingRaw = localStorage.getItem(key);
        if (existingRaw) {
            try {
                const existing = JSON.parse(existingRaw);
                const existingScore = this.scoreProgressSnapshot(existing);
                const nextScore = this.scoreProgressSnapshot(data);
                if (nextScore === 0 && existingScore > 0) {
                    return;
                }
            } catch (error) {
                // Ignore parse issues and overwrite with fresh valid state
            }
        }

        localStorage.setItem(key, JSON.stringify(data));
        this.syncProgressWithDjango(data);
        window.dispatchEvent(new CustomEvent('explore:mission-progress-updated', {
            detail: {
                missionId: this.mission.id,
                progress: data
            }
        }));
    }

    syncProgressWithDjango(data) {
        if (!window.exploreProgressSyncUrl || !window.exploreCsrfToken) {
            return;
        }

        fetch(window.exploreProgressSyncUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.exploreCsrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                missionId: this.mission.id,
                progress: data,
                xp: window.ProfileXP
                    ? window.ProfileXP.getProfileStats(window.ProfileXP.getCurrentUserProfile()).xp
                    : 0
            })
        }).catch((error) => {
            console.warn('Não foi possível sincronizar o progresso com o Django:', error);
        });
    }

    registerPersistenceListeners() {
        window.addEventListener('beforeunload', () => {
            this.saveProgress();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveProgress();
            }
        });

        window.addEventListener('explore:auth-changed', () => {
            this.handleAuthStateSync();
        });
    }

    awardProfileXP(amount, source, activityDetails = {}) {
        if (!window.ProfileXP) {
            return { awarded: false, xpAdded: 0 };
        }

        return window.ProfileXP.awardXPToCurrentUser(amount, source, undefined, activityDetails);
    }

    buildRewardSource(type, identifier) {
        if (!window.ProfileXP) {
            return null;
        }

        return window.ProfileXP.buildRewardSource(type, identifier);
    }

    /**
     * Get current progress percentage
     */
    getProgressPercent() {
        return Math.round((this.completedSections.size / this.mission.sections.length) * 100);
    }

    /**
     * Render the mission interface
     */
    render() {
        this.stopCardAudio();
        this.renderHeader();
        this.renderSections();
        this.renderLessonChrome();
        this.updateProgressBar();
        this.renderPathScreen();
        this.applyPathScreenVisibility();
    }

    applyPathScreenVisibility() {
        const pathScreen = document.getElementById('missionPathScreen');
        const container = document.querySelector('.mission-container');
        const header = document.getElementById('siteHeader');
        if (pathScreen) pathScreen.hidden = !this.showPathScreen;
        if (container) container.hidden = this.showPathScreen;
        // The site header stays hidden for the whole lesson-player experience
        // now (not just during the percurso's mascot intro), since the new
        // lesson topbar (close button + progress + XP/streak) replaces it.
        const headerHidden = !this.showPathScreen || this.pathIntroActive;
        if (header) header.hidden = headerHidden;
        // The page normally reserves top padding for the site's fixed
        // marketing header — cancel that reserved space for as long as the
        // header itself is hidden, or the lesson topbar ends up floating
        // below a blank gap the same height as the header would have been.
        document.body.classList.toggle('mission-header-hidden', headerHidden);
    }

    /**
     * Render the "percurso" screen: a forest scene with one circle per
     * section (locked/done states matching the sidebar stepper) and the
     * mascot floating above them. The first time a student opens the
     * mission, the mascot also walks through a short generic explanation
     * of how missions work, one speech-bubble step at a time, with
     * "Saltar tutorial" always available. Clicking a circle enters that
     * section and this screen never shows again for this mission.
     */
    renderPathScreen() {
        const screen = document.getElementById('missionPathScreen');
        if (!screen) return;

        if (!this.showPathScreen) {
            screen.innerHTML = '';
            return;
        }

        const maxReviewable = this.getMaxReviewableSectionIndex();
        const imageUrl = this.getMascotImageUrl();
        const waveVideoUrl = this.getMascotWaveVideoUrl();
        const missionTitle = this.mission.title.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
        const introActive = this.pathIntroActive;

        const xpStarIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="yellow" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';
        const leafIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-11 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';
        const checkIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>';

        const indexRowsHtml = this.mission.sections.map((section, idx) => {
            const isDone = this.completedSections.has(section.id);
            const isLocked = idx > maxReviewable;
            const isActive = !isDone && !isLocked;
            const iconTint = `${section.accentColor || '#1f8a5b'}22`;
            const statusHtml = isLocked
                ? '<span class="mo-index-status mo-index-status--locked">🔒 Bloqueada</span>'
                : (isDone
                    ? `<span class="mo-index-status mo-index-status--done">${checkIconSvg} Concluída</span>`
                    : '<span class="mo-index-status mo-index-status--active">Em progresso</span>');

            return `
                <li class="mo-index-row ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}">
                    <button type="button" class="mo-index-row-btn" data-section-index="${idx}" ${isLocked ? 'disabled' : ''}>
                        <span class="mo-index-icon" style="background:${iconTint}; color:${section.accentColor || '#1f8a5b'}">${section.icon}</span>
                        <span class="mo-index-copy">
                            <strong>${section.title}</strong>
                            <span>${section.subtitle || ''}</span>
                        </span>
                        <span class="mo-index-meta">
                            ${statusHtml}
                            <span class="mo-index-xp">${xpStarIconSvg} +${section.xpReward || 0} XP</span>
                        </span>
                        <span class="mo-index-chevron" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </span>
                    </button>
                </li>
            `;
        }).join('');

        const studentTitle = this.getStudentRankTitle().replace(/!+$/, '');
        const steps = [
            `Olá, ${studentTitle}! Sou o Kim, o teu companheiro, e estou aqui para te guiar nesta aventura.`,
            'Podes explorar sozinho, ao teu ritmo, ou comigo sempre por perto para te ajudar em cada etapa — a escolha é tua.',
            'Ao longo do caminho vais descobrir o conteúdo da missão e deparar-te com curiosidades verdadeiramente fascinantes.',
            'Também vais resolver quizzes que se tornam mais desafiantes a cada etapa — e ganhas XP sempre que acertares.',
            `Prepara-te para desafios, dúvidas e descobertas incríveis. Escolhe um círculo e começa a tua aventura em ${missionTitle}!`
        ];
        const quizStepIndex = 3;
        const stepIndex = Math.min(this.pathIntroStep, steps.length - 1);

        const quizDemoHtml = `
            <div class="home-quiz-preview mission-path-quiz-demo" aria-hidden="true">
                <div class="home-quiz-preview-heading"><span class="home-quiz-progress">Pergunta 2/5</span></div>
                <h3>Qual pigmento capta a luz?</h3>
                <div class="home-quiz-options">
                    <div class="home-quiz-option"><span>A</span> Rubisco</div>
                    <div class="home-quiz-option is-correct"><span>B</span> Clorofila</div>
                    <div class="home-quiz-option"><span>C</span> Amido</div>
                </div>
            </div>
        `;

        screen.className = `mission-path-screen ${introActive ? 'mission-path-screen--intro' : ''}`;

        // While the mascot is explaining how missions work, keep the scene
        // to a plain white background with no forest/circles behind it —
        // the percurso itself is only revealed once the explanation is done.
        if (introActive) {
            const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

            screen.innerHTML = `
                <div class="mission-path-intro-stage">
                    <button type="button" class="mission-intro-skip" id="missionPathSkip">Saltar tutorial</button>
                    <div class="mission-path-progress-track" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
                        <div class="mission-path-progress-fill" style="width:${progressPercent}%"></div>
                    </div>
                    <div class="mission-path-intro-center">
                        ${waveVideoUrl
                            ? `<video class="mission-path-mascot" src="${waveVideoUrl}" autoplay loop muted playsinline ${imageUrl ? `poster="${imageUrl}"` : ''}></video>`
                            : (imageUrl ? `<img class="mission-path-mascot" src="${imageUrl}" alt="Mascote Explore+">` : '')}
                        <p class="mission-path-intro-text">${steps[stepIndex]}</p>
                        ${stepIndex === quizStepIndex ? quizDemoHtml : ''}
                    </div>
                    <div class="mission-intro-controls">
                        <div class="mission-path-intro-buttons">
                            ${stepIndex > 0 ? `<button type="button" class="mission-intro-back" id="missionPathBack">Voltar</button>` : ''}
                            <button type="button" class="mission-intro-next" id="missionPathNext">${stepIndex === steps.length - 1 ? 'Vamos a isso!' : 'Seguinte'}</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const missionsIndexUrl = window.exploreMissionsIndexUrl || '#';
            const progressPercent = this.getProgressPercent();
            const completedCount = this.completedSections.size;
            const totalCount = this.mission.sections.length;

            const planoIsPro = window.explorePlano === 'pro';
            const avatarInitial = (window.exploreUsername || '').trim().charAt(0).toUpperCase() || '?';

            screen.innerHTML = `
                <div class="mo-page">
                    <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>
                    <aside class="profile-sidebar" id="profileSidebar" aria-hidden="true">
                        <div class="profile-sidebar-brand">
                            <div><img src="${window.exploreLogoUrl || ''}" alt="Logotipo Explore+"></div>
                        </div>

                        <nav class="profile-sidebar-nav">
                            <div class="sidebar-plan-card">
                                <div class="sidebar-plan-info">
                                    <span class="sidebar-plan-label">Plano</span>
                                    <strong class="sidebar-plan-name">${planoIsPro ? 'Pro' : 'Gratuito'}</strong>
                                </div>
                                ${planoIsPro ? '' : `<a href="${window.exploreSuperExploreUrl || '#'}" class="sidebar-plan-cta">SuperExplore</a>`}
                            </div>

                            <a href="${window.explorePerfilUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span>
                            <span class="profile-sidebar-label">Perfil</span>
                            </a>

                            <a href="${missionsIndexUrl}" class="is-active" aria-current="page"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
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
                                    <strong id="profileAccountName">${window.exploreUsername || ''}</strong>
                                    <span id="profileAccountEmail">${window.exploreCurrentUser?.email || ''}</span>
                                </span>
                                <span class="profile-account-arrow" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </span>
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
                            <a href="${window.explorePaginaInicialUrl || '#'}" class="mo-header-logo">
                                <img src="${window.exploreLogoUrl || ''}" alt="Explore+">
                            </a>
                            <button type="button" class="nav-drawer-toggle" id="navDrawerToggle" aria-label="Abrir menu">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                            </button>
                        </div>

                        <nav class="mo-breadcrumb" aria-label="Navegação">
                            <a href="${missionsIndexUrl}">Missões</a>
                            <span class="mo-breadcrumb-sep">›</span>
                            <span>Fotossíntese</span>
                        </nav>

                        <section class="mo-hero">
                            <div class="mo-hero-info">
                                <h1>${this.mission.title}</h1>
                                <p>${this.mission.description}</p>
                                <div class="mo-hero-meta">
                                    <span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-spreadsheet"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg> ${totalCount} secções</span>
                                    <span>${xpStarIconSvg} +${this.mission.totalXP || 0} XP</span>
                                    ${this.mission.badge ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-11 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg> ${this.mission.badge.name}</span>` : ''}
                                </div>
                            </div>
                            ${window.exploreMascotPlantVideoUrl ? `<video class="mo-hero-video" src="${window.exploreMascotPlantVideoUrl}" autoplay loop muted playsinline></video>` : ''}
                        </section>

                        <section class="mo-index">
                            <h2>Índice da Missão</h2>
                            <p class="mo-index-subtitle">Completa todos os passos para dominares a fotossíntese e ganhares a tua recompensa!</p>

                            <div class="mo-layout">
                                <ol class="mo-index-list">${indexRowsHtml}</ol>

                                <aside class="mo-sidebar">
                                    <div class="mo-card mo-progress-card">
                                        <div class="mo-card-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                                        </div>
                                        <h3>O teu progresso</h3>
                                        <div class="mo-progress-row">
                                            <div class="mo-progress-ring" style="--progress: ${progressPercent}">
                                                <span>${completedCount}/${totalCount}</span>
                                            </div>
                                            <strong class="mo-progress-percent">${progressPercent}%</strong>
                                            ${waveVideoUrl ? `<video class="mo-progress-mascot" src="${waveVideoUrl}" autoplay loop muted playsinline ${imageUrl ? `poster="${imageUrl}"` : ''}></video>` : ''}
                                        </div>
                                        <div class="mo-progress-bar"><div class="mo-progress-bar-fill" style="width:${progressPercent}%"></div></div>
                                        <div class="mo-reward-row">
                                            <span class="mo-reward-icon">${leafIconSvg}</span>
                                            <div class="mo-reward-copy">
                                                <span>Recompensa da missão</span>
                                                <strong>+${this.mission.totalXP || 0} XP</strong>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mo-card mo-next-card">
                                        <div class="mo-card-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
                                        </div>
                                        <h3>Testa os teus conhecimentos</h3>
                                        <p>Já exploraste a matéria? Faz o Teste de Fotossíntese e vê quanto aprendeste!</p>
                                        <a href="${window.exploreFotossinteseTesteUrl || '#'}" class="mo-next-cta">
                                            <span>Fazer o teste</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="mo-next-cta-arrow"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                        </a>
                                    </div>
                                </aside>
                            </div>
                        </section>
                    </div>
                </div>
            `;

            const setSidebarOpen = (isOpen) => {
                const drawer = document.getElementById('profileSidebar');
                const overlay = document.getElementById('sidebarOverlay');
                const page = screen.querySelector('.mo-page');
                if (!drawer || !overlay) return;
                drawer.classList.toggle('is-open', isOpen);
                drawer.setAttribute('aria-hidden', String(!isOpen));
                overlay.toggleAttribute('hidden', !isOpen);
                // Pushes the main content over (instead of dimming it) once
                // there's room for the sidebar to sit beside it rather than
                // on top of it — see the matching min-width rule in CSS.
                page?.classList.toggle('sidebar-open', isOpen);
            };

            screen.querySelector('#navDrawerToggle')?.addEventListener('click', () => {
                const drawer = document.getElementById('profileSidebar');
                setSidebarOpen(!drawer?.classList.contains('is-open'));
            });
            screen.querySelector('#sidebarOverlay')?.addEventListener('click', () => setSidebarOpen(false));

            // Sidebar theme toggle — mirrors the lesson-topbar's own toggle
            // (renderLessonChrome, below) so both stay in sync via the same
            // localStorage key.
            const sidebarThemeToggle = screen.querySelector('#sidebarThemeToggleBtn');
            if (sidebarThemeToggle) {
                const isDark = document.documentElement.dataset.theme === 'dark';
                sidebarThemeToggle.setAttribute('aria-pressed', String(isDark));
                sidebarThemeToggle.addEventListener('click', () => {
                    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                    document.documentElement.dataset.theme = next;
                    document.documentElement.classList.toggle('dark-mode', next === 'dark');
                    try {
                        localStorage.setItem('explore-theme', next);
                    } catch (error) {
                        // Ignore storage errors (private browsing, quota).
                    }
                    sidebarThemeToggle.setAttribute('aria-pressed', String(next === 'dark'));
                });
            }

            screen.querySelector('#profileAccountTrigger')?.addEventListener('click', (event) => {
                event.stopPropagation();
                const menu = document.getElementById('profileAccountMenu');
                if (!menu) return;
                const isOpen = !menu.hidden;
                menu.hidden = isOpen;
                event.currentTarget.setAttribute('aria-expanded', String(!isOpen));
            });

            // Bound once (document persists across re-renders; the sidebar
            // and account menu are looked up fresh each time renderPathScreen()
            // rebuilds the DOM underneath them).
            if (!this._moSidebarGlobalBound) {
                this._moSidebarGlobalBound = true;
                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') setSidebarOpen(false);
                });
                document.addEventListener('click', (event) => {
                    const menu = document.getElementById('profileAccountMenu');
                    const trigger = document.getElementById('profileAccountTrigger');
                    if (menu && !menu.hidden && !menu.contains(event.target) && event.target !== trigger && !trigger?.contains(event.target)) {
                        menu.hidden = true;
                        trigger?.setAttribute('aria-expanded', 'false');
                    }
                });
            }

            if (!this._indexConnectorsResizeBound) {
                this._indexConnectorsResizeBound = true;
                window.addEventListener('resize', () => this.drawIndexConnectors());
            }
        }

        screen.querySelectorAll('[data-section-index]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const target = Number(event.currentTarget.dataset.sectionIndex);
                if (!Number.isInteger(target)) return;
                this.showPathScreen = false;
                this.setActiveSection(target);
            });
        });

        if (introActive) {
            const dismissIntro = () => {
                this.pathIntroActive = false;
                localStorage.setItem(this.mascotIntroSeenKey, '1');
                this.renderPathScreen();
            };

            screen.querySelector('#missionPathSkip')?.addEventListener('click', dismissIntro);
            screen.querySelector('#missionPathNext')?.addEventListener('click', () => {
                if (stepIndex === steps.length - 1) {
                    dismissIntro();
                    return;
                }
                this.pathIntroStep = stepIndex + 1;
                this.renderPathScreen();
            });
            screen.querySelector('#missionPathBack')?.addEventListener('click', () => {
                this.pathIntroStep = Math.max(0, stepIndex - 1);
                this.renderPathScreen();
            });
        }

        this.applyPathScreenVisibility();

        // Only meaningful once the screen is actually visible — measuring
        // icon positions while it (or an ancestor) is still hidden would
        // just read 0×0 rects. applyPathScreenVisibility() above is what
        // unhides it, so this has to run after that, not before.
        if (!introActive) {
            this.drawIndexConnectors();
            // Row heights can shift slightly once the custom webfont finishes
            // loading (line-height/metrics changing after the fallback font
            // was first measured) — redraw once that settles.
            document.fonts?.ready?.then(() => this.drawIndexConnectors());
        }
    }

    /**
     * Draws the dashed "percurso" trail between the índice icons — one
     * segment per gap, from one icon's actual measured bottom edge to the
     * next icon's top edge, so it only ever occupies the gap and can never
     * render on top of an icon (row heights vary with title/subtitle
     * length, so this can't be pinned down with fixed CSS offsets).
     */
    drawIndexConnectors() {
        const list = document.querySelector('.mo-index-list');
        if (!list) return;

        list.querySelectorAll('.mo-index-connector').forEach((el) => el.remove());

        const icons = Array.from(list.querySelectorAll('.mo-index-icon'));
        if (icons.length < 2) return;

        const listRect = list.getBoundingClientRect();
        const edges = icons.map((icon) => {
            const rect = icon.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2 - listRect.left,
                top: rect.top - listRect.top,
                bottom: rect.bottom - listRect.top,
            };
        });

        for (let i = 0; i < edges.length - 1; i++) {
            const from = edges[i];
            const to = edges[i + 1];
            const height = to.top - from.bottom;
            if (height <= 0) continue;

            const segment = document.createElement('div');
            segment.className = 'mo-index-connector';
            segment.style.left = `${from.x}px`;
            segment.style.top = `${from.bottom}px`;
            segment.style.height = `${height}px`;
            list.appendChild(segment);
        }
    }

    /**
     * Render mission header with title and description
     */
    renderHeader() {
        const titleEl = document.getElementById('missionTitle');
        const descriptionEl = document.getElementById('missionDescription');
        if (titleEl) titleEl.textContent = this.mission.title;
        if (descriptionEl) descriptionEl.textContent = this.mission.description;
    }

    getMascotText(key, replacements = {}) {
        const bank = this.mission?.mascot || {};
        let text = bank[key] || '';
        Object.entries(replacements).forEach(([token, value]) => {
            text = text.replace(`{${token}}`, value);
        });
        return text;
    }

    /**
     * The rank title tied to the student's current XP level (e.g.
     * "Explorador!"), used to personalise the mascot's mission-start
     * greeting. Falls back to a generic title if ProfileXP isn't loaded.
     */
    getStudentRankTitle() {
        try {
            const profileXP = window.ProfileXP;
            if (profileXP?.getProfileOverview && profileXP?.getCurrentUserProfile) {
                const overview = profileXP.getProfileOverview(profileXP.getCurrentUserProfile());
                if (overview?.rank) return overview.rank;
            }
        } catch (error) {
            // Fall back to the generic title below.
        }
        return 'Explorador';
    }

    getMascotImageUrl() {
        return window.exploreMascotImageUrl || '';
    }

    getMascotWaveVideoUrl() {
        return window.exploreMascotWaveVideoUrl || '';
    }

    /**
     * Mascot figure used in the overlay dialogs (intro/help/quiz-choice
     * cards): the waving video when available, falling back to the static
     * avatar image so the dialog still renders if the video is missing.
     */
    getMascotOverlayFigureHtml() {
        const waveVideoUrl = this.getMascotWaveVideoUrl();
        const imageUrl = this.getMascotImageUrl();
        if (waveVideoUrl) {
            return `<video class="mascot-overlay-figure" src="${waveVideoUrl}" autoplay loop muted playsinline ${imageUrl ? `poster="${imageUrl}"` : ''}></video>`;
        }
        return imageUrl ? `<img class="mascot-overlay-figure" src="${imageUrl}" alt="Mascote Explore+">` : '';
    }

    /**
     * Total/completed step count for the active section, combining its
     * content screen-cards and quiz questions into one number so the lesson
     * topbar's progress bar reflects real progress through *this* section
     * (not the whole mission — the percurso map already covers that).
     */
    getSectionStepProgress(section) {
        const screenCount = typeof section?.content === 'string'
            ? (section.content.match(/class="screen-card/g) || []).length
            : 0;
        const questions = this.getSectionQuestions(section);
        const totalSteps = Math.max(1, screenCount + questions.length);

        const currentScreen = this.getSectionCurrentScreen(section.id, Math.max(screenCount, 1));
        const answerState = this.getSectionAnswerState(section.id);
        const answeredCount = answerState.answers.filter(Boolean).length;
        const completedSteps = Math.min(screenCount, currentScreen) + answeredCount;

        return { completedSteps, totalSteps };
    }

    /**
     * Lesson chrome: the sidebar (back link, mission name, section list,
     * overall progress) and the topbar (mission title, per-section
     * progress, live XP/streak, theme) plus the floating mascot help
     * button — persistent across every section/screen.
     */
    renderLessonChrome() {
        const topbar = document.getElementById('lessonTopbar');
        if (!topbar) return;

        const maxReviewable = this.getMaxReviewableSectionIndex();
        const sectionIndex = Math.max(0, Math.min(this.activeSectionIndex, maxReviewable));
        const section = this.mission.sections[sectionIndex];
        const isChapterDone = this.completedSections.size === this.mission.sections.length && this.chapterCompletionView;

        const stepProgress = this.getSectionStepProgress(section);
        const percent = isChapterDone ? 100 : Math.round((stepProgress.completedSteps / stepProgress.totalSteps) * 100);

        const fill = document.getElementById('lessonProgressFill');
        if (fill) fill.style.width = `${percent}%`;

        const percentEl = document.getElementById('lessonProgressPercent');
        if (percentEl) percentEl.textContent = `${percent}%`;

        const icon = this.mission.badge?.icon || '🌱';
        const iconEl = document.getElementById('lessonTopbarIcon');
        if (iconEl) iconEl.textContent = icon;
        const titleEl = document.getElementById('lessonTopbarTitle');
        if (titleEl) titleEl.textContent = this.mission.title;

        const statsEl = document.getElementById('lessonStats');
        if (statsEl && window.ProfileXP) {
            const stats = window.ProfileXP.getProfileStats(window.ProfileXP.getCurrentUserProfile());
            statsEl.innerHTML = `
                <span class="lesson-stat" title="XP total">${stats.xp} <strong>XP</strong></span>
            `;
        }

        this.renderMissionSidebar();

        if (!this._lessonChromeBound) {
            this._lessonChromeBound = true;
            document.getElementById('sidebarBackBtn')?.addEventListener('click', () => this.closeLessonToPath());
            this.initMascoteChatPanel();
            window.addEventListener('explore:profile-updated', () => this.renderLessonChrome());

            const themeToggle = document.getElementById('lessonThemeToggle');
            const applyTheme = (theme) => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.classList.toggle('dark-mode', theme === 'dark');
                // Which icon shows (sun/moon) is handled by CSS off this
                // data-theme attribute — see .lesson-theme-toggle rules.
            };
            let initialTheme = 'light';
            try {
                initialTheme = localStorage.getItem('explore-theme') || 'light';
            } catch (error) {
                // Ignore storage access errors (private browsing) — the page
                // just falls back to light mode.
            }
            applyTheme(initialTheme);
            themeToggle?.addEventListener('click', () => {
                const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                try {
                    localStorage.setItem('explore-theme', next);
                } catch (error) {
                    // Ignore storage errors (private browsing, quota) — the
                    // toggle still works for the rest of this visit.
                }
                applyTheme(next);
            });

            this.startAmbientMascotTips();
        }
    }

    /**
     * Sidebar section list + overall progress footer — the mission's
     * persistent left-hand navigation. Rebuilt on every renderLessonChrome
     * call so the active/completed/locked states stay in sync as the
     * student moves between sections.
     */
    renderMissionSidebar() {
        const sidebar = document.getElementById('missionSidebar');
        if (!sidebar) return;

        const icon = this.mission.badge?.icon || '🌱';
        const iconEl = document.getElementById('sidebarMissionIcon');
        if (iconEl) iconEl.textContent = icon;
        const titleEl = document.getElementById('sidebarMissionTitle');
        if (titleEl) titleEl.textContent = this.mission.title;

        const dotsEl = document.getElementById('sidebarProgressDots');
        if (dotsEl) {
            dotsEl.innerHTML = this.mission.sections.map((section, index) => {
                const isCompleted = this.completedSections.has(section.id);
                const isActive = index === this.activeSectionIndex;
                return `<span class="sidebar-progress-dot ${isCompleted ? 'is-completed' : ''} ${isActive ? 'is-active' : ''}"></span>`;
            }).join('');
        }

        const percentEl = document.getElementById('sidebarProgressPercent');
        if (percentEl) percentEl.textContent = `${this.getProgressPercent()}%`;
    }

    /**
     * Kim chimes in on his own every so often with the current section's
     * explorerTip, so the floating button reads as an active companion
     * rather than a static corner icon — not just something that reacts to
     * hover/click.
     */
    startAmbientMascotTips() {
        if (this._ambientTipInterval) return;
        this._ambientTipInterval = setInterval(() => this.maybeShowAmbientMascotTip(), 75000);
    }

    maybeShowAmbientMascotTip() {
        if (this.showPathScreen) return;
        if (document.getElementById('mascotOverlay')) return;

        const bubble = document.getElementById('lessonAmbientTip');
        if (!bubble || !bubble.hidden) return;

        const maxReviewable = this.getMaxReviewableSectionIndex();
        const sectionIndex = Math.max(0, Math.min(this.activeSectionIndex, maxReviewable));
        const tip = this.mission.sections[sectionIndex]?.explorerTip;
        if (!tip) return;

        const textEl = document.getElementById('lessonAmbientTipText');
        if (textEl) textEl.textContent = tip;
        bubble.hidden = false;

        clearTimeout(this._ambientTipTimeout);
        this._ambientTipTimeout = setTimeout(() => {
            bubble.hidden = true;
        }, 7000);
    }

    /**
     * The X button: leaves the current section and returns to the percurso
     * map, without losing any saved progress.
     */
    closeLessonToPath() {
        this.showPathScreen = true;
        this.render();
    }

    /** Returns the currently visible screen-card or quiz question element. */
    getActiveCardElement() {
        return document.querySelector('.screen-card.active-screen')
            || document.querySelector('.section-quiz:not(.quiz-entry-hidden)');
    }

    /**
     * Wires up the chat panel's controls once — it's a permanent fixture in
     * the sidebar now (replacing the section list), where the student can
     * type a real question to the mascot (answered by Claude, grounded in
     * this card's content — see mascote_chat() in views.py), so this just
     * needs to run once on the first render rather than on open/close.
     */
    initMascoteChatPanel() {
        if (this._chatPanelBound) return;
        this._chatPanelBound = true;
        this.chatHistory = [];

        document.getElementById('mascoteChatForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.sendMascoteChatMessage();
        });
    }

    appendChatMessage(role, text, isTyping = false) {
        const messagesEl = document.getElementById('mascoteChatMessages');
        if (!messagesEl) return null;

        const bubble = document.createElement('div');
        bubble.className = `mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}`;
        bubble.textContent = text;
        messagesEl.appendChild(bubble);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return bubble;
    }

    /** Sends the student's typed question to the backend chat endpoint,
     *  which proxies it to Claude with this section's content as context. */
    async sendMascoteChatMessage() {
        const input = document.getElementById('mascoteChatInput');
        const text = input?.value.trim();
        if (!text) return;

        input.value = '';
        this.appendChatMessage('user', text);
        const historyBeforeThisMessage = [...(this.chatHistory || [])];
        this.chatHistory = [...historyBeforeThisMessage, { role: 'user', text }];

        const typingEl = this.appendChatMessage('assistant', '…', true);

        const maxReviewable = this.getMaxReviewableSectionIndex();
        const sectionIndex = Math.max(0, Math.min(this.activeSectionIndex, maxReviewable));
        const section = this.mission.sections[sectionIndex];
        const activeCard = this.getActiveCardElement();
        const context = activeCard ? this.extractCardAudioText(activeCard) : '';

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
                    missionTitle: this.mission.title,
                    sectionTitle: section?.title || '',
                    context,
                    history: historyBeforeThisMessage
                })
            });

            const data = await response.json().catch(() => ({}));
            typingEl?.remove();

            if (!response.ok) {
                this.appendChatMessage('assistant', data.erro || 'Não consegui responder agora. Tenta mais tarde.');
                if (data.limiteAtingido) {
                    this.disableMascoteChatInput();
                }
                return;
            }

            this.appendChatMessage('assistant', data.reply || '...');
            this.chatHistory.push({ role: 'assistant', text: data.reply || '' });
        } catch (error) {
            typingEl?.remove();
            this.appendChatMessage('assistant', 'Não consegui ligar ao servidor. Verifica a tua ligação.');
        }
    }

    /**
     * Once the weekly chat quota is spent, stop the student from retrying
     * (each attempt would just re-trigger the same 429) until next week.
     */
    disableMascoteChatInput() {
        const input = document.getElementById('mascoteChatInput');
        const sendBtn = document.getElementById('mascoteChatSend');
        if (input) {
            input.disabled = true;
            input.placeholder = 'Sem perguntas disponíveis esta semana';
        }
        if (sendBtn) sendBtn.disabled = true;
    }

    attachCuriosityPrompts(sectionEl) {
        const screens = Array.from(sectionEl.querySelectorAll('.screen-card'));

        sectionEl.querySelectorAll('.screen-card details.did-you-know:not([data-mascot-managed])').forEach((detailsEl) => {
            detailsEl.setAttribute('data-mascot-managed', 'true');
            detailsEl.classList.add('mascot-managed-hidden');

            const summaryText = detailsEl.querySelector('summary')?.textContent?.trim() || 'Saber mais...';
            const innerHtml = Array.from(detailsEl.children)
                .filter((child) => child.tagName.toLowerCase() !== 'summary')
                .map((child) => child.outerHTML)
                .join('');

            const prompt = document.createElement('div');
            prompt.className = 'mascot-curiosity-trigger';
            prompt.innerHTML = `<button type="button" class="mascot-curiosity-open-btn">💬 ${summaryText}</button>`;
            // Remembers which screen-card this trigger belongs to, so
            // updateSectionScreen() can relocate it into the nav row's left
            // slot on that one screen (when there's no "Anterior" there to
            // occupy it) and move it back home on every other screen.
            const homeScreenIndex = screens.indexOf(detailsEl.closest('.screen-card'));
            if (homeScreenIndex >= 0) {
                prompt.dataset.homeScreenIndex = String(homeScreenIndex);
            }
            detailsEl.insertAdjacentElement('afterend', prompt);

            prompt.querySelector('.mascot-curiosity-open-btn').addEventListener('click', () => {
                this.showMascotCuriosityPrompt(innerHtml);
            });
        });
    }

    showMascotCuriosityPrompt(factHtml) {
        this.showMascotOverlay(factHtml, this.getMascotText('curiosityAcceptCta') || 'Entendido', () => {}, { extraClass: 'mascot-overlay-card--curiosity' });
    }

    showMascotOverlay(message, ctaLabel, onContinue, { extraClass = '' } = {}) {
        const existing = document.getElementById('mascotOverlay');
        if (existing) existing.remove();

        // Curiosity popups skip the mascot figure entirely — the
        // illustration below the (now removed) ask-mascot button already
        // carries the topic on its own.
        const isCuriosity = extraClass.includes('curiosity');
        const overlay = document.createElement('div');
        overlay.id = 'mascotOverlay';
        overlay.className = 'mascot-overlay';
        overlay.innerHTML = `
            <div class="mascot-overlay-card ${extraClass}" role="dialog" aria-modal="true" aria-label="Mensagem da mascote">
                ${!isCuriosity ? this.getMascotOverlayFigureHtml() : ''}
                <div class="mascot-overlay-text">${message}</div>
                <button type="button" class="mascot-overlay-btn">${ctaLabel}</button>
            </div>
        `;

        overlay.querySelector('.mascot-overlay-btn')?.addEventListener('click', () => {
            overlay.remove();
            if (typeof onContinue === 'function') onContinue();
        });

        document.body.appendChild(overlay);
    }

    showMascotIntroDialog(section) {
        const message = section.introGreeting
            || this.getMascotText('introGreeting', { missionTitle: this.mission.title, sectionTitle: section.title });
        const cta = section.introCta || this.getMascotText('introCta') || 'Continuar';
        this.showMascotOverlay(message, cta, () => {});
    }

    /**
     * Same overlay shell again, but the dismiss control is styled like the
     * mascot's "Ajuda" button rather than a plain CTA — used by the
     * floating help button.
     */
    showMascotHelpOverlay(message) {
        const existing = document.getElementById('mascotOverlay');
        if (existing) existing.remove();

        const imageUrl = this.getMascotImageUrl();
        const overlay = document.createElement('div');
        overlay.id = 'mascotOverlay';
        overlay.className = 'mascot-overlay';
        overlay.innerHTML = `
            <div class="mascot-overlay-card" role="dialog" aria-modal="true" aria-label="Mensagem da mascote">
                ${this.getMascotOverlayFigureHtml()}
                <p class="mascot-overlay-text">${message}</p>
                <button type="button" class="mascot-help-btn mascot-overlay-help-btn">
                    ${imageUrl ? `<img class="mascot-help-btn-icon" src="${imageUrl}" alt="">` : '🙋'}
                    Ajuda
                </button>
            </div>
        `;

        overlay.querySelector('.mascot-overlay-help-btn')?.addEventListener('click', () => {
            overlay.remove();
        });

        document.body.appendChild(overlay);
    }

    revealSectionQuiz(sectionEl, section, { scrollToQuiz = true } = {}) {
        const quizEl = sectionEl.querySelector('.section-quiz');
        if (!quizEl) return;

        const contentEl = sectionEl.querySelector('.section-content');
        const screens = contentEl ? Array.from(contentEl.querySelectorAll('.screen-card')) : [];

        const doReveal = () => {
            this.openQuizEntryForSection(section.id);
            this.quizViewActive[section.id] = true;
            // Re-run through updateSectionScreen (rather than toggling classes
            // here directly) so it's the single source of truth for which
            // page-nav button ends up marked "active" — otherwise the "3" pip
            // and the "Q" pip can both end up looking selected at once.
            if (screens.length) {
                this.updateSectionScreen(sectionEl, section, screens.length - 1, false);
            }
            if (scrollToQuiz) {
                quizEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        if (this.mascotQuizIntroShown[section.id]) {
            doReveal();
            return;
        }

        this.mascotQuizIntroShown[section.id] = true;
        const message = this.getMascotText('quizIntro', { missionTitle: this.mission.title, sectionTitle: section.title });
        const cta = this.getMascotText('quizIntroCta') || 'Vamos lá!';
        // The student can decline the quiz — nothing happens (the overlay
        // just closes), which naturally leaves this section's circle
        // unfinished and blocks moving on, since completion only ever
        // happens once the quiz is actually answered.
        this.showMascotQuizChoiceOverlay(message, cta, doReveal, 'Talvez mais tarde', () => {});
    }

    showMascotQuizChoiceOverlay(message, primaryLabel, onPrimary, secondaryLabel, onSecondary) {
        const existing = document.getElementById('mascotOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'mascotOverlay';
        overlay.className = 'mascot-overlay';
        overlay.innerHTML = `
            <div class="mascot-overlay-card" role="dialog" aria-modal="true" aria-label="Mensagem da mascote">
                ${this.getMascotOverlayFigureHtml()}
                <div class="mascot-overlay-text">${message}</div>
                <div class="mascot-overlay-choice-row">
                    <button type="button" class="mascot-overlay-btn">${primaryLabel}</button>
                    <button type="button" class="mascot-overlay-choice-btn">${secondaryLabel}</button>
                </div>
            </div>
        `;

        overlay.querySelector('.mascot-overlay-btn')?.addEventListener('click', () => {
            overlay.remove();
            if (typeof onPrimary === 'function') onPrimary();
        });

        overlay.querySelector('.mascot-overlay-choice-btn')?.addEventListener('click', () => {
            overlay.remove();
            if (typeof onSecondary === 'function') onSecondary();
        });

        document.body.appendChild(overlay);
    }

    showMascotCorrectPopup() {
        const existing = document.getElementById('mascotCorrectPopup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'mascotCorrectPopup';
        popup.className = 'mascot-popup-correct';
        popup.textContent = this.getMascotText('correctPopup') || 'Boa! 👍';

        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.classList.add('show'));

        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        }, 1400);
    }

    isScreenFlowEnabled() {
        return this.mission?.screenFlowEnabled === true;
    }

    supportsCardAudio() {
        return typeof window !== 'undefined'
            && 'speechSynthesis' in window
            && typeof SpeechSynthesisUtterance !== 'undefined';
    }

    extractCardAudioText(cardEl) {
        const parts = Array.from(cardEl.querySelectorAll('p:not(.quiz-question)'))
            .map((el) => el.textContent.trim())
            .filter(Boolean);
        return parts.join('. ');
    }

    // Voice/read-aloud is parked as a future feature — playCardAudio,
    // extractCardAudioText and supportsCardAudio below are the dormant
    // engine for it; there's just no button wired to them right now.

    resetCardAudioButton(button) {
        if (!button) {
            return;
        }

        button.classList.remove('is-speaking');
    }

    stopCardAudio() {
        if (this.supportsCardAudio()) {
            window.speechSynthesis.cancel();
        }

        this.resetCardAudioButton(this.activeCardAudioButton);
        this.activeCardAudioButton = null;
    }

    /**
     * Reads `text` aloud via the browser's speech synthesis. `button` gets
     * an `.is-speaking` class while playing (for a talking/pulse animation)
     * — clicking the same button again while it's speaking stops it.
     */
    playCardAudio(text, button) {
        if (!this.supportsCardAudio() || !text) {
            return;
        }

        const isSameButton = this.activeCardAudioButton === button;
        if (isSameButton && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
            this.stopCardAudio();
            return;
        }

        this.stopCardAudio();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-PT';
        utterance.rate = 1;
        utterance.pitch = 1;

        utterance.onstart = () => {
            this.activeCardAudioButton = button;
            button?.classList.add('is-speaking');
        };

        utterance.onend = () => {
            this.resetCardAudioButton(button);
            if (this.activeCardAudioButton === button) {
                this.activeCardAudioButton = null;
            }
        };

        utterance.onerror = () => {
            this.resetCardAudioButton(button);
            if (this.activeCardAudioButton === button) {
                this.activeCardAudioButton = null;
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    /**
     * Return normalized question list for a section
     */
    getSectionQuestions(section) {
        if (Array.isArray(section.quiz?.questions) && section.quiz.questions.length > 0) {
            return section.quiz.questions;
        }

        if (section.quiz?.question && Array.isArray(section.quiz.options)) {
            return [{
                question: section.quiz.question,
                options: section.quiz.options,
                feedback: section.quiz.feedback || { correct: 'Correto!', incorrect: 'Tenta novamente.' }
            }];
        }

        return [];
    }

    getSectionAnswerState(sectionId) {
        const saved = this.userAnswers[sectionId];
        if (saved && Array.isArray(saved.answers)) {
            return saved;
        }

        return { answers: [] };
    }

    getOpenAnswerDraft(sectionId, questionIndex) {
        const sectionDrafts = this.openAnswerDrafts?.[sectionId];
        if (!sectionDrafts || typeof sectionDrafts !== 'object') {
            return '';
        }

        const draft = sectionDrafts[String(questionIndex)];
        return typeof draft === 'string' ? draft : '';
    }

    setOpenAnswerDraft(sectionId, questionIndex, text) {
        if (!this.openAnswerDrafts[sectionId] || typeof this.openAnswerDrafts[sectionId] !== 'object') {
            this.openAnswerDrafts[sectionId] = {};
        }

        this.openAnswerDrafts[sectionId][String(questionIndex)] = text;
    }

    clearOpenAnswerDraft(sectionId, questionIndex) {
        const sectionDrafts = this.openAnswerDrafts?.[sectionId];
        if (!sectionDrafts || typeof sectionDrafts !== 'object') {
            return;
        }

        delete sectionDrafts[String(questionIndex)];
        if (Object.keys(sectionDrafts).length === 0) {
            delete this.openAnswerDrafts[sectionId];
        }
    }

    hydrateGuideState(sectionEl, section) {
        const saved = this.guideAnswerState?.[section.id];
        if (!saved) {
            return;
        }

        sectionEl.querySelectorAll('.guide-options').forEach(container => {
            const selectedButton = container.querySelector(`.guide-option[data-choice="${saved.selectedChoice}"]`);

            container.querySelectorAll('.guide-option').forEach(opt => {
                opt.disabled = true;
                if (opt.dataset.correct === 'true') {
                    opt.classList.add('correct');
                } else if (selectedButton && opt === selectedButton) {
                    opt.classList.add('incorrect');
                }
            });

            const feedbackEl = container.parentElement.querySelector('.neutral-feedback');
            if (feedbackEl) {
                feedbackEl.classList.add('show');
            }
        });
    }

    bindOpenQuizDraftAutosave(sectionEl, section) {
        sectionEl.querySelectorAll('.open-quiz-input').forEach((textarea) => {
            textarea.addEventListener('input', (event) => {
                const questionIndex = Number(event.target.dataset.questionIndex);
                if (!Number.isInteger(questionIndex)) {
                    return;
                }

                this.setOpenAnswerDraft(section.id, questionIndex, event.target.value);
                this.saveProgress();
            });
        });
    }

    getMaxReviewableSectionIndex() {
        if (this.completedSections.size === this.mission.sections.length) {
            return this.mission.sections.length - 1;
        }

        return Math.min(this.currentSectionIndex, this.mission.sections.length - 1);
    }

    setActiveSection(sectionIndex) {
        const maxReviewable = this.getMaxReviewableSectionIndex();
        const safeIndex = Math.max(0, Math.min(maxReviewable, sectionIndex));
        this.activeSectionIndex = safeIndex;
        this.chapterCompletionView = false;
        this.saveProgress();
        this.render();
        this.scrollToElement(`#missao-${safeIndex + 1}`);
    }

    reviewCompletedMissions() {
        this.setActiveSection(0);
    }

    showChapterCompletionView() {
        this.chapterCompletionView = true;
        this.saveProgress();
        this.render();
        this.scrollToElement('#chapterCompleteCta');
    }

    normalizeKeywordText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}+]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isSectionUnlocked(sectionIndex) {
        return sectionIndex <= this.currentSectionIndex;
    }

    getSectionCurrentScreen(sectionId, totalScreens) {
        const savedIndex = this.sectionScreenProgress?.[sectionId];
        if (!Number.isInteger(savedIndex)) {
            return 0;
        }

        return Math.max(0, Math.min(savedIndex, totalScreens - 1));
    }

    setSectionCurrentScreen(sectionId, targetIndex, totalScreens) {
        const safeIndex = Math.max(0, Math.min(targetIndex, totalScreens - 1));
        this.sectionScreenProgress[sectionId] = safeIndex;
        this.saveProgress();
        return safeIndex;
    }

    mountSectionScreenFlow(sectionEl, section) {
        const contentEl = sectionEl.querySelector('.section-content');
        if (!contentEl) return;

        const screens = Array.from(contentEl.querySelectorAll('.screen-card'));
        if (screens.length <= 1) return;

        contentEl.classList.add('screen-mode');

        const existingNav = sectionEl.querySelector('.screen-nav');
        if (!existingNav) {
            const navEl = document.createElement('div');
            navEl.className = 'screen-nav';
            navEl.innerHTML = `
                <button type="button" class="screen-nav-btn screen-nav-btn--prev" data-nav-action="prev">← Anterior</button>
                <button type="button" class="screen-nav-btn" data-nav-action="next">Continuar →</button>
            `;

            const quizEl = sectionEl.querySelector('.section-quiz');
            if (quizEl) {
                quizEl.insertAdjacentElement('beforebegin', navEl);
            } else {
                contentEl.insertAdjacentElement('afterend', navEl);
            }
        }

        const currentScreen = this.getSectionCurrentScreen(section.id, screens.length);
        this.updateSectionScreen(sectionEl, section, currentScreen, false);

        sectionEl.querySelectorAll('[data-nav-action]').forEach(button => {
            button.addEventListener('click', (event) => this.handleScreenNav(event, sectionEl, section));
        });


        sectionEl.querySelectorAll('.mission-jump-screen').forEach(button => {
            button.addEventListener('click', (event) => this.handleScreenJump(event, sectionEl, section));
        });

        this.bindPhaseClearSequence(sectionEl);
        this.bindCalvinCycleBuilder(sectionEl);
        this.bindFormulaBuilder(sectionEl);
    }

    bindFormulaBuilder(sectionEl) {
        const builder = sectionEl.querySelector('.formula-builder');
        if (!builder) return;

        const widgetKey = `formula-builder:${sectionEl.dataset.sectionId || ''}`;
        const pool = builder.querySelector('.formula-pool');
        const slots = Array.from(builder.querySelectorAll('.formula-slot'));
        const reactantSlots = slots.filter((slot) => slot.dataset.zone === 'reactant');
        const productSlots = slots.filter((slot) => slot.dataset.zone === 'product');
        const expectedReactants = new Set(['co2', 'h2o']);
        const expectedProducts = new Set(['glicose', 'o2']);
        const pieces = Array.from(builder.querySelectorAll('.formula-piece'));
        const feedbackEl = builder.querySelector('.formula-builder-feedback');

        let draggedPiece = null;
        let completed = !!this.widgetCompletions[widgetKey];

        const setFeedback = (html, type) => {
            if (!feedbackEl) return;
            feedbackEl.innerHTML = html;
            feedbackEl.classList.remove('success', 'error');
            if (type) feedbackEl.classList.add(type);
        };

        const setPlaceholderHidden = (slot, hidden) => {
            slot?.querySelector('.formula-slot-placeholder')?.classList.toggle('is-hidden', hidden);
        };

        const evaluate = () => {
            const allFilled = slots.every((slot) => !!slot.querySelector('.formula-piece'));
            if (!allFilled) {
                // Red only ever applies to a fully-filled, wrong equation —
                // as soon as a piece comes back out, the slate is clean.
                slots.forEach((slot) => slot.classList.remove('is-wrong'));
                setFeedback('Arrasta as 4 peças para os espaços da equação.');
                return;
            }

            // Order within each side of the equation doesn't matter
            // chemically (6CO2 + 6H2O reads the same as 6H2O + 6CO2), so
            // only the reactant/product grouping is checked, not the exact
            // slot each piece landed in.
            const reactantsOk = reactantSlots.every((slot) => expectedReactants.has(slot.querySelector('.formula-piece')?.dataset.piece));
            const productsOk = productSlots.every((slot) => expectedProducts.has(slot.querySelector('.formula-piece')?.dataset.piece));
            const isCorrect = reactantsOk && productsOk;

            if (!isCorrect) {
                reactantSlots.forEach((slot) => slot.classList.toggle('is-wrong', !reactantsOk));
                productSlots.forEach((slot) => slot.classList.toggle('is-wrong', !productsOk));
                setFeedback('Ainda não está certo. Tenta trocar as peças.', 'error');
                return;
            }

            slots.forEach((slot) => slot.classList.remove('is-wrong'));
            builder.classList.add('completed');
            pieces.forEach((piece) => piece.setAttribute('draggable', 'false'));
            completed = true;

            if (!this.widgetCompletions[widgetKey]) {
                this.widgetCompletions[widgetKey] = true;
                this.earnedXP += 15;
                this.awardProfileXP(15, this.buildRewardSource('formula-builder', `${this.mission.id}:${sectionEl.dataset.sectionId || ''}`), { type: 'exercise' });
                this.saveProgress();
                setFeedback('Perfeito! É esta a equação da fotossíntese. +15 <strong>XP</strong>', 'success');
            } else {
                setFeedback('Perfeito! É esta a equação da fotossíntese.', 'success');
            }
        };

        const placePieceInSlot = (piece, slot) => {
            if (!piece || !slot || completed) return;

            const currentParentSlot = piece.closest('.formula-slot');
            if (currentParentSlot && currentParentSlot !== slot) {
                setPlaceholderHidden(currentParentSlot, false);
            }

            const occupying = slot.querySelector('.formula-piece');
            if (occupying && occupying !== piece && pool) {
                pool.appendChild(occupying);
            }

            setPlaceholderHidden(slot, true);
            slot.appendChild(piece);
            evaluate();
        };

        const returnPieceToPool = (piece) => {
            if (!piece || !pool || completed) return;

            const parentSlot = piece.closest('.formula-slot');
            if (parentSlot) setPlaceholderHidden(parentSlot, false);

            pool.appendChild(piece);
            evaluate();
        };

        pieces.forEach((piece) => {
            piece.addEventListener('dragstart', (event) => {
                if (completed) {
                    event.preventDefault();
                    return;
                }

                draggedPiece = piece;
                event.dataTransfer.setData('text/plain', piece.dataset.piece || '');
                event.dataTransfer.effectAllowed = 'move';
            });

            piece.addEventListener('dragend', () => {
                draggedPiece = null;
            });
        });

        slots.forEach((slot) => {
            slot.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            });

            slot.addEventListener('drop', (event) => {
                event.preventDefault();
                if (completed) return;

                const pieceName = event.dataTransfer.getData('text/plain');
                const piece = draggedPiece || builder.querySelector(`.formula-piece[data-piece="${pieceName}"]`);
                placePieceInSlot(piece, slot);
            });
        });

        if (pool) {
            pool.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            });

            pool.addEventListener('drop', (event) => {
                event.preventDefault();
                if (completed) return;

                const pieceName = event.dataTransfer.getData('text/plain');
                const piece = draggedPiece || builder.querySelector(`.formula-piece[data-piece="${pieceName}"]`);
                returnPieceToPool(piece);
            });
        }

        if (completed) {
            // Already solved on a previous visit — restore a valid solved
            // layout (any reactant-pair/product-pair split is equally
            // correct, so this canonical arrangement is as good as whatever
            // the student actually dragged) without re-awarding XP.
            const canonicalPlacement = [
                [reactantSlots[0], 'co2'],
                [reactantSlots[1], 'h2o'],
                [productSlots[0], 'glicose'],
                [productSlots[1], 'o2']
            ];
            canonicalPlacement.forEach(([slot, pieceKey]) => {
                const piece = builder.querySelector(`.formula-piece[data-piece="${pieceKey}"]`);
                if (slot && piece) {
                    setPlaceholderHidden(slot, true);
                    slot.appendChild(piece);
                    piece.setAttribute('draggable', 'false');
                }
            });
            builder.classList.add('completed');
            setFeedback('Perfeito! É esta a equação da fotossíntese.', 'success');
        } else {
            setFeedback('Arrasta as 4 peças para os espaços da equação.');
        }

        // Lets the student redo the exercise for practice — the XP was
        // already banked via widgetCompletions, so solving it again never
        // re-awards it.
        builder.querySelector('.formula-builder-reset-btn')?.addEventListener('click', () => {
            completed = false;
            builder.classList.remove('completed');

            pieces.forEach((piece) => {
                piece.setAttribute('draggable', 'true');
                pool?.appendChild(piece);
            });
            slots.forEach((slot) => {
                setPlaceholderHidden(slot, false);
                slot.classList.remove('is-wrong');
            });

            setFeedback('Arrasta as 4 peças para os espaços da equação.');
        });
    }

    bindCalvinCycleBuilder(sectionEl) {
        sectionEl.querySelectorAll('.calvin-cycle-builder').forEach((builder) => {
            const pool = builder.querySelector('.cycle-pool');
            const slots = Array.from(builder.querySelectorAll('.cycle-slot'));
            const pieces = Array.from(builder.querySelectorAll('.cycle-piece'));
            const feedbackEl = builder.querySelector('.cycle-feedback');
            const resetBtn = builder.querySelector('.cycle-reset-btn');
            const correctBySlot = {
                co2: 'co2',
                rubp: 'rubp',
                fixacao: 'fixacao',
                g3p: 'g3p',
                regeneracao: 'regeneracao'
            };

            let draggedPiece = null;
            let completed = false;

            const setFeedback = (text, type) => {
                if (!feedbackEl) {
                    return;
                }

                feedbackEl.textContent = text;
                feedbackEl.classList.remove('success', 'error');
                if (type) {
                    feedbackEl.classList.add(type);
                }
            };

            const normalizeSlotState = () => {
                slots.forEach((slot) => {
                    slot.classList.toggle('filled', !!slot.querySelector('.cycle-piece'));
                });
            };

            const evaluateCycle = () => {
                const allFilled = slots.every((slot) => !!slot.querySelector('.cycle-piece'));
                if (!allFilled) {
                    builder.classList.remove('completed');
                    completed = false;
                    setFeedback('Coloca as peças nas posições certas do círculo.');
                    return;
                }

                const isCorrect = slots.every((slot) => {
                    const piece = slot.querySelector('.cycle-piece');
                    return piece && piece.dataset.piece === correctBySlot[slot.dataset.slot];
                });

                if (isCorrect) {
                    completed = true;
                    builder.classList.add('completed');
                    pieces.forEach((piece) => {
                        piece.setAttribute('draggable', 'false');
                    });
                    setFeedback('Perfeito! O ciclo está completo.', 'success');
                } else {
                    completed = false;
                    builder.classList.remove('completed');
                    setFeedback('Ainda não está na ordem certa. Ajusta as peças.', 'error');
                }
            };

            const placePieceInSlot = (piece, slot) => {
                if (!piece || !slot || completed) {
                    return;
                }

                const currentParentSlot = piece.closest('.cycle-slot');
                if (currentParentSlot && currentParentSlot !== slot) {
                    currentParentSlot.classList.remove('filled');
                }

                const occupyingPiece = slot.querySelector('.cycle-piece');
                if (occupyingPiece && occupyingPiece !== piece && pool) {
                    occupyingPiece.classList.remove('placed');
                    occupyingPiece.setAttribute('draggable', 'true');
                    pool.appendChild(occupyingPiece);
                }

                piece.classList.add('placed');
                piece.setAttribute('draggable', 'true');
                slot.appendChild(piece);

                normalizeSlotState();
                evaluateCycle();
            };

            const returnPieceToPool = (piece) => {
                if (!piece || !pool || completed) {
                    return;
                }

                const parentSlot = piece.closest('.cycle-slot');
                if (parentSlot) {
                    parentSlot.classList.remove('filled');
                }

                piece.classList.remove('placed');
                piece.setAttribute('draggable', 'true');
                pool.appendChild(piece);

                normalizeSlotState();
                evaluateCycle();
            };

            pieces.forEach((piece) => {
                piece.addEventListener('dragstart', (event) => {
                    if (completed) {
                        event.preventDefault();
                        return;
                    }

                    draggedPiece = piece;
                    event.dataTransfer.setData('text/plain', piece.dataset.piece || '');
                    event.dataTransfer.effectAllowed = 'move';
                });

                piece.addEventListener('dragend', () => {
                    draggedPiece = null;
                });
            });

            slots.forEach((slot) => {
                slot.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                });

                slot.addEventListener('drop', (event) => {
                    event.preventDefault();
                    if (completed) {
                        return;
                    }

                    const pieceName = event.dataTransfer.getData('text/plain');
                    const piece = draggedPiece || builder.querySelector(`.cycle-piece[data-piece="${pieceName}"]`);
                    placePieceInSlot(piece, slot);
                });
            });

            if (pool) {
                pool.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                });

                pool.addEventListener('drop', (event) => {
                    event.preventDefault();
                    if (completed) {
                        return;
                    }

                    const pieceName = event.dataTransfer.getData('text/plain');
                    const piece = draggedPiece || builder.querySelector(`.cycle-piece[data-piece="${pieceName}"]`);
                    returnPieceToPool(piece);
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    completed = false;
                    builder.classList.remove('completed');

                    pieces
                        .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
                        .forEach((piece) => {
                            piece.classList.remove('placed');
                            piece.setAttribute('draggable', 'true');
                            pool?.appendChild(piece);
                        });

                    normalizeSlotState();
                    setFeedback('Coloca as peças nas posições certas do círculo.');
                });
            }

            normalizeSlotState();
            setFeedback('Coloca as peças nas posições certas do círculo.');
        });
    }

    bindPhaseClearSequence(sectionEl) {
        const widgetKey = `phase-clear-sequence:${sectionEl.dataset.sectionId || ''}`;
        sectionEl.querySelectorAll('.phase-clear-sequence').forEach((container) => {
            const options = Array.from(container.querySelectorAll('.sequence-option'));
            const feedbackEl = container.querySelector('.sequence-feedback');
            const currentEl = container.querySelector('.sequence-current');
            const resultEl = container.querySelector('.sequence-result');
            const finalEl = container.querySelector('.sequence-final');
            const resetBtn = container.querySelector('.sequence-reset');
            const nodes = Array.from(container.querySelectorAll('.chain-node'));
            const links = Array.from(container.querySelectorAll('.chain-link'));
            const expectedOrder = [1, 2, 3, 4, 5];
            let currentOrder = [];
            let completed = false;

            const clearChain = () => {
                nodes.forEach((node) => node.classList.remove('lit'));
                links.forEach((link) => link.classList.remove('lit'));
                if (finalEl) {
                    finalEl.classList.remove('blink');
                }
            };

            const renderCurrentOrder = () => {
                if (!currentEl) return;

                currentEl.innerHTML = currentOrder
                    .map((step) => {
                        const label = options.find((opt) => Number(opt.dataset.step) === step)?.textContent || `Passo ${step}`;
                        return `<span class="sequence-chip">${step}. ${label}</span>`;
                    })
                    .join('');
            };

            const playChainAnimation = () => {
                clearChain();

                nodes.forEach((node, idx) => {
                    setTimeout(() => {
                        node.classList.add('lit');
                    }, idx * 260);

                    if (idx < links.length) {
                        setTimeout(() => {
                            links[idx].classList.add('lit');
                        }, idx * 260 + 150);
                    }
                });

                if (finalEl) {
                    setTimeout(() => {
                        finalEl.classList.add('blink');
                    }, nodes.length * 260 + 120);
                }
            };

            const resetSequence = () => {
                completed = false;
                currentOrder = [];

                options.forEach((opt) => {
                    opt.disabled = false;
                    opt.classList.remove('selected');
                });

                clearChain();
                renderCurrentOrder();

                if (feedbackEl) {
                    feedbackEl.textContent = 'Seleciona os elementos pela ordem correta.';
                    feedbackEl.classList.remove('success', 'error');
                }

                if (resultEl) {
                    resultEl.setAttribute('aria-hidden', 'true');
                }
            };

            options.forEach((button) => {
                button.addEventListener('click', () => {
                    if (completed || button.disabled) {
                        return;
                    }

                    const step = Number(button.dataset.step);
                    if (!Number.isInteger(step)) {
                        return;
                    }

                    currentOrder.push(step);
                    button.disabled = true;
                    button.classList.add('selected');
                    renderCurrentOrder();

                    if (currentOrder.length < expectedOrder.length) {
                        return;
                    }

                    const isCorrect = expectedOrder.every((value, index) => value === currentOrder[index]);
                    if (isCorrect) {
                        completed = true;
                        if (feedbackEl) {
                            feedbackEl.textContent = 'Perfeito. Sequência completa da fase clara!';
                            feedbackEl.classList.add('success');
                            feedbackEl.classList.remove('error');
                        }

                        if (resultEl) {
                            resultEl.setAttribute('aria-hidden', 'false');
                        }

                        if (!this.widgetCompletions[widgetKey]) {
                            this.widgetCompletions[widgetKey] = true;
                            this.earnedXP += 10;
                            this.awardProfileXP(10, this.buildRewardSource('phase-clear-sequence', widgetKey), { type: 'exercise' });
                            this.saveProgress();
                        }

                        playChainAnimation();
                        return;
                    }

                    if (feedbackEl) {
                        feedbackEl.textContent = 'Ordem incorreta. Clica em "Tentar novamente".';
                        feedbackEl.classList.add('error');
                        feedbackEl.classList.remove('success');
                    }
                });
            });

            if (resetBtn) {
                resetBtn.addEventListener('click', resetSequence);
            }

            resetSequence();
        });
    }

    /**
     * Whether the "← Anterior" button has anything to go back to.
     */
    hasReachablePrevScreen(screens, index) {
        return index > 0;
    }

    updateSectionScreen(sectionEl, section, targetIndex, shouldScroll = true, { direction = 'forward' } = {}) {
        const contentEl = sectionEl.querySelector('.section-content');
        if (!contentEl) return;

        const screens = Array.from(contentEl.querySelectorAll('.screen-card'));
        if (!screens.length) return;

        const safeIndex = this.setSectionCurrentScreen(section.id, targetIndex, screens.length);

        screens.forEach((screen, index) => {
            screen.classList.toggle('active-screen', index === safeIndex);
            screen.classList.toggle('hidden-screen', index !== safeIndex);
        });

        // Any vocabulary word on the screen the student just landed on goes
        // straight into their dictionary/concepts panel — not just the ones
        // revealed through a plant-diagram hotspot. Gated on showPathScreen
        // because this same method also runs silently while the section's
        // DOM is first mounted behind the percurso overview, before the
        // student has actually opened it.
        if (!this.showPathScreen) {
            screens[safeIndex]?.querySelectorAll('.key-term').forEach((el) => {
                this.registerDiscoveredWord(el.textContent);
            });
        }

        const navEl = sectionEl.querySelector('.screen-nav');
        const isLast = safeIndex === screens.length - 1;

        if (navEl) {
            const prevBtn = navEl.querySelector('[data-nav-action="prev"]');
            const nextBtn = navEl.querySelector('[data-nav-action="next"]');
            const hasPrev = this.hasReachablePrevScreen(screens, safeIndex);
            if (prevBtn) {
                prevBtn.style.display = hasPrev ? '' : 'none';
            }
            if (nextBtn) {
                nextBtn.textContent = isLast ? 'Ver quiz →' : 'Continuar →';
            }

            // The "Saber mais" trigger lines up with Continuar, on the left,
            // only on screens with no "Anterior" to occupy that spot (there's
            // one shared nav row per section, so whichever screen is active
            // "borrows" it, and any previously relocated trigger goes home).
            const relocatedTrigger = navEl.querySelector('.mascot-curiosity-trigger');
            if (relocatedTrigger) {
                const homeScreen = screens[Number(relocatedTrigger.dataset.homeScreenIndex)];
                const homeDetails = homeScreen?.querySelector('details.did-you-know[data-mascot-managed]');
                (homeDetails || homeScreen)?.insertAdjacentElement('afterend', relocatedTrigger);
            }
            if (!hasPrev) {
                const activeTrigger = screens[safeIndex]?.querySelector('.mascot-curiosity-trigger');
                if (activeTrigger) {
                    navEl.insertBefore(activeTrigger, navEl.firstChild);
                }
            }
        }

        const quizEl = sectionEl.querySelector('.section-quiz');
        if (quizEl) {
            quizEl.classList.toggle('quiz-locked', !isLast);

            const isQuizEntryOpen = this.quizEntryState?.[section.id] === true;
            const isQuizViewActive = this.quizViewActive?.[section.id] === true;
            const shouldShowQuiz = isLast && isQuizEntryOpen && isQuizViewActive;
            quizEl.classList.toggle('quiz-entry-hidden', !shouldShowQuiz);
            sectionEl.classList.toggle('quiz-only-mode', shouldShowQuiz);

            if (!isLast && isQuizEntryOpen) {
                delete this.quizEntryState[section.id];
                this.saveProgress();
            }
        }

        if (shouldScroll) {
            screens[safeIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // The lesson topbar's progress bar depends on which screen is active.
        this.renderLessonChrome();
    }

    handleScreenNav(event, sectionEl, section) {
        const button = event.target.closest('[data-nav-action]');
        if (!button) return;

        const action = button.dataset.navAction;
        const contentEl = sectionEl.querySelector('.section-content');
        if (!contentEl) return;

        const screens = Array.from(contentEl.querySelectorAll('.screen-card'));
        if (!screens.length) return;

        const current = this.getSectionCurrentScreen(section.id, screens.length);

        if (action === 'next') {
            if (current < screens.length - 1) {
                this.updateSectionScreen(sectionEl, section, current + 1);
                return;
            }

            const quizEl = sectionEl.querySelector('.section-quiz');
            if (quizEl) {
                // FIX: previously this called showChapterCompletionView() here on
                // the last mission, which re-rendered the section list before the
                // quiz had been answered. Since chapterCompletionView is only
                // honoured once completedSections covers every section, the
                // re-render just showed the ordinary section again and the
                // scrollToElement('#chapterCompleteCta') target didn't exist yet.
                // The quiz should simply be revealed and scrolled to here, since
                // this is the natural forward-reading flow; completeSection() is
                // what triggers the chapter-completion view once the quiz is
                // actually finished.
                this.revealSectionQuiz(sectionEl, section);
            }
            return;
        }

        if (action === 'prev' && current > 0) {
            this.updateSectionScreen(sectionEl, section, current - 1, true, { direction: 'backward' });
        }
    }

    closeSectionQuizPopout() {
        const overlay = document.getElementById('sectionQuizPopout');
        if (!overlay) return;

        const quizEl = overlay.querySelector('.section-quiz');
        const anchor = document.getElementById('sectionQuizPopoutAnchor');

        if (quizEl && anchor?.parentElement) {
            anchor.parentElement.insertBefore(quizEl, anchor);
        }

        overlay.remove();
        document.body.classList.remove('quiz-popout-open');
    }

    openSectionQuizPopout(sectionEl, section) {
        const quizEl = sectionEl.querySelector('.section-quiz');
        if (!quizEl) return;

        this.closeSectionQuizPopout();

        let anchor = document.getElementById('sectionQuizPopoutAnchor');
        if (!anchor) {
            anchor = document.createElement('div');
            anchor.id = 'sectionQuizPopoutAnchor';
            quizEl.insertAdjacentElement('afterend', anchor);
        }

        const overlay = document.createElement('div');
        overlay.className = 'quiz-popout-overlay';
        overlay.id = 'sectionQuizPopout';
        overlay.innerHTML = `
            <div class="quiz-popout-panel" role="dialog" aria-modal="true" aria-label="Desafio da missão">
                <div class="quiz-popout-header">
                    <h3>Desafio: ${section.title}</h3>
                    <button type="button" class="quiz-popout-close" aria-label="Fechar desafio">×</button>
                </div>
                <div class="quiz-popout-body"></div>
            </div>
        `;

        const body = overlay.querySelector('.quiz-popout-body');
        body.appendChild(quizEl);

        overlay.querySelector('.quiz-popout-close').addEventListener('click', () => {
            this.closeSectionQuizPopout();
        });

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.closeSectionQuizPopout();
            }
        });

        document.body.appendChild(overlay);
        document.body.classList.add('quiz-popout-open');
    }

    handleScreenJump(event, sectionEl, section) {
        const button = event.target.closest('.mission-jump-screen');
        if (!button) return;

        if (button.dataset.targetScreen === 'quiz') {
            const contentEl = sectionEl.querySelector('.section-content');
            if (!contentEl) {
                return;
            }

            const screens = Array.from(contentEl.querySelectorAll('.screen-card'));
            if (!screens.length) {
                return;
            }

            this.updateSectionScreen(sectionEl, section, screens.length - 1);
            this.revealSectionQuiz(sectionEl, section, { scrollToQuiz: false });
            return;
        }

        const targetScreen = Number(button.dataset.targetScreen);
        if (!Number.isInteger(targetScreen) || targetScreen < 1) {
            return;
        }

        this.quizViewActive[section.id] = false;
        this.updateSectionScreen(sectionEl, section, targetScreen - 1);
    }

    /**
     * Render all sections
     */
    renderSections() {
        const wrapper = document.getElementById('sectionsWrapper');
        wrapper.innerHTML = '';

        if (this.completedSections.size === this.mission.sections.length && this.chapterCompletionView) {
            this.renderChapterCompletion(wrapper);
            this.renderFactBanner(null);
            return;
        }

        const maxReviewable = this.getMaxReviewableSectionIndex();
        const sectionIndex = Math.max(0, Math.min(this.activeSectionIndex, maxReviewable));
        const section = this.mission.sections[sectionIndex];
        const isCompleted = this.completedSections.has(section.id);

        const sectionEl = document.createElement('div');
        sectionEl.className = `section unlocked ${isCompleted ? 'completed' : ''}`;
        sectionEl.dataset.sectionId = section.id;
        sectionEl.id = `missao-${sectionIndex + 1}`;

        sectionEl.innerHTML = `
            <div class="section-body"></div>
        `;

        const bodyEl = sectionEl.querySelector('.section-body');
        bodyEl.innerHTML = `${this.buildIntroHighlightHtml(section)}${section.content}`;
        bodyEl.insertAdjacentHTML('beforeend', this.renderSectionQuiz(section));

        sectionEl.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', (event) => this.handleQuizOptionSelect(event, section));
        });

        sectionEl.querySelector('#quizContinueBtn')?.addEventListener('click', () => this.handleQuizContinue(section, sectionIndex));

        sectionEl.querySelectorAll('.open-quiz-submit').forEach(button => {
            button.addEventListener('click', (event) => this.handleOpenQuizAnswer(event, section, sectionIndex));
        });

        // Live-enable the open-answer Check button as the student types,
        // without a full re-render (which would steal focus mid-keystroke).
        sectionEl.querySelector('.open-quiz-input:not([disabled])')?.addEventListener('input', (event) => {
            const submitBtn = sectionEl.querySelector('.open-quiz-submit');
            if (submitBtn) submitBtn.disabled = !event.target.value.trim();
        });

        sectionEl.querySelectorAll('.guide-option:not(.electron-loss-option)').forEach(option => {
            option.addEventListener('click', (event) => this.handleGuideOption(event));
        });

        sectionEl.querySelectorAll('.electron-loss-option').forEach(option => {
            option.addEventListener('click', (event) => this.handleElectronLossOption(event));
        });

        sectionEl.querySelectorAll('.simple-explanation-btn').forEach(button => {
            button.addEventListener('click', (event) => this.toggleSimpleExplanation(event));
        });

        sectionEl.querySelectorAll('.plant-hotspot').forEach(button => {
            button.addEventListener('click', (event) => this.handlePlantHotspotClick(event));
        });

        sectionEl.querySelectorAll('.plant-hotspot-back').forEach(button => {
            button.addEventListener('click', (event) => this.handlePlantHotspotBack(event));
        });

        this.hydrateGuideState(sectionEl, section);
        this.bindOpenQuizDraftAutosave(sectionEl, section);
        this.attachCuriosityPrompts(sectionEl);
        if (this.isScreenFlowEnabled()) {
            this.mountSectionScreenFlow(sectionEl, section);
        }
        wrapper.appendChild(sectionEl);

        this.renderFactBanner(section);

        if (!this.showPathScreen && !this.mascotIntroShown[section.id]) {
            this.mascotIntroShown[section.id] = true;
            this.showMascotIntroDialog(section);
        }

        if (this.completedSections.size === this.mission.sections.length) {
            const chapterAction = document.createElement('div');
            chapterAction.className = 'chapter-end-actions';
            chapterAction.innerHTML = `
                <button type="button" class="final-quiz-btn" onclick="missionSystem.showChapterCompletionView()">Voltar ao fim do capítulo</button>
            `;
            wrapper.appendChild(chapterAction);
        }

        this.hydrateOpenQuizTextareas();
    }

    renderChapterCompletion(wrapper) {
        const finalQuizBtn = document.createElement('div');
        finalQuizBtn.className = 'final-quiz-section';
        finalQuizBtn.id = 'chapterCompleteCta';
        finalQuizBtn.innerHTML = `
            <div class="final-quiz-card">
                <div class="final-quiz-icon">🏆</div>
                <h2>Capítulo concluído: Fotossíntese</h2>
                <p>Completaste as ${this.mission.sections.length} etapas desta missão. Agora sim, avança para o Teste de Ouro.</p>
                <button class="final-quiz-btn" onclick="missionSystem.reviewCompletedMissions()">Rever missões</button>
                <button class="final-quiz-btn" onclick="missionSystem.startFinalQuiz()">Começar Teste de Ouro 🚀</button>
            </div>
        `;
        wrapper.appendChild(finalQuizBtn);
    }

    hydrateOpenQuizTextareas() {
        document.querySelectorAll('.open-quiz-input[data-saved-text]').forEach((textarea) => {
            const saved = textarea.getAttribute('data-saved-text');
            if (!saved) return;
            textarea.value = decodeURIComponent(saved);
        });
    }

    /**
     * Renders exactly ONE quiz question at a time (the current unanswered
     * one, or the just-answered one while its feedback/Continue is still
     * showing) — a real select → Check → feedback → Continue flow, instead
     * of the old stacked list of every question with instant reveal.
     */
    renderSectionQuiz(section) {
        const questions = this.getSectionQuestions(section);
        if (!questions.length) {
            return '';
        }

        const answerState = this.getSectionAnswerState(section.id);
        const isQuizEntryGated = this.isSectionQuizEntryGated(section);
        const isQuizEntryOpen = this.quizEntryState?.[section.id] === true;

        const firstUnanswered = answerState.answers.findIndex((answer) => !answer);
        const awaitingIndex = this.awaitingContinue?.[section.id];
        const displayIndex = Number.isInteger(awaitingIndex)
            ? awaitingIndex
            : (firstUnanswered === -1 ? questions.length - 1 : firstUnanswered);

        const question = questions[displayIndex];
        const savedAnswer = answerState.answers[displayIndex];
        const isShowingFeedback = !!savedAnswer && awaitingIndex === displayIndex;
        const isLastQuestion = displayIndex === questions.length - 1;
        const continueLabel = isLastQuestion ? 'Concluir' : 'Continuar';

        const feedbackHtml = (answer) => `
            <div class="quiz-feedback ${answer.isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
                <span class="feedback-icon">${answer.isCorrect ? '✓' : '✕'}</span>
                <span class="feedback-text">${question.feedback[answer.isCorrect ? 'correct' : 'incorrect']}</span>
            </div>
            ${!answer.isCorrect && question.alternateExplanation ? `<p class="quiz-alt-explanation">${question.alternateExplanation}</p>` : ''}
        `;

        let bodyHtml;
        if (question.type === 'open') {
            const openDraft = this.getOpenAnswerDraft(section.id, displayIndex);
            const isAnswered = !!savedAnswer;

            bodyHtml = `
                <textarea
                    class="open-quiz-input reflection-input"
                    data-question-index="${displayIndex}"
                    data-saved-text="${savedAnswer?.text ? encodeURIComponent(savedAnswer.text) : (openDraft ? encodeURIComponent(openDraft) : '')}"
                    placeholder="${question.placeholder || 'Escreve aqui a tua resposta...'}"
                    ${isAnswered ? 'disabled' : ''}
                ></textarea>
                ${isShowingFeedback ? feedbackHtml(savedAnswer) : ''}
                <div class="lesson-quiz-actions">
                    ${isShowingFeedback
                        ? `<button type="button" class="lesson-primary-btn" id="quizContinueBtn">${continueLabel}</button>`
                        : `<button type="button" class="lesson-primary-btn open-quiz-submit" data-question-index="${displayIndex}" disabled>Confirmar</button>`
                    }
                </div>
            `;
        } else {
            // Selecting an option immediately commits and reveals the
            // answer (see handleQuizOptionSelect) — no separate "Confirmar"
            // step, so there's nothing to show until it's answered.
            bodyHtml = `
                <div class="quiz-options" data-section-id="${section.id}" data-question-index="${displayIndex}">
                    ${question.options.map((option, optIdx) => {
                        let stateClass = '';
                        if (savedAnswer) {
                            if (option.correct) {
                                stateClass = 'correct';
                            } else if (optIdx === savedAnswer.selectedOptionIndex && !savedAnswer.isCorrect) {
                                stateClass = 'incorrect';
                            }
                        }

                        return `
                            <button class="quiz-option ${stateClass}"
                                    data-correct="${option.correct}"
                                    data-option-index="${optIdx}"
                                    data-question-index="${displayIndex}"
                                    ${savedAnswer ? 'disabled' : ''}>
                                <span class="option-letter">${String.fromCharCode(65 + optIdx)})</span>
                                <span class="option-text">${option.text}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
                ${isShowingFeedback ? feedbackHtml(savedAnswer) : ''}
                ${isShowingFeedback ? `
                    <div class="lesson-quiz-actions">
                        <button type="button" class="lesson-primary-btn" id="quizContinueBtn">${continueLabel}</button>
                    </div>
                ` : ''}
            `;
        }

        return `
            <div class="section-quiz ${isQuizEntryGated && !isQuizEntryOpen ? 'quiz-entry-hidden' : ''}" data-section-id="${section.id}">
                <p class="quiz-progress-label">Pergunta ${displayIndex + 1} de ${questions.length}</p>
                <p class="quiz-question">${question.question}</p>
                ${bodyHtml}
            </div>
        `;
    }

    isSectionQuizEntryGated(section) {
        if (!this.isScreenFlowEnabled()) {
            return false;
        }

        return typeof section?.content === 'string' && section.content.includes('class="screen-card"');
    }

    openQuizEntryForSection(sectionId) {
        if (!sectionId) {
            return;
        }

        this.quizEntryState[sectionId] = true;
        this.saveProgress();
    }

    isSectionQuizComplete(section) {
        const questions = this.getSectionQuestions(section);
        const answerState = this.getSectionAnswerState(section.id);

        if (!questions.length) {
            return false;
        }

        return questions.every((_, questionIndex) => !!answerState.answers[questionIndex]);
    }

    completeSection(section, sectionIndex) {
        if (this.completedSections.has(section.id)) {
            return;
        }

        const quizRewardSource = this.buildRewardSource('quiz', `${this.mission.id}:${section.id}`);
        const answerState = this.getSectionAnswerState(section.id);
        const correctAnswers = answerState.answers?.filter((answer) => answer?.isCorrect === true).length || 0;
        const totalQuestions = this.getSectionQuestions(section).length;
        const quizPercentage = totalQuestions ? (correctAnswers / totalQuestions) * 100 : 0;

        this.completedSections.add(section.id);
        this.earnedXP += section.xpReward;
        this.awardProfileXP(section.xpReward, quizRewardSource, {
            type: 'quiz',
            percentage: quizPercentage
        });
        this.showXPReward(section.xpReward);

        if (sectionIndex + 1 < this.mission.sections.length) {
            this.currentSectionIndex = sectionIndex + 1;
            this.activeSectionIndex = this.currentSectionIndex;
            this.chapterCompletionView = false;
        } else {
            this.chapterCompletionView = true;
        }

        this.saveProgress();
        this.showCorrectAnimation();

        const hasNextSection = sectionIndex + 1 < this.mission.sections.length;

        const continueToNext = () => {
            if (hasNextSection) {
                // The sidebar (the old way to jump between sections) is
                // gone — send the student back to the percurso map to pick
                // the next unlocked circle themselves, rather than
                // auto-continuing inline.
                this.showPathScreen = true;
                this.render();
                return;
            }

            this.render();
            this.scrollToElement('#chapterCompleteCta');
        };

        const reviewContent = () => this.reviewSectionContent(section, sectionIndex);

        const rankTitle = window.ProfileXP?.getProfileOverview?.(window.ProfileXP.getCurrentUserProfile())?.rank?.title || 'Explorador';
        const scoreLine = totalQuestions
            ? `${correctAnswers}/${totalQuestions} perguntas acertadas, nada mau, ${rankTitle}`
            : '';

        const completionMessage = typeof section.completionMessage === 'string' && section.completionMessage.trim()
            ? section.completionMessage.trim()
            : `Etapa concluída! +${section.xpReward} XP.`;

        const ctaLabel = hasNextSection ? 'Avança para o próximo conteúdo →' : 'Ir para o desafio';

        this.showSectionCompletionDialog({
            scoreLine,
            message: completionMessage,
            ctaLabel,
            onContinue: continueToNext,
            onReview: reviewContent
        });
        return;
    }

    /**
     * Lets the student re-read the section they just finished the quiz for,
     * instead of only being able to move forward — jumps back to its first
     * content screen (not wherever the quiz progress left off).
     */
    reviewSectionContent(section, sectionIndex) {
        this.activeSectionIndex = sectionIndex;
        this.showPathScreen = false;
        this.render();

        const sectionEl = document.querySelector(`.section[data-section-id="${section.id}"]`);
        const screenCount = (section.content.match(/class="screen-card/g) || []).length;
        if (sectionEl && screenCount) {
            this.updateSectionScreen(sectionEl, section, 0);
        }
    }

    showSectionCompletionDialog({ scoreLine, message, ctaLabel, onContinue, onReview }) {
        const existing = document.getElementById('sectionCompletionOverlay');
        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'sectionCompletionOverlay';
        overlay.className = 'section-completion-overlay';
        overlay.innerHTML = `
            <div class="section-completion-card" role="dialog" aria-modal="true" aria-label="Missão concluída">
                <h3>Missão concluída</h3>
                ${scoreLine ? `<p class="section-completion-score">${scoreLine}</p>` : ''}
                <p>${message}</p>
                <button type="button" class="section-completion-btn">${ctaLabel}</button>
                <button type="button" class="section-completion-review-btn">Rever conteúdo</button>
            </div>
        `;

        overlay.querySelector('.section-completion-btn')?.addEventListener('click', () => {
            overlay.remove();
            if (typeof onContinue === 'function') {
                onContinue();
            }
        });

        overlay.querySelector('.section-completion-review-btn')?.addEventListener('click', () => {
            overlay.remove();
            if (typeof onReview === 'function') {
                onReview();
            }
        });

        document.body.appendChild(overlay);
    }

    scrollToElement(selector) {
        const target = document.querySelector(selector);
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    getFirstAccessibleSectionHash() {
        const maxSectionIndex = Math.max(0, Math.min(this.currentSectionIndex, this.mission.sections.length - 1));
        return `#missao-${maxSectionIndex + 1}`;
    }

    /**
     * Clicking an option only *selects* it (highlights it, enables the
     * Check button) — it no longer commits/reveals the answer instantly.
     */
    /**
     * Selecting an option commits it immediately — correct/incorrect
     * feedback (+ alternate explanation on a miss) shows right away, and
     * the action button switches to "Continuar"; completion only happens
     * once Continuar is pressed (see handleQuizContinue).
     */
    handleQuizOptionSelect(event, section) {
        const button = event.target.closest('.quiz-option');
        if (!button || button.disabled) return;

        const questionIndex = Number(button.dataset.questionIndex);
        const optionIndex = Number(button.dataset.optionIndex);

        const answerState = this.getSectionAnswerState(section.id);
        if (answerState.answers[questionIndex]) return;

        const question = this.getSectionQuestions(section)[questionIndex];
        const option = question.options[optionIndex];
        const isCorrect = !!option?.correct;

        answerState.answers[questionIndex] = {
            selectedOptionIndex: optionIndex,
            isCorrect
        };

        this.userAnswers[section.id] = answerState;
        this.awaitingContinue[section.id] = questionIndex;

        if (isCorrect) {
            // Kept in step with awardProfileXP (which updates the client's
            // running total) so the amount synced to the server via
            // saveProgress() below doesn't quietly under-count real XP.
            this.earnedXP += 5;
            this.awardProfileXP(5, this.buildRewardSource('quiz-question', `${this.mission.id}:${section.id}:${questionIndex}`), { type: 'quiz' });
        }

        this.saveProgress();

        const scrollPosition = window.scrollY;
        this.render();
        window.scrollTo(0, scrollPosition);

        if (isCorrect) {
            this.showMascotCorrectPopup();
        }
    }

    handleOpenQuizAnswer(event, section, sectionIndex) {
        const button = event.target.closest('.open-quiz-submit');
        if (!button || button.disabled) return;

        const questionIndex = Number(button.dataset.questionIndex);
        const input = button.closest('.section-quiz')?.querySelector('.open-quiz-input');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        const existingAnswerState = this.getSectionAnswerState(section.id);
        if (existingAnswerState.answers[questionIndex]) return;

        const question = this.getSectionQuestions(section)[questionIndex];
        const normalizedText = this.normalizeKeywordText(text);
        const tokens = normalizedText.split(' ').filter(Boolean);
        const keywords = Array.isArray(question.keywords) ? question.keywords : [];
        const foundCount = keywords.reduce((count, keyword) => {
            const keywordTokens = this.normalizeKeywordText(keyword).split(' ').filter(Boolean);
            if (!keywordTokens.length) {
                return count;
            }

            let isMatch = false;
            for (let i = 0; i <= tokens.length - keywordTokens.length; i += 1) {
                const sequence = tokens.slice(i, i + keywordTokens.length);
                if (sequence.join(' ') === keywordTokens.join(' ')) {
                    isMatch = true;
                    break;
                }
            }

            return isMatch ? count + 1 : count;
        }, 0);

        const requiredKeywords = Number.isInteger(question.minKeywords) ? question.minKeywords : 2;
        const isCorrect = foundCount >= requiredKeywords;

        const answerState = this.getSectionAnswerState(section.id);
        answerState.answers[questionIndex] = {
            text,
            isCorrect,
            isOpen: true
        };

        this.clearOpenAnswerDraft(section.id, questionIndex);

        this.userAnswers[section.id] = answerState;
        this.awaitingContinue[section.id] = questionIndex;

        if (isCorrect) {
            // Kept in step with awardProfileXP (which updates the client's
            // running total) so the amount synced to the server via
            // saveProgress() below doesn't quietly under-count real XP.
            this.earnedXP += 5;
            this.awardProfileXP(5, this.buildRewardSource('quiz-question', `${this.mission.id}:${section.id}:${questionIndex}`), { type: 'quiz' });
        }

        this.saveProgress();

        const scrollPosition = window.scrollY;
        this.render();
        window.scrollTo(0, scrollPosition);
    }

    /**
     * The "Continuar"/"Concluir" button shown once feedback is visible:
     * dismisses the feedback and either reveals the next question or, on
     * the last one, completes the section.
     */
    handleQuizContinue(section, sectionIndex) {
        delete this.awaitingContinue[section.id];

        if (this.isSectionQuizComplete(section)) {
            this.completeSection(section, sectionIndex);
            return;
        }

        this.render();
    }

    handleGuideOption(event) {
        const button = event.target.closest('.guide-option');
        if (!button || button.disabled) return;

        const container = button.closest('.guide-options');
        const feedbackEl = container.parentElement.querySelector('.neutral-feedback');
        const isCorrect = button.dataset.correct === 'true';

        container.querySelectorAll('.guide-option').forEach(opt => {
            opt.disabled = true;
            if (opt.dataset.correct === 'true') {
                opt.classList.add('correct');
            } else if (opt === button) {
                opt.classList.add('incorrect');
            }
        });

        if (feedbackEl) {
            feedbackEl.classList.add('show');
        }

        const sectionEl = button.closest('.section');
        const sectionId = sectionEl?.dataset?.sectionId;
        if (sectionId) {
            this.guideAnswerState[sectionId] = {
                selectedChoice: button.dataset.choice || '',
                isCorrect
            };
            this.saveProgress();
        }
    }

    handleElectronLossOption(event) {
        const button = event.target.closest('.electron-loss-option');
        if (!button || button.disabled) return;

        const container = button.closest('.electron-loss-options');
        const feedbackEl = container?.parentElement?.querySelector('.electron-loss-feedback');

        container?.querySelectorAll('.electron-loss-option').forEach((opt) => {
            opt.disabled = true;
            if (opt.dataset.correct === 'true') {
                opt.classList.add('correct');
            } else if (opt === button) {
                opt.classList.add('incorrect');
            }
        });

        if (feedbackEl) {
            feedbackEl.classList.add('show');
        }
    }

    toggleSimpleExplanation(event) {
        const button = event.target.closest('.simple-explanation-btn');
        if (!button) return;

        const card = button.closest('.screen-card');
        const explanation = card?.querySelector('.simple-explanation-text');
        if (!explanation) return;

        const isHidden = explanation.hasAttribute('hidden');
        if (isHidden) {
            explanation.removeAttribute('hidden');
            button.setAttribute('aria-expanded', 'true');
            button.textContent = button.dataset.labelHide || 'Ocultar explicação simples';
            return;
        }

        explanation.setAttribute('hidden', '');
        button.setAttribute('aria-expanded', 'false');
        button.textContent = button.dataset.labelShow || 'Explicação mais simples';
    }

    /**
     * Clicking a positioned dot on a .plant-diagram image: mark it as the
     * active hotspot and copy the matching hidden .plant-hotspot-panel's
     * content into the visible .plant-hotspot-explanation box below the
     * image — the panels themselves are just an authoring convenience and
     * are never shown directly.
     */
    handlePlantHotspotClick(event) {
        const button = event.currentTarget;
        const card = button.closest('.plant-diagram-card');
        if (!card) return;

        const hotspotKey = button.dataset.hotspot;
        card.querySelectorAll('.plant-hotspot').forEach((el) => {
            el.classList.toggle('is-active', el === button);
        });

        const panel = card.querySelector(`.plant-hotspot-panel[data-hotspot="${hotspotKey}"]`);
        if (!panel) return;

        // Cards with a real photo per structure (see data-image on the
        // panel) drill into a dedicated detail view instead of showing the
        // explanation inline below the diagram.
        const detail = card.querySelector('.plant-hotspot-detail');
        const explanation = detail
            ? detail.querySelector('.plant-hotspot-explanation')
            : card.querySelector('.plant-hotspot-explanation');
        if (!explanation) return;

        explanation.innerHTML = panel.innerHTML;
        explanation.classList.add('has-content');
        explanation.querySelectorAll('.key-term').forEach((el) => {
            this.registerDiscoveredWord(el.textContent);
        });

        if (detail) {
            const photo = detail.querySelector('.plant-hotspot-photo');
            const imageSrc = panel.dataset.image;
            if (photo && imageSrc) {
                photo.src = imageSrc;
                photo.alt = panel.querySelector('h4')?.textContent || '';
                photo.classList.toggle('is-round', panel.dataset.photoRound === 'true');
            }
            const overview = card.querySelector('.plant-diagram-overview');
            if (overview) overview.hidden = true;
            detail.hidden = false;
        }
    }

    handlePlantHotspotBack(event) {
        const card = event.currentTarget.closest('.plant-diagram-card');
        if (!card) return;

        const detail = card.querySelector('.plant-hotspot-detail');
        const overview = card.querySelector('.plant-diagram-overview');
        if (detail) detail.hidden = true;
        if (overview) overview.hidden = false;

        card.querySelectorAll('.plant-hotspot').forEach((el) => el.classList.remove('is-active'));
    }

    /**
     * Vocabulary words (.key-term spans) get added to the student's
     * "livro de explorador" the first time they're revealed, with a small
     * toast — tracked globally (not per-mission) in localStorage.
     */
    getDictionaryStorageKey() {
        const user = window.exploreCurrentUser;
        const userKey = user?.uid ? `uid:${user.uid}` : (user?.email ? `email:${user.email.toLowerCase()}` : 'guest');
        return `explore_dictionary_${userKey}`;
    }

    getDiscoveredWords() {
        try {
            const raw = localStorage.getItem(this.getDictionaryStorageKey());
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    registerDiscoveredWord(word) {
        const normalized = String(word || '').trim();
        if (!normalized) return;

        const key = normalized.toLowerCase();
        const words = this.getDiscoveredWords();
        if (words.some((entry) => entry.toLowerCase() === key)) {
            return;
        }

        words.push(normalized);
        localStorage.setItem(this.getDictionaryStorageKey(), JSON.stringify(words));
        this.showDictionaryToast(normalized);
    }

    showDictionaryToast(word) {
        const toast = document.getElementById('dictionaryToast');
        if (!toast) return;

        const textEl = document.getElementById('dictionaryToastText');
        if (textEl) textEl.textContent = `"${word}" foi adicionada ao teu livro de explorador!`;

        toast.classList.add('show');
        clearTimeout(this._dictionaryToastTimer);
        this._dictionaryToastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2600);
    }

    /**
     * Guard hash direct access to locked mission blocks
     */
    guardSectionAccessFromUrl() {
        const match = window.location.hash.match(/^#missao-(\d+)$/);
        if (!match) return;

        const requestedIndex = parseInt(match[1], 10) - 1;
        const maxReviewable = this.getMaxReviewableSectionIndex();
        if (!Number.isInteger(requestedIndex) || requestedIndex < 0) {
            const unlockedTarget = this.getFirstAccessibleSectionHash();
            this.scrollToElement(unlockedTarget);
            window.location.hash = unlockedTarget;
            return;
        }

        if (requestedIndex > maxReviewable) {
            const unlockedTarget = this.getFirstAccessibleSectionHash();
            this.scrollToElement(unlockedTarget);
            window.location.hash = unlockedTarget;
            return;
        }

        if (requestedIndex !== this.activeSectionIndex || this.chapterCompletionView) {
            this.activeSectionIndex = requestedIndex;
            this.chapterCompletionView = false;
            this.saveProgress();
            this.render();
        }

        this.scrollToElement(`#missao-${requestedIndex + 1}`);
    }

    /**
     * Start the final quiz
     */
    startFinalQuiz() {
        this.isInFinalQuiz = true;
        this.renderFinalQuiz();
    }

    /**
     * Render the final quiz
     */
    renderFinalQuiz() {
        const wrapper = document.getElementById('sectionsWrapper');
        wrapper.innerHTML = '';

        const quizContainer = document.createElement('div');
        quizContainer.className = 'final-quiz-container';

        // Quiz Header
        const header = document.createElement('div');
        header.className = 'final-quiz-header';
        header.innerHTML = `
            <h1>🧬 The Code of Life - Final Quiz</h1>
            <p>Answer all 10 questions correctly to complete the mission!</p>
            <div class="quiz-progress">
                <span id="quizProgress">Question 1 of 10</span>
                <div class="quiz-progress-bar">
                    <div class="quiz-progress-fill" id="quizProgressFill" style="width: 10%"></div>
                </div>
            </div>
        `;
        quizContainer.appendChild(header);

        // Questions
        const questionsContainer = document.createElement('div');
        questionsContainer.className = 'final-quiz-questions';
        questionsContainer.id = 'questionsContainer';

        this.mission.finalQuiz.forEach((question, index) => {
            const questionEl = document.createElement('div');
            questionEl.className = `final-quiz-question ${index === 0 ? 'active' : ''}`;
            questionEl.dataset.questionIndex = index;
            questionEl.innerHTML = `
                <h3>Question ${index + 1} of 10</h3>
                <p class="question-text">${question.question}</p>
                <div class="final-quiz-options">
                    ${question.options.map((option, optIdx) => `
                        <button class="final-quiz-option" data-correct="${option.correct}">
                            <span class="option-circle">${String.fromCharCode(65 + optIdx)}</span>
                            <span class="option-text">${option.text}</span>
                        </button>
                    `).join('')}
                </div>
            `;

            // Add event listeners
            questionEl.querySelectorAll('.final-quiz-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    this.handleFinalQuizAnswer(e, index);
                });
            });

            questionsContainer.appendChild(questionEl);
        });

        quizContainer.appendChild(questionsContainer);
        wrapper.appendChild(quizContainer);
    }

    /**
     * Handle final quiz answer
     */
    handleFinalQuizAnswer(event, questionIndex) {
        const option = event.target.closest('.final-quiz-option');
        if (!option || option.disabled) return;

        const isCorrect = option.dataset.correct === 'true';
        const questionEl = document.querySelector(`[data-question-index="${questionIndex}"]`);
        const allOptions = questionEl.querySelectorAll('.final-quiz-option');

        // Disable all options
        allOptions.forEach(opt => {
            opt.disabled = true;
            opt.style.pointerEvents = 'none';
        });

        // Highlight answer
        allOptions.forEach(opt => {
            if (opt.dataset.correct === 'true') {
                opt.classList.add('correct');
            } else if (opt === option) {
                opt.classList.add('incorrect');
            }
        });

        // Store answer
        this.finalQuizAnswers[questionIndex] = isCorrect;

        // Show feedback with delay
        setTimeout(() => {
            if (questionIndex + 1 < this.mission.finalQuiz.length) {
                // Show next question
                this.showFinalQuizQuestion(questionIndex + 1);
            } else {
                // Show results
                this.showFinalQuizResults();
            }
        }, 1500);
    }

    /**
     * Show specific final quiz question
     */
    showFinalQuizQuestion(questionIndex) {
        const questions = document.querySelectorAll('.final-quiz-question');
        questions.forEach((q, idx) => {
            q.classList.remove('active');
            if (idx === questionIndex) {
                q.classList.add('active');
            }
        });

        // Update progress
        const percent = ((questionIndex + 1) / this.mission.finalQuiz.length) * 100;
        document.getElementById('quizProgressFill').style.width = percent + '%';
        document.getElementById('quizProgress').textContent = `Question ${questionIndex + 1} of 10`;
    }

    /**
     * Show final quiz results
     */
    showFinalQuizResults() {
        const correctAnswers = this.finalQuizAnswers.filter(ans => ans === true).length;
        const totalQuestions = this.mission.finalQuiz.length;
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);
        const bonusXP = Math.round((correctAnswers / totalQuestions) * 100);
        const finalQuizRewardSource = this.buildRewardSource('challenge', `${this.mission.id}:final-quiz`);

        const wrapper = document.getElementById('sectionsWrapper');
        wrapper.innerHTML = `
            <div class="completion-screen">
                <div class="completion-badge">
                    <div class="badge-icon">🏆</div>
                    <h1>Mission Completed!</h1>
                </div>

                <div class="completion-stats">
                    <div class="stat-card">
                        <div class="stat-icon">✓</div>
                        <div class="stat-content">
                            <div class="stat-label">Correct Answers</div>
                            <div class="stat-value">${correctAnswers}/${totalQuestions}</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-content">
                            <div class="stat-label">Accuracy</div>
                            <div class="stat-value">${percentage}%</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">⭐</div>
                        <div class="stat-content">
                            <div class="stat-label">Bonus XP Earned</div>
                            <div class="stat-value">+${bonusXP} XP</div>
                        </div>
                    </div>
                </div>

                <div class="completion-xp-summary">
                    <h2>Total XP Earned</h2>
                    <div class="total-xp">${this.earnedXP + bonusXP}</div>
                    <div class="xp-breakdown">
                        <p>Sections: ${this.earnedXP} XP</p>
                        <p>Final Quiz Bonus: ${bonusXP} XP</p>
                    </div>
                </div>

                <div class="completion-achievements">
                    <h3>🎖️ Achievements Unlocked</h3>
                    <div class="achievement-list">
                        <div class="achievement-item unlocked">
                            <span class="achievement-icon">🧬</span>
                            <span class="achievement-name">Biology Basics</span>
                        </div>
                        <div class="achievement-item ${percentage >= 80 ? 'unlocked' : 'locked'}">
                            <span class="achievement-icon">🎯</span>
                            <span class="achievement-name">Perfect Scholar</span>
                        </div>
                        <div class="achievement-item ${percentage >= 90 ? 'unlocked' : 'locked'}">
                            <span class="achievement-icon">⭐</span>
                            <span class="achievement-name">Expert Biologist</span>
                        </div>
                    </div>
                </div>

                <div class="completion-actions">
                    <button class="btn-primary" onclick="window.location.href='missions.html'">Back to Missions</button>
                    <button class="btn-secondary" onclick="missionSystem.resetMission()">Retake Mission</button>
                </div>
            </div>
        `;

        // Update final earnedXP for localStorage
        this.earnedXP += bonusXP;
        this.saveProgress();
        this.awardProfileXP(bonusXP, finalQuizRewardSource, {
            type: 'quiz',
            percentage
        });
    }

    /**
     * Reset mission progress
     */
    resetMission() {
        localStorage.removeItem(this.getProgressStorageKey());
        this.currentSectionIndex = 0;
        this.activeSectionIndex = 0;
        this.userAnswers = {};
        this.sectionScreenProgress = {};
        this.openAnswerDrafts = {};
        this.guideAnswerState = {};
        this.quizEntryState = {};
        this.chapterCompletionView = false;
        this.earnedXP = 0;
        this.completedSections = new Set();
        this.widgetCompletions = {};
        this.isInFinalQuiz = false;
        this.finalQuizAnswers = [];
        this.render();
        window.scrollTo(0, 0);
    }

    /**
     * Update progress bar
     */
    updateProgressBar() {
        const percent = this.getProgressPercent();
        const percentEl = document.getElementById('progressPercent');
        const barEl = document.getElementById('progressBar');
        const counterEl = document.getElementById('sectionCounter');

        if (percentEl) percentEl.textContent = percent + '%';
        if (barEl) barEl.style.width = percent + '%';
        if (counterEl) counterEl.textContent = `${this.completedSections.size}/${this.mission.sections.length} Missões`;
    }

    /**
     * Show XP reward animation
     */
    showXPReward(xp) {
        const toast = document.getElementById('xpToast');
        document.getElementById('xpText').textContent = `+${xp} XP`;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    /**
     * Show correct answer animation
     */
    showCorrectAnimation() {
        const animation = document.getElementById('correctAnimation');
        animation.classList.add('show');
        setTimeout(() => {
            animation.classList.remove('show');
        }, 1000);
    }
}

// Initialize mission system when page loads
let missionSystem;
document.addEventListener('DOMContentLoaded', () => {
    let initialized = false;

    const initMission = () => {
        if (initialized) return;
        initialized = true;
        missionSystem = new MissionSystem(missionData);
        missionSystem.render();
        missionSystem.guardSectionAccessFromUrl();
    };

    window.addEventListener('explore:auth-changed', initMission, { once: true });

    if (window.exploreCurrentUser !== undefined) {
        initMission();
        return;
    }

    setTimeout(initMission, 1200);
});