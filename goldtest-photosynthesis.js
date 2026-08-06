/**
 * Teste de ouro — Capítulo Fotossíntese
 * 20 perguntas: 10 fáceis, 5 intermédias, 5 difíceis.
 * Nota mínima para o emblema de ouro: 17/20.
 * Mistura conteúdo das 3 missões do capítulo.
 */

const MISSION_ID = "photosynthesis-factory";
const PASS_SCORE = 17;
const TOTAL_QUESTIONS = 20;

const goldTestQuestions = [
    // ---- 10 fáceis ----
    { difficulty: "fácil", question: "Qual gás a planta liberta durante a fotossíntese?", options: [{ text: "Oxigénio", correct: true }, { text: "Azoto", correct: false }, { text: "Hidrogénio", correct: false }] },
    { difficulty: "fácil", question: "Onde está a clorofila dentro do cloroplasto?", options: [{ text: "Nos tilacoides", correct: true }, { text: "No núcleo", correct: false }, { text: "Na parede celular", correct: false }] },
    { difficulty: "fácil", question: "Qual destes é um dos 'ingredientes' da fotossíntese?", options: [{ text: "CO₂", correct: true }, { text: "Azoto", correct: false }, { text: "Metano", correct: false }] },
    { difficulty: "fácil", question: "O ciclo de Calvin ocorre em qual parte do cloroplasto?", options: [{ text: "No estroma", correct: true }, { text: "Nos tilacoides", correct: false }, { text: "Na membrana externa", correct: false }] },
    { difficulty: "fácil", question: "Qual molécula é 'partida' na fotólise?", options: [{ text: "Água", correct: true }, { text: "Glicose", correct: false }, { text: "CO₂", correct: false }] },
    { difficulty: "fácil", question: "O que a planta produz como açúcar final da fotossíntese?", options: [{ text: "Glicose", correct: true }, { text: "Frutose apenas", correct: false }, { text: "Amido apenas", correct: false }] },
    { difficulty: "fácil", question: "Qual estrutura da folha deixa entrar CO₂?", options: [{ text: "Estoma", correct: true }, { text: "Nervura", correct: false }, { text: "Cutícula", correct: false }] },
    { difficulty: "fácil", question: "A fase clara da fotossíntese precisa diretamente de:", options: [{ text: "Luz", correct: true }, { text: "Glicose", correct: false }, { text: "Amido", correct: false }] },
    { difficulty: "fácil", question: "Quantas fases principais tem a fotossíntese?", options: [{ text: "Duas", correct: true }, { text: "Três", correct: false }, { text: "Uma", correct: false }] },
    { difficulty: "fácil", question: "O ciclo de Calvin usa qual gás como matéria-prima?", options: [{ text: "CO₂", correct: true }, { text: "O₂", correct: false }, { text: "N₂", correct: false }] },

    // ---- 5 intermédias ----
    { difficulty: "intermédia", question: "Que enzima fixa o CO₂ à RuBP?", options: [{ text: "Rubisco", correct: true }, { text: "ATP sintase", correct: false }, { text: "Amílase", correct: false }] },
    { difficulty: "intermédia", question: "Que duas moléculas a fase clara entrega ao ciclo de Calvin?", options: [{ text: "ATP e NADPH", correct: true }, { text: "CO₂ e O₂", correct: false }, { text: "Glicose e água", correct: false }] },
    { difficulty: "intermédia", question: "O que impulsiona a ATP sintase a produzir ATP?", options: [{ text: "O gradiente de H⁺", correct: true }, { text: "A luz diretamente", correct: false }, { text: "O CO₂", correct: false }] },
    { difficulty: "intermédia", question: "Qual é o primeiro açúcar de 3 carbonos formado no ciclo de Calvin?", options: [{ text: "G3P", correct: true }, { text: "Glicose", correct: false }, { text: "RuBP", correct: false }] },
    { difficulty: "intermédia", question: "O que volta do ciclo de Calvin para a fase clara?", options: [{ text: "ADP e NADP⁺", correct: true }, { text: "CO₂", correct: false }, { text: "Glicose", correct: false }] },

    // ---- 5 difíceis ----
    { difficulty: "difícil", question: "Se bloqueares a fotólise da água, qual é o efeito mais direto?", options: [{ text: "Deixa de haver eletrões e H⁺ disponíveis", correct: true }, { text: "O ciclo de Calvin acelera", correct: false }, { text: "A planta produz mais O₂", correct: false }] },
    { difficulty: "difícil", question: "Uma planta com luz abundante mas estomas fechados — o que trava primeiro?", options: [{ text: "O ciclo de Calvin, por falta de CO₂", correct: true }, { text: "A fase clara, por falta de luz", correct: false }, { text: "Nada é afetado", correct: false }] },
    { difficulty: "difícil", question: "Quantas voltas do ciclo de Calvin são necessárias para produzir uma molécula de glicose?", options: [{ text: "6", correct: true }, { text: "1", correct: false }, { text: "3", correct: false }] },
    { difficulty: "difícil", question: "Numa planta em escuridão total, o que se esgota primeiro e trava o ciclo de Calvin?", options: [{ text: "As reservas de ATP e NADPH", correct: true }, { text: "O CO₂ do ar", correct: false }, { text: "A RuBP", correct: false }] },
    { difficulty: "difícil", question: "Porque é que dizemos que a fotossíntese é 'um sistema' e não duas reações separadas?", options: [{ text: "Porque cada fase depende dos produtos da outra para continuar", correct: true }, { text: "Porque ocorrem exatamente ao mesmo tempo, sem relação", correct: false }, { text: "Porque usam a mesma enzima em ambas", correct: false }] }
];

