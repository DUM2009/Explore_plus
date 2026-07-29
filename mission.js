/**
 * Mission System - Core Logic
 * Handles mission progression, quizzes, XP earning, and user progress tracking
 */

class MissionSystem {
    constructor(missionData) {
        this.mission = missionData;
        this.currentSectionIndex = 0;
        this.userAnswers = {};
        this.earnedXP = 0;
        this.completedSections = new Set();
        this.isInFinalQuiz = false;
        this.finalQuizAnswers = [];
        this.loadProgress();
    }
    

    getProgressStorageKey() {
        const user = window.exploreCurrentUser;
        const userKey = user?.uid
            ? `uid:${user.uid}`
            : (user?.email ? `email:${user.email.toLowerCase()}` : 'guest');
        return `mission_${userKey}_${this.mission.id}`;
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
                this.userAnswers = data.userAnswers && typeof data.userAnswers === 'object' ? data.userAnswers : {};
                this.earnedXP = Number.isFinite(data.earnedXP) ? data.earnedXP : 0;
                this.completedSections = new Set(Array.isArray(data.completedSections) ? data.completedSections : []);
            } catch (error) {
                console.warn('Could not parse mission progress from localStorage:', error);
                this.currentSectionIndex = 0;
                this.userAnswers = {};
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

        for (const section of this.mission.sections) {
            if (this.completedSections.has(section.id)) {
                orderedCompleted.push(section.id);
            } else {
                break;
            }
        }

        this.completedSections = new Set(orderedCompleted);

        const maxUnlocked = Math.min(orderedCompleted.length, this.mission.sections.length);
        this.currentSectionIndex = Math.max(0, Math.min(maxUnlocked, this.currentSectionIndex));
    }

