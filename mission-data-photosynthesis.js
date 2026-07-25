/**
 * Mission Data - Fotossíntese
 * Estrutura alinhada com o guião pedagógico em cartões por ecrã.
 */

const missionData = {
    id: "photosynthesis",
    title: "🌿 Fotossíntese",
    description: "Descobre como a luz vira energia e como o CO₂ se transforma em açúcar.",
    totalXP: 190,
    badge: { icon: "🌿", name: "Mestre da Fotossíntese" },
    goldTestUrl: "mission-photosynthesis-goldtest.html",
    sections: [
        {
            id: "luz-vira-energia",
            title: "Luz vira energia (fase clara)",
            icon: "⚡",
            xpReward: 60,
            content: `
                <div class="section-content">
                    <div class="screen-card">
                        <h3>Ecrã 1 — Gancho</h3>
                        <img class="screen-visual" src="assets/images/Membrana dos tilacoides.jpg" alt="Luz solar a atingir membrana verde">
                        <p>A luz do sol não entra na planta e sai já transformada em açúcar. Antes disso, ela passa por uma verdadeira central elétrica dentro da folha.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 2 — Pergunta guia</h3>
                        <img class="screen-visual" src="assets/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Esquema simples de cloroplasto com tilacoides em destaque">
                        <p>Achas que a planta usa a água apenas para transportar nutrientes, ou também para <strong>produzir</strong> algo durante a fotossíntese?</p>
                        <div class="guide-options">
                            <button class="guide-option" data-choice="transporta">💧 Só transporta</button>
                            <button class="guide-option" data-choice="produz">⚡ Também produz algo</button>
                        </div>
                        <p class="neutral-feedback">Vamos ver o que a água realmente faz aqui dentro.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 3 — Explicação em blocos</h3>
                        <div class="screen-subcards">
                            <div class="info-card">
                                <h4>Cartão 1 — Onde acontece</h4>
                                <img class="card-visual" src="assets/images/Tilacoides 2.jpg" alt="Zoom folha para célula para cloroplasto para tilacoide">
                                <p>A fase clara ocorre nos <strong>tilacoides</strong>, membranas dentro do cloroplasto onde está a clorofila.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 2 — Fotólise da água</h4>
                                <img class="card-visual" src="assets/images/Fotólise da água.jpg" alt="Molécula de água dividida em eletrões, protões e oxigénio">
                                <p>A luz "parte" a molécula de água (fotólise). Isso liberta <strong>eletrões</strong>, <strong>protões (H⁺)</strong> e <strong>oxigénio</strong>, que sai para o ar.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 3 — Cadeia transportadora de eletrões</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m1-card-chain.svg" alt="Eletrões a percorrer proteínas na membrana com H mais a acumular">
                                <p>Os eletrões libertados passam por uma sequência de proteínas na membrana — a <strong>cadeia transportadora de eletrões</strong>. Nesse percurso, a energia deles é usada para bombear H⁺ para dentro do tilacoide.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 4 — ATP e NADPH</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m1-card-atp.svg" alt="ATP sintase em forma de turbina e formação de NADPH">
                                <p>A acumulação de H⁺ cria um gradiente que impulsiona a <strong>ATP sintase</strong> a produzir <strong>ATP</strong>. Os eletrões terminam o percurso a formar <strong>NADPH</strong>.</p>
                            </div>
                        </div>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 4 — Mini-interação</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m1-mini.svg" alt="Sequência da fase clara do início ao fim">
                        <p><strong>Sequenciar:</strong> Luz na clorofila → Fotólise da água → Cadeia de eletrões → Acumulação de H⁺ → ATP + NADPH.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 5 — Curiosidade</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m1-curiosity.svg" alt="Ícone de relógio e planta">
                        <p>Todo o oxigénio que existe hoje na atmosfera veio, ao longo de milhões de anos, desta mesma reação de fotólise da água.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 6 — Quiz rápido</h3>
                        <p>Responde às 5 perguntas com feedback imediato para concluir a missão.</p>
                    </div>

                    <div class="screen-card reward-card">
                        <h3>Ecrã 7 — Recompensa</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m1-reward.svg" alt="Barra de XP a encher e selo missão 1 de 3">
                        <p>Missão completa! +60 XP. Já sabes como a luz se transforma em ATP e NADPH para a próxima fase.</p>
                    </div>
                </div>
            `,
            quiz: {
                questions: [
                    {
                        question: "Onde ocorre a fase clara da fotossíntese?",
                        options: [
                            { text: "No estroma", correct: false },
                            { text: "Nos tilacoides", correct: true },
                            { text: "No núcleo", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! É nas membranas dos tilacoides que está a clorofila e a maquinaria da fase clara.",
                            incorrect: "Revê: a fase clara acontece nos tilacoides."
                        }
                    },
                    {
                        question: "De onde vem o oxigénio libertado na fotossíntese?",
                        options: [
                            { text: "Do CO₂", correct: false },
                            { text: "Da água (fotólise)", correct: true },
                            { text: "Da glicose", correct: false }
                        ],
                        feedback: {
                            correct: "Exato — a fotólise da água é que liberta o O₂, não o CO₂.",
                            incorrect: "Pista: o O₂ vem da divisão da água."
                        }
                    },
                    {
                        question: "Qual é a função da cadeia transportadora de eletrões?",
                        options: [
                            { text: "Usar a energia dos eletrões para bombear H⁺ e criar um gradiente", correct: true },
                            { text: "Produzir glicose diretamente", correct: false },
                            { text: "Absorver CO₂ do ar", correct: false }
                        ],
                        feedback: {
                            correct: "Isso mesmo — a cadeia prepara a energia para a fase seguinte.",
                            incorrect: "Revê a cadeia: ela usa energia dos eletrões para criar gradiente de H⁺."
                        }
                    },
                    {
                        question: "O que impulsiona a ATP sintase a produzir ATP?",
                        options: [
                            { text: "A luz diretamente", correct: false },
                            { text: "O gradiente de H⁺ acumulado no tilacoide", correct: true },
                            { text: "O oxigénio libertado", correct: false }
                        ],
                        feedback: {
                            correct: "Correto — é o fluxo de H⁺ pela ATP sintase que gera ATP.",
                            incorrect: "Pensa na 'turbina': ela é movida pelo gradiente de H⁺."
                        }
                    },
                    {
                        question: "Se bloqueares a fotólise da água numa planta, o que deixa de acontecer primeiro?",
                        options: [
                            { text: "A libertação de eletrões e a formação do gradiente de H⁺", correct: true },
                            { text: "A absorção de CO₂", correct: false },
                            { text: "O ciclo de Calvin, diretamente", correct: false }
                        ],
                        feedback: {
                            correct: "Muito bem — sem fotólise, a cadeia fica sem eletrões e sem H⁺.",
                            incorrect: "Sem fotólise, o primeiro bloqueio é na libertação de eletrões/H⁺."
                        }
                    }
                ]
            }
        },
        {
            id: "do-ar-ao-acucar",
            title: "Do ar ao açúcar (ciclo de Calvin)",
            icon: "🍬",
            xpReward: 60,
            content: `
                <div class="section-content">
                    <div class="screen-card">
                        <h3>Ecrã 1 — Gancho</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-hook.svg" alt="ATP e NADPH a entrar numa nova zona do cloroplasto">
                        <p>Na missão anterior, a planta fabricou energia (ATP) e poder redutor (NADPH). Mas isso não é açúcar. Falta um passo — e é aqui que o CO₂ do ar entra em jogo.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 2 — Pergunta guia</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-guide.svg" alt="Folha a absorver CO2 pelo estoma">
                        <p>Achas que a planta precisa de <strong>luz direta</strong> para transformar CO₂ em açúcar, ou consegue fazê-lo mesmo <strong>no escuro</strong>, desde que tenha ATP e NADPH?</p>
                        <div class="guide-options">
                            <span>☀️ Precisa de luz direta</span>
                            <span>🌑 Consegue no escuro, com ATP/NADPH</span>
                        </div>
                        <p class="neutral-feedback">Boa aposta — vamos ver porque esta fase é chamada de independente da luz.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 3 — Explicação em blocos</h3>
                        <div class="screen-subcards">
                            <div class="info-card">
                                <h4>Cartão 1 — Onde acontece</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m2-card-where.svg" alt="Cloroplasto com estroma destacado à volta dos tilacoides">
                                <p>O ciclo de Calvin ocorre no <strong>estroma</strong>, o fluido que envolve os tilacoides dentro do cloroplasto.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 2 — Fixação do carbono</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m2-card-fix.svg" alt="CO2 a ligar-se à RuBP e a dividir-se em duas moléculas">
                                <p>O CO₂ do ar liga-se à <strong>RuBP</strong> com ajuda da <strong>rubisco</strong>, formando uma molécula instável que se parte em duas.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 3 — Redução</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m2-card-reduction.svg" alt="ATP e NADPH a transformar moléculas em G3P">
                                <p>O ATP e o NADPH da missão anterior fornecem energia e eletrões para transformar essas moléculas em <strong>G3P</strong>.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 4 — Regeneração</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m2-card-regeneration.svg" alt="Seta circular de regeneração da RuBP e saída para glicose">
                                <p>A maior parte do G3P é reciclada para regenerar RuBP; só uma pequena parte sai para formar glicose e outros açúcares.</p>
                            </div>
                        </div>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 4 — Mini-interação</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-mini.svg" alt="Ciclo de Calvin com posições CO2, RuBP, G3P e regeneração">
                        <p><strong>Completar o ciclo:</strong> CO₂ → RuBP → fixação → G3P → regeneração → RuBP (com saída para glicose).</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 5 — Curiosidade</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-curiosity.svg" alt="Planta com relógio a girar rápido">
                        <p>São precisas <strong>6 voltas</strong> completas do ciclo de Calvin para produzir uma molécula de glicose.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 6 — Quiz rápido</h3>
                        <p>Responde às 5 perguntas para consolidar a ligação entre fase clara e ciclo de Calvin.</p>
                    </div>

                    <div class="screen-card reward-card">
                        <h3>Ecrã 7 — Recompensa</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-reward.svg" alt="Barra de XP e selo missão 2 de 3">
                        <p>Missão completa! +60 XP. Agora sabes como o CO₂ se transforma em açúcar.</p>
                    </div>
                </div>
            `,
            quiz: {
                questions: [
                    {onClick={event => event.preventDefault(); const clicked =event.target.dataset.clicked; if (clicked.toLowerCase() !== "true") return; showToast();}

                        question: "Onde ocorre o ciclo de Calvin?",
                        options: [
                            { text: "Nos tilacoides", correct: false },
                            { text: "No estroma", correct: true },
                            { text: "No núcleo", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! O estroma é o fluido à volta dos tilacoides.",
                            incorrect: "Revê: o Calvin ocorre no estroma."
                        }
                    },
                    {
                        question: "Qual enzima fixa o CO₂ à RuBP?",
                        options: [
                            { text: "ATP sintase", correct: false },
                            { text: "Rubisco", correct: true },
                            { text: "NADPH redutase", correct: false }
                        ],
                        feedback: {
                            correct: "Exato — a rubisco faz a fixação do carbono.",
                            incorrect: "A enzima de fixação é a rubisco."
                        }
                    },
                    {
                        question: "O que fornece energia e eletrões para formar G3P?",
                        options: [
                            { text: "ATP e NADPH produzidos na fase clara", correct: true },
                            { text: "Luz solar diretamente", correct: false },
                            { text: "Oxigénio da fotólise", correct: false }
                        ],
                        feedback: {
                            correct: "Isso mesmo — a fase clara produz, o Calvin usa.",
                            incorrect: "A energia vem de ATP e NADPH da fase clara."
                        }
                    },
                    {
                        question: "Porque se diz que o Calvin é independente da luz?",
                        options: [
                            { text: "Porque não precisa de CO₂", correct: false },
                            { text: "Porque não usa luz diretamente, só ATP/NADPH", correct: true },
                            { text: "Porque só ocorre à noite", correct: false }
                        ],
                        feedback: {
                            correct: "Boa! Não usa fotões diretamente.",
                            incorrect: "Ele não usa luz diretamente; usa ATP/NADPH já produzidos."
                        }
                    },
                    {
                        question: "Se faltar CO₂, mas houver luz, o que acontece primeiro?",
                        options: [
                            { text: "O ciclo de Calvin para por falta de carbono", correct: true },
                            { text: "A fase clara para imediatamente", correct: false },
                            { text: "Nada muda", correct: false }
                        ],
                        feedback: {
                            correct: "Correto — sem CO₂ não há fixação de carbono.",
                            incorrect: "Sem CO₂, o bloqueio direto é no ciclo de Calvin."
                        }
                    }
                ]
            }
        },
        {
            id: "liga-os-pontos",
            title: "Liga os pontos (síntese)",
            icon: "🔗",
            xpReward: 70,
            content: `
                <div class="section-content">
                    <div class="screen-card">
                        <h3>Ecrã 1 — Gancho</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m3-hook.svg" alt="Fase clara e ciclo de Calvin lado a lado a ligarem-se">
                        <p>Já viste as duas metades da fotossíntese em separado. Agora vamos ver como uma falha numa delas afeta a outra.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 2 — Pergunta guia</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m3-guide.svg" alt="Tilacoide e estroma lado a lado num esquema">
                        <p>Se tapasses uma planta com um saco escuro por um dia inteiro, o ciclo de Calvin pararia <strong>de imediato</strong>, ou continuaria por algum tempo com as reservas?</p>
                        <div class="guide-options">
                            <span>⚡ Para de imediato</span>
                            <span>⏳ Continua por algum tempo com reservas</span>
                        </div>
                        <p class="neutral-feedback">Vamos ver exatamente o que liga (e separa) as duas fases.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 3 — Explicação em blocos</h3>
                        <div class="screen-subcards">
                            <div class="info-card">
                                <h4>Cartão 1 — O que a fase clara entrega</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m3-card-deliver.svg" alt="Seta de ATP e NADPH do tilacoide para o estroma">
                                <p>A fase clara produz <strong>ATP</strong> e <strong>NADPH</strong> a partir de luz e água. Sem eles, o Calvin fica sem combustível.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 2 — O que o Calvin devolve</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m3-card-return.svg" alt="Seta de ADP e NADP mais do estroma para o tilacoide">
                                <p>O Calvin consome ATP/NADPH e devolve <strong>ADP</strong> e <strong>NADP⁺</strong> para recarga na fase clara.</p>
                            </div>
                            <div class="info-card">
                                <h4>Cartão 3 — Um sistema, não dois</h4>
                                <img class="card-visual" src="assets/images/photosynthesis/m3-card-system.svg" alt="Tilacoide a apagar e ciclo de Calvin a parar">
                                <p>Se a fase clara parar, o Calvin esgota rapidamente as reservas de ATP/NADPH e para também.</p>
                            </div>
                        </div>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 4 — Mini-interação</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m3-mini.svg" alt="Diagrama interativo das partes do sistema da fotossíntese">
                        <p><strong>Diagrama interativo:</strong> toca em tilacoide, estroma, seta ATP/NADPH e seta ADP/NADP⁺ para rever o sistema completo.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 5 — Curiosidade</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m3-curiosity.svg" alt="Folha com gráfico de temperatura">
                        <p>Em dias muito quentes, algumas plantas fecham os estomas para poupar água — reduzindo CO₂ e travando o ciclo de Calvin.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecrã 6 — Quiz de síntese</h3>
                        <p>6 perguntas (inclui resposta aberta final) para consolidar a interdependência das duas fases.</p>
                    </div>

                    <div class="screen-card reward-card">
                        <h3>Ecrã 7 — Recompensa</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m3-reward.svg" alt="Confetis, emblema de prata e progresso do capítulo a 100 por cento">
                        <p>Capítulo completo! +70 XP e emblema de prata. Se quiseres ouro: acerta 17/20 no teste final.</p>
                    </div>
                </div>
            `,
            quiz: {
                questions: [
                    {
                        question: "Qual molécula liga diretamente a fase clara ao ciclo de Calvin, fornecendo energia?",
                        options: [
                            { text: "ATP", correct: true },
                            { text: "Glicose", correct: false },
                            { text: "Rubisco", correct: false }
                        ],
                        feedback: {
                            correct: "Certo — ATP (com NADPH) é a ponte de energia.",
                            incorrect: "A molécula ponte de energia é o ATP."
                        }
                    },
                    {
                        question: "O que volta do ciclo de Calvin para a fase clara?",
                        options: [
                            { text: "CO₂", correct: false },
                            { text: "ADP e NADP⁺", correct: true },
                            { text: "Glicose", correct: false }
                        ],
                        feedback: {
                            correct: "Exato — versões 'descarregadas' para recarregar na fase clara.",
                            incorrect: "Voltam ADP e NADP⁺."
                        }
                    },
                    {
                        question: "Com luz abundante mas sem CO₂ (estomas fechados), o que acontece ao Calvin?",
                        options: [
                            { text: "Trava por falta de carbono para fixar", correct: true },
                            { text: "Acelera por ter mais ATP", correct: false },
                            { text: "Não é afetado", correct: false }
                        ],
                        feedback: {
                            correct: "Boa aplicação — sem CO₂ não há fixação de carbono.",
                            incorrect: "Sem CO₂ o Calvin trava."
                        }
                    },
                    {
                        question: "Se bloqueares a rubisco, qual o efeito mais direto?",
                        options: [
                            { text: "CO₂ deixa de se ligar à RuBP", correct: true },
                            { text: "Fotólise da água para", correct: false },
                            { text: "Cadeia transportadora para", correct: false }
                        ],
                        feedback: {
                            correct: "Certo — a rubisco atua na fixação do carbono.",
                            incorrect: "Rubisco bloqueada impede a ligação CO₂-RuBP."
                        }
                    },
                    {
                        question: "Em escuridão total, o que se esgota primeiro, impedindo o Calvin?",
                        options: [
                            { text: "Reservas de ATP e NADPH", correct: true },
                            { text: "CO₂ do ar", correct: false },
                            { text: "RuBP", correct: false }
                        ],
                        feedback: {
                            correct: "Exato — sem luz não há reposição de ATP/NADPH.",
                            incorrect: "As reservas que se esgotam primeiro são ATP e NADPH."
                        }
                    },
                    {
                        type: "open",
                        question: "Explica por palavras tuas (2-3 frases): porque dizemos que a fotossíntese é um sistema e não duas reações separadas?",
                        placeholder: "Ex.: As duas fases dependem uma da outra...",
                        minKeywords: 2,
                        keywords: ["atp", "nadph", "depende", "liga", "fase clara", "calvin"],
                        feedback: {
                            correct: "Boa síntese! Mostraste a ligação entre as duas fases e a dependência mútua.",
                            incorrect: "Inclui explicitamente a ligação ATP/NADPH ↔ Calvin e a ideia de dependência entre fases."
                        }
                    }
                ]
            }
        }
    ]
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = missionData;
}
