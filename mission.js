/**
 * Mission System - Core Logic
 * Handles mission progression, quizzes, XP earning, and user progress tracking
 */

class MissionSystem {
    constructor(missionData) {
        this.mission = missionData;
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
        this.isInFinalQuiz = false;
        this.finalQuizAnswers = [];
        this.activeCardAudioButton = null;
        this.progressStorageKey = this.resolveProgressStorageKey();
        this.loadProgress();
        this.registerPersistenceListeners();
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
     * Save user progress to localStorage
     */
    saveProgress() {
        const data = {
            currentSectionIndex: this.currentSectionIndex,
            activeSectionIndex: this.activeSectionIndex,
            userAnswers: this.userAnswers,
            sectionScreenProgress: this.sectionScreenProgress,
            openAnswerDrafts: this.openAnswerDrafts,
            guideAnswerState: this.guideAnswerState,
            quizEntryState: this.quizEntryState,
            chapterCompletionView: this.chapterCompletionView,
            earnedXP: this.earnedXP,
            completedSections: Array.from(this.completedSections)
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

    awardProfileXP(amount, source) {
        if (!window.ProfileXP) {
            return { awarded: false, xpAdded: 0 };
        }

        return window.ProfileXP.awardXPToCurrentUser(amount, source);
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
        this.updateProgressBar();
    }

    /**
     * Render mission header with title and description
     */
    renderHeader() {
        document.getElementById('missionTitle').textContent = this.mission.title;
        document.getElementById('missionDescription').textContent = this.mission.description;
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
        const parts = Array.from(cardEl.querySelectorAll('h2, h3, h4, p, li'))
            .map((el) => el.textContent.trim())
            .filter(Boolean);
        return parts.join('. ');
    }

    resetCardAudioButton(button) {
        if (!button) {
            return;
        }

        button.classList.remove('playing');
        button.textContent = '🔊 Ouvir áudio';
    }

    stopCardAudio() {
        if (this.supportsCardAudio()) {
            window.speechSynthesis.cancel();
        }

        this.resetCardAudioButton(this.activeCardAudioButton);
        this.activeCardAudioButton = null;
    }

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
            button.classList.add('playing');
            button.textContent = '⏹ Parar áudio';
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

    attachCardAudioButtons(sectionEl) {
        if (!this.supportsCardAudio()) {
            return;
        }

        sectionEl.querySelectorAll('.section-content .screen-card').forEach((cardEl) => {
            if (cardEl.querySelector('.card-audio-btn')) {
                return;
            }

            const audioText = this.extractCardAudioText(cardEl);
            if (!audioText) {
                return;
            }

            const controls = document.createElement('div');
            controls.className = 'card-audio-controls';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'card-audio-btn';
            button.textContent = '🔊 Ouvir áudio';
            button.setAttribute('aria-label', 'Ouvir texto do cartão');

            button.addEventListener('click', () => {
                this.playCardAudio(audioText, button);
            });

            controls.appendChild(button);
            cardEl.insertBefore(controls, cardEl.firstChild);
        });
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
                <button type="button" class="screen-nav-btn" data-nav-action="prev">Anterior</button>
                <span class="screen-nav-status"></span>
                <button type="button" class="screen-nav-btn" data-nav-action="next">Próximo</button>
            `;

            const quizEl = sectionEl.querySelector('.section-quiz');
            if (quizEl) {
                quizEl.insertAdjacentElement('beforebegin', navEl);
            } else {
                contentEl.insertAdjacentElement('afterend', navEl);
            }
        }

        const existingPageNav = sectionEl.querySelector('.screen-page-nav');
        if (!existingPageNav) {
            const pageNavEl = document.createElement('div');
            pageNavEl.className = 'screen-page-nav';

            const pageButtons = Array.from({ length: screens.length }, (_, index) => `
                <button type="button"
                        class="screen-page-btn"
                        data-screen-index="${index}"
                        aria-label="Ir para a página ${index + 1}">
                    ${index + 1}
                </button>
            `).join('');

            pageNavEl.innerHTML = `
                ${pageButtons}
                <button type="button" class="screen-page-btn quiz-shortcut" data-screen-target="quiz" aria-label="Ir para o quiz">Q</button>
            `;

            const navEl = sectionEl.querySelector('.screen-nav');
            navEl?.insertAdjacentElement('afterend', pageNavEl);
        }

        const currentScreen = this.getSectionCurrentScreen(section.id, screens.length);
        this.updateSectionScreen(sectionEl, section, currentScreen, false);

        sectionEl.querySelectorAll('[data-nav-action]').forEach(button => {
            button.addEventListener('click', (event) => this.handleScreenNav(event, sectionEl, section));
        });

        sectionEl.querySelectorAll('.screen-page-btn').forEach(button => {
            button.addEventListener('click', (event) => this.handleScreenPageNav(event, sectionEl, section));
        });

        sectionEl.querySelectorAll('.mission-jump-screen').forEach(button => {
            button.addEventListener('click', (event) => this.handleScreenJump(event, sectionEl, section));
        });

        this.bindPhaseClearSequence(sectionEl);
        this.bindCalvinCycleBuilder(sectionEl);
    }

    handleScreenPageNav(event, sectionEl, section) {
        const button = event.target.closest('.screen-page-btn');
        if (!button) return;

        const contentEl = sectionEl.querySelector('.section-content');
        if (!contentEl) return;

        const screens = Array.from(contentEl.querySelectorAll('.screen-card'));
        if (!screens.length) return;

        if (button.dataset.screenTarget === 'quiz') {
            this.updateSectionScreen(sectionEl, section, screens.length - 1, false);
            this.openQuizEntryForSection(section.id);
            sectionEl.classList.add('quiz-only-mode');
            const quizEl = sectionEl.querySelector('.section-quiz');
            if (quizEl) {
                quizEl.classList.remove('quiz-entry-hidden');
                quizEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        const targetIndex = Number(button.dataset.screenIndex);
        if (!Number.isInteger(targetIndex) || targetIndex < 0) {
            return;
        }

        this.updateSectionScreen(sectionEl, section, targetIndex);
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

    updateSectionScreen(sectionEl, section, targetIndex, shouldScroll = true) {
        const contentEl = sectionEl.querySelector('.section-content');
        if (!contentEl) return;

        const screens = Array.from(contentEl.querySelectorAll('.screen-card'));
        if (!screens.length) return;

        const safeIndex = this.setSectionCurrentScreen(section.id, targetIndex, screens.length);

        screens.forEach((screen, index) => {
            screen.classList.toggle('active-screen', index === safeIndex);
            screen.classList.toggle('hidden-screen', index !== safeIndex);
        });

        const statusEl = sectionEl.querySelector('.screen-nav-status');
        if (statusEl) {
            statusEl.textContent = `Ecrã ${safeIndex + 1} de ${screens.length}`;
        }

        const prevBtn = sectionEl.querySelector('[data-nav-action="prev"]');
        const nextBtn = sectionEl.querySelector('[data-nav-action="next"]');

        if (prevBtn) {
            prevBtn.disabled = safeIndex === 0;
        }

        if (nextBtn) {
            const isLast = safeIndex === screens.length - 1;
            nextBtn.textContent = isLast ? 'Ir para Quiz' : 'Próximo';
        }

        const quizEl = sectionEl.querySelector('.section-quiz');
        if (quizEl) {
            const isLast = safeIndex === screens.length - 1;
            quizEl.classList.toggle('quiz-locked', !isLast);

            const isQuizEntryOpen = this.quizEntryState?.[section.id] === true;
            const shouldShowQuiz = isLast && isQuizEntryOpen;
            quizEl.classList.toggle('quiz-entry-hidden', !shouldShowQuiz);
            sectionEl.classList.toggle('quiz-only-mode', shouldShowQuiz);

            if (!isLast && isQuizEntryOpen) {
                delete this.quizEntryState[section.id];
                this.saveProgress();
            }
        }

        sectionEl.querySelectorAll('.screen-page-btn[data-screen-index]').forEach((button) => {
            const buttonIndex = Number(button.dataset.screenIndex);
            const isActivePage = buttonIndex === safeIndex;
            button.classList.toggle('active', isActivePage);
            button.setAttribute('aria-current', isActivePage ? 'page' : 'false');
        });

        const quizShortcut = sectionEl.querySelector('.screen-page-btn[data-screen-target="quiz"]');
        if (quizShortcut) {
            const isQuizActive = sectionEl.classList.contains('quiz-only-mode');
            quizShortcut.classList.toggle('active', isQuizActive);
            quizShortcut.setAttribute('aria-current', isQuizActive ? 'page' : 'false');
        }

        if (shouldScroll) {
            screens[safeIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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

        if (action === 'prev') {
            this.updateSectionScreen(sectionEl, section, current - 1);
            return;
        }

        if (action === 'next') {
            if (current < screens.length - 1) {
                this.updateSectionScreen(sectionEl, section, current + 1);
                return;
            }

            const quizEl = sectionEl.querySelector('.section-quiz');
            if (quizEl) {
                this.openQuizEntryForSection(section.id);
                sectionEl.classList.add('quiz-only-mode');
                quizEl.classList.remove('quiz-entry-hidden');

                const isLastMission = section.id === this.mission.sections[this.mission.sections.length - 1]?.id;
                if (isLastMission) {
                    this.showChapterCompletionView();
                    return;
                }

                quizEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
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

            this.updateSectionScreen(sectionEl, section, screens.length - 1, false);
            this.openQuizEntryForSection(section.id);
            sectionEl.classList.add('quiz-only-mode');
            const quizEl = sectionEl.querySelector('.section-quiz');
            if (quizEl) {
                quizEl.classList.remove('quiz-entry-hidden');
                quizEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        const targetScreen = Number(button.dataset.targetScreen);
        if (!Number.isInteger(targetScreen) || targetScreen < 1) {
            return;
        }

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
            return;
        }

        const maxReviewable = this.getMaxReviewableSectionIndex();
        const sectionIndex = Math.max(0, Math.min(this.activeSectionIndex, maxReviewable));
        const section = this.mission.sections[sectionIndex];
        const isCompleted = this.completedSections.has(section.id);

        const missionNav = document.createElement('div');
        missionNav.className = 'chapter-mission-nav';
        missionNav.innerHTML = this.mission.sections
            .map((item, idx) => {
                const isUnlocked = idx <= maxReviewable;
                const isActive = idx === sectionIndex;
                const isDone = this.completedSections.has(item.id);

                return `
                    <button type="button"
                            class="chapter-mission-btn ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}"
                            data-section-index="${idx}"
                            ${isUnlocked ? '' : 'disabled'}>
                        Missão ${idx + 1}
                    </button>
                `;
            })
            .join('');
        wrapper.appendChild(missionNav);

        const sectionEl = document.createElement('div');
        sectionEl.className = `section unlocked ${isCompleted ? 'completed' : ''}`;
        sectionEl.dataset.sectionId = section.id;
        sectionEl.id = `missao-${sectionIndex + 1}`;

        sectionEl.innerHTML = `
            <div class="section-header">
                <div class="section-number-badge">
                    <span class="section-num">${sectionIndex + 1}</span>
                    ${isCompleted ? '<span class="section-check">✓</span>' : ''}
                </div>
                <div class="section-info">
                    <h2>${section.icon} ${section.title}</h2>
                    <div class="section-meta">
                        <span class="xp-badge">+${section.xpReward} XP</span>
                        ${isCompleted ? '<span class="status-badge completed">Concluída</span>' : '<span class="status-badge">Em progresso</span>'}
                    </div>
                </div>
            </div>
            <div class="section-body"></div>
        `;

        const bodyEl = sectionEl.querySelector('.section-body');
        bodyEl.innerHTML = section.content;
        bodyEl.insertAdjacentHTML('beforeend', this.renderSectionQuiz(section));

        sectionEl.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', (event) => this.handleQuizAnswer(event, section, sectionIndex));
        });

        sectionEl.querySelectorAll('.open-quiz-submit').forEach(button => {
            button.addEventListener('click', (event) => this.handleOpenQuizAnswer(event, section, sectionIndex));
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

        this.hydrateGuideState(sectionEl, section);
        this.bindOpenQuizDraftAutosave(sectionEl, section);
        this.attachCardAudioButtons(sectionEl);
        if (this.isScreenFlowEnabled()) {
            this.mountSectionScreenFlow(sectionEl, section);
        }
        wrapper.appendChild(sectionEl);

        missionNav.querySelectorAll('[data-section-index]').forEach((button) => {
            button.addEventListener('click', (event) => {
                const target = Number(event.currentTarget.dataset.sectionIndex);
                if (!Number.isInteger(target)) {
                    return;
                }

                this.setActiveSection(target);
            });
        });

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
                <p>Completaste as 3 missões. Agora sim, avança para o Teste de Ouro.</p>
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

    renderSectionQuiz(section) {
        const questions = this.getSectionQuestions(section);
        const answerState = this.getSectionAnswerState(section.id);
        const isQuizEntryGated = this.isSectionQuizEntryGated(section);
        const isQuizEntryOpen = this.quizEntryState?.[section.id] === true;

        if (!questions.length) {
            return '';
        }

        return `
            <div class="section-quiz ${isQuizEntryGated && !isQuizEntryOpen ? 'quiz-entry-hidden' : ''}" data-section-id="${section.id}">
                <h3>Quiz da missão 📋</h3>
                ${questions.map((question, questionIndex) => {
                    const savedAnswer = answerState.answers[questionIndex];
                    const openDraft = this.getOpenAnswerDraft(section.id, questionIndex);

                    if (question.type === 'open') {
                        const isAnswered = !!savedAnswer;
                        const isCorrect = !!savedAnswer?.isCorrect;

                        return `
                            <div class="quiz-question-card">
                                <p class="quiz-question">${questionIndex + 1}. ${question.question}</p>
                                <textarea
                                    class="open-quiz-input reflection-input"
                                    data-question-index="${questionIndex}"
                                    data-saved-text="${savedAnswer?.text ? encodeURIComponent(savedAnswer.text) : (openDraft ? encodeURIComponent(openDraft) : '')}"
                                    placeholder="${question.placeholder || 'Escreve aqui a tua resposta...'}"
                                    ${isAnswered ? 'disabled' : ''}
                                ></textarea>
                                <button class="open-quiz-submit" data-question-index="${questionIndex}" ${isAnswered ? 'disabled' : ''}>Validar resposta</button>
                                ${isAnswered ? `
                                    <div class="quiz-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
                                        <span class="feedback-icon">${isCorrect ? '✓' : '✕'}</span>
                                        <span class="feedback-text">${question.feedback[isCorrect ? 'correct' : 'incorrect']}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }

                    return `
                        <div class="quiz-question-card">
                            <p class="quiz-question">${questionIndex + 1}. ${question.question}</p>
                            <div class="quiz-options" data-section-id="${section.id}" data-question-index="${questionIndex}">
                                ${question.options.map((option, optIdx) => {
                                    const isSelected = savedAnswer?.selectedOptionIndex === optIdx;
                                    const isLocked = !!savedAnswer;
                                    const isCorrectOption = option.correct;
                                    let stateClass = '';

                                    if (isLocked) {
                                        if (isCorrectOption) {
                                            stateClass = 'correct';
                                        } else if (isSelected && !savedAnswer.isCorrect) {
                                            stateClass = 'incorrect';
                                        }
                                    }

                                    return `
                                        <button class="quiz-option ${stateClass}"
                                                data-correct="${option.correct}"
                                                data-option-index="${optIdx}"
                                                data-question-index="${questionIndex}"
                                                ${isLocked ? 'disabled' : ''}>
                                            <span class="option-letter">${String.fromCharCode(65 + optIdx)})</span>
                                            <span class="option-text">${option.text}</span>
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                            ${savedAnswer ? `
                                <div class="quiz-feedback ${savedAnswer.isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
                                    <span class="feedback-icon">${savedAnswer.isCorrect ? '✓' : '✕'}</span>
                                    <span class="feedback-text">${question.feedback[savedAnswer.isCorrect ? 'correct' : 'incorrect']}</span>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
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

        this.completedSections.add(section.id);
        this.earnedXP += section.xpReward;
        this.awardProfileXP(section.xpReward, quizRewardSource);
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
            this.render();

            if (hasNextSection) {
                this.scrollToElement(`#missao-${sectionIndex + 2}`);
            } else {
                this.scrollToElement('#chapterCompleteCta');
            }
        };

        const completionMessage = hasNextSection
            ? `Parabéns! Completaste a missão ${sectionIndex + 1}!`
            : (typeof section.completionMessage === 'string' && section.completionMessage.trim()
                ? section.completionMessage.trim()
                : `Missão completa! +${section.xpReward} XP.`);

        const ctaLabel = hasNextSection
            ? `Explora a missão ${sectionIndex + 2}!`
            : 'Ir para o desafio';

        this.showSectionCompletionDialog(completionMessage, ctaLabel, continueToNext);
        return;
    }

    showSectionCompletionDialog(message, ctaLabel, onContinue) {
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
                <p>${message}</p>
                <button type="button" class="section-completion-btn">${ctaLabel}</button>
            </div>
        `;

        const continueButton = overlay.querySelector('.section-completion-btn');
        continueButton?.addEventListener('click', () => {
            overlay.remove();
            if (typeof onContinue === 'function') {
                onContinue();
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
     * Handle quiz answer selection
     */
    handleQuizAnswer(event, section, sectionIndex) {
        const button = event.target.closest('.quiz-option');
        if (!button || button.disabled) return;

        const questionIndex = Number(button.dataset.questionIndex);
        const selectedOptionIndex = Number(button.dataset.optionIndex);
        const isCorrect = button.dataset.correct === 'true';

        const answerState = this.getSectionAnswerState(section.id);
        if (answerState.answers[questionIndex]) {
            return;
        }

        answerState.answers[questionIndex] = {
            selectedOptionIndex,
            isCorrect
        };

        this.userAnswers[section.id] = answerState;
        this.saveProgress();

        const scrollPosition = window.scrollY;
        this.render();
        window.scrollTo(0, scrollPosition);

        if (this.isSectionQuizComplete(section)) {
            this.completeSection(section, sectionIndex);
        }
    }

    handleOpenQuizAnswer(event, section, sectionIndex) {
        const button = event.target.closest('.open-quiz-submit');
        if (!button || button.disabled) return;

        const questionIndex = Number(button.dataset.questionIndex);
        const container = button.closest('.quiz-question-card');
        const input = container?.querySelector('.open-quiz-input');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

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
        this.saveProgress();

        const scrollPosition = window.scrollY;
        this.render();
        window.scrollTo(0, scrollPosition);

        if (this.isSectionQuizComplete(section)) {
            this.completeSection(section, sectionIndex);
        }
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
        this.awardProfileXP(bonusXP, finalQuizRewardSource);
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
        this.chapterCompletionView = false;
        this.earnedXP = 0;
        this.completedSections = new Set();
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
        document.getElementById('progressPercent').textContent = percent + '%';
        document.getElementById('progressBar').style.width = percent + '%';
        document.getElementById('sectionCounter').textContent = `${this.completedSections.size}/${this.mission.sections.length} Missões`;
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