class GoldTest {
    constructor(questions) {
        this.questions = questions;
        this.current = 0;
        this.correctCount = 0;
    }

    render() {
        const el = document.getElementById('goldtest-root');
        el.innerHTML = `
            <div class="final-quiz-header">
                <h1>🥇 Teste de ouro — Fotossíntese</h1>
                <p>20 perguntas · precisas de ${PASS_SCORE}/${TOTAL_QUESTIONS} para o emblema de ouro</p>
            </div>
            <div class="quiz-progress">
                <div class="quiz-progress-bar"><div class="quiz-progress-fill" id="goldProgressFill" style="width:0%"></div></div>
                <span id="goldProgressLabel">Pergunta 1 de ${this.questions.length}</span>
            </div>
            <div id="goldQuestionArea"></div>
        `;
        this.renderQuestion();
    }

    renderQuestion() {
        const q = this.questions[this.current];
        const area = document.getElementById('goldQuestionArea');
        area.innerHTML = `
            <div class="final-quiz-question active">
                <span class="quiz-question" style="opacity:0.6;">Nível: ${q.difficulty}</span>
                <h3>${q.question}</h3>
                <div class="final-quiz-options">
                    ${q.options.map((opt, i) => `
                        <button class="final-quiz-option" data-correct="${opt.correct}" data-option-index="${i}">
                            <span class="option-circle">${String.fromCharCode(65 + i)}</span>
                            <span class="option-text">${opt.text}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="quiz-feedback-slot"></div>
            </div>
        `;
        area.querySelectorAll('.final-quiz-option').forEach(opt => {
            opt.addEventListener('click', (e) => this.handleAnswer(e));
        });
        document.getElementById('goldProgressFill').style.width = `${(this.current / this.questions.length) * 100}%`;
        document.getElementById('goldProgressLabel').textContent = `Pergunta ${this.current + 1} de ${this.questions.length}`;
    }

    handleAnswer(event) {
        const button = event.target.closest('.final-quiz-option');
        if (!button || button.disabled) return;
        const isCorrect = button.dataset.correct === 'true';
        const container = button.closest('.final-quiz-question');
        container.querySelectorAll('.final-quiz-option').forEach(opt => {
            opt.disabled = true;
            if (opt.dataset.correct === 'true') opt.classList.add('correct');
            else if (opt === button) opt.classList.add('incorrect');
        });
        if (isCorrect) this.correctCount++;

        setTimeout(() => {
            this.current++;
            if (this.current < this.questions.length) {
                this.renderQuestion();
            } else {
                this.showResults();
            }
        }, 1000);
    }

    showResults() {
        const passed = this.correctCount >= PASS_SCORE;
        if (passed) {
            localStorage.setItem(`badge_${MISSION_ID}_gold`, 'true');
        }
        const el = document.getElementById('goldtest-root');
        el.innerHTML = `
            <div class="completion-screen">
                <div class="completion-badge">
                    <div class="badge-icon">${passed ? '🥇' : '🥈'}</div>
                    <h1>${passed ? 'Emblema de ouro conquistado!' : 'Ainda não chegou lá - continua prata por agora'}</h1>
                </div>
                <div class="completion-stats">
                    <div class="stat-card">
                        <div class="stat-icon">✓</div>
                        <div class="stat-content">
                            <div class="stat-label">Respostas certas</div>
                            <div class="stat-value">${this.correctCount}/${this.questions.length}</div>
                        </div>
                    </div>
                </div>
                <div class="completion-actions">
                    ${passed ? '' : `<button class="btn-primary" onclick="window.location.reload()">Tentar novamente</button>`}
                    <button class="btn-secondary" onclick="window.location.href='mission-photosynthesis.html'">Voltar ao capítulo</button>
                </div>
            </div>
        `;
    }
}

function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

document.addEventListener('DOMContentLoaded', () => {
    // Mantém a ordem fácil -> intermédia -> difícil, mas baralha DENTRO de cada
    // nível, para o aluno não decorar a posição exata das perguntas.
    const easy = shuffle(goldTestQuestions.filter(q => q.difficulty === 'fácil'));
    const medium = shuffle(goldTestQuestions.filter(q => q.difficulty === 'intermédia'));
    const hard = shuffle(goldTestQuestions.filter(q => q.difficulty === 'difícil'));
    const ordered = [...easy, ...medium, ...hard];

    const test = new GoldTest(ordered);
    test.render();
});