    /**
     * Save user progress to localStorage
     */
    saveProgress() {
        const data = {
            currentSectionIndex: this.currentSectionIndex,
            userAnswers: this.userAnswers,
            earnedXP: this.earnedXP,
            completedSections: Array.from(this.completedSections)
        };
        localStorage.setItem(this.getProgressStorageKey(), JSON.stringify(data));
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

    /**
     * Render all sections
     */
    renderSections() {
        const wrapper = document.getElementById('sectionsWrapper');
        wrapper.innerHTML = '';

        this.mission.sections.forEach((section, index) => {
            const isUnlocked = this.isSectionUnlocked(index);
            const isCompleted = this.completedSections.has(section.id);

            const sectionEl = document.createElement('div');
            sectionEl.className = `section ${isUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''}`;
            sectionEl.dataset.sectionId = section.id;
            sectionEl.id = `missao-${index + 1}`;

            sectionEl.innerHTML = `
                <div class="section-header">
                    <div class="section-number-badge">
                        <span class="section-num">${index + 1}</span>
                        ${isCompleted ? '<span class="section-check">✓</span>' : ''}
                    </div>
                    <div class="section-info">
                        <h2>${section.icon} ${section.title}</h2>
                        <div class="section-meta">
                            <span class="xp-badge">+${section.xpReward} XP</span>
                            ${isCompleted ? '<span class="status-badge completed">Concluída</span>' : `<span class="status-badge">${isUnlocked ? 'Em progresso' : 'Bloqueada'}</span>`}
                        </div>
                    </div>
                </div>
                <div class="section-body"></div>
            `;

            const bodyEl = sectionEl.querySelector('.section-body');

            if (!isUnlocked) {
                bodyEl.innerHTML = '<div class="locked-message">🔒 Completa a missão anterior para desbloquear esta.</div>';
            } else {
                bodyEl.innerHTML = section.content;
                bodyEl.insertAdjacentHTML('beforeend', this.renderSectionQuiz(section));
            }

            if (isUnlocked) {
                sectionEl.querySelectorAll('.quiz-option').forEach(option => {
                    option.addEventListener('click', (event) => this.handleQuizAnswer(event, section, index));
                });

                sectionEl.querySelectorAll('.open-quiz-submit').forEach(button => {
                    button.addEventListener('click', (event) => this.handleOpenQuizAnswer(event, section, index));
                });

                sectionEl.querySelectorAll('.quiz-option').forEach(option => {
                    option.addEventListener('click', (event) => this.handleQuizAnswer(event, section, index));
                });

                sectionEl.querySelectorAll('.open-quiz-submit').forEach(button => {
                    button.addEventListener('click', (event) => this.handleOpenQuizAnswer(event, section, index));
                });

                sectionEl.querySelectorAll('.guide-option').forEach(option => {
                    option.addEventListener('click', (event) => this.handleGuideOption(event));
                });
            }

            wrapper.appendChild(sectionEl);
        });

        if (this.completedSections.size === this.mission.sections.length) {
            const finalQuizBtn = document.createElement('div');
            finalQuizBtn.className = 'final-quiz-section';
            finalQuizBtn.id = 'finalQuizCta';
            finalQuizBtn.innerHTML = `
                <div class="final-quiz-card">
                    <div class="final-quiz-icon">🏆</div>
                    <h2>Teste de Ouro desbloqueado</h2>
                    <p>Completaste as 3 missões! Avança para o teste final do capítulo.</p>
                    <button class="final-quiz-btn" onclick="missionSystem.startFinalQuiz()">Tentar o Teste de Ouro 🚀</button>
                </div>
            `;
            wrapper.appendChild(finalQuizBtn);
        }

        this.hydrateOpenQuizTextareas();
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

        if (!questions.length) {
            return '';
        }

        return `
            <div class="section-quiz" data-section-id="${section.id}">
                <h3>Quiz da missão 📋</h3>
                ${questions.map((question, questionIndex) => {
                    const savedAnswer = answerState.answers[questionIndex];

                    if (question.type === 'open') {
                        const isAnswered = !!savedAnswer;
                        const isCorrect = !!savedAnswer?.isCorrect;

                        return `
                            <div class="quiz-question-card">
                                <p class="quiz-question">${questionIndex + 1}. ${question.question}</p>
                                <textarea
                                    class="open-quiz-input reflection-input"
                                    data-question-index="${questionIndex}"
                                    data-saved-text="${savedAnswer?.text ? encodeURIComponent(savedAnswer.text) : ''}"
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
        }

        this.saveProgress();
        this.showCorrectAnimation();

        setTimeout(() => {
            this.render();

            if (sectionIndex + 1 < this.mission.sections.length) {
                this.scrollToElement(`#missao-${sectionIndex + 2}`);
            } else {
                this.scrollToElement('#finalQuizCta');
            }
        }, 700);
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
    }

    /**
     * Guard hash direct access to locked mission blocks
     */
    guardSectionAccessFromUrl() {
        const match = window.location.hash.match(/^#missao-(\d+)$/);
        if (!match) return;

        const requestedIndex = parseInt(match[1], 10) - 1;
        if (!Number.isInteger(requestedIndex) || requestedIndex < 0) {
            const unlockedTarget = this.getFirstAccessibleSectionHash();
            this.scrollToElement(unlockedTarget);
            window.location.hash = unlockedTarget;
            return;
        }

        if (!this.isSectionUnlocked(requestedIndex)) {
            const unlockedTarget = this.getFirstAccessibleSectionHash();
            this.scrollToElement(unlockedTarget);
            window.location.hash = unlockedTarget;
            return;
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
        this.userAnswers = {};
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
        document.getElementById('sectionCounter').textContent = `${this.completedSections.size}/${this.mission.sections.length} Secções`;
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
    window.addEventListener('explore:auth-changed', function initAfterAuth() {
        window.removeEventListener('explore:auth-changed', initAfterAuth);
        missionSystem = new MissionSystem(missionData);
        missionSystem.render();
        missionSystem.guardSectionAccessFromUrl();
    }, { once: true });
});
