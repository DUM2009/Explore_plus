/**
 * Mission Data - Fotossintese
 * Estrutura alinhada com o guiao pedagogico em cartoes por ecra.
 */

const missionData = {
    id: "photosynthesis",
    title: "🌿 Fotossíntese",
    description: "Descobre como a luz vira energia e como o CO2 se transforma em acucar.",
    screenFlowEnabled: true,
    totalXP: 190,
    badge: { icon: "🌿", name: "Mestre da Fotossíntese" },
    goldTestUrl: "mission-photosynthesis-goldtest.html",
    sections: [
        {
            id: "luz-vira-energia",
            title: "Definição e estruturas da fotossíntese",
            icon: "🧩",
            xpReward: 60,
            completionMessage: "Missão completa! +60 XP. Já dominas a definição e as estruturas envolvidas na fotossíntese.",
            content: `
            
            <div class="section-content">
                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Como é que uma planta consegue fabricar o próprio alimento sem cozinhar, sem boca e sem estômago?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>


                    <div class="screen-card">
                        <h3>O que é a fotossíntese?</h3>
                        <img class="card-visual" src="assets/images/Planta-fotossíntese.png" alt="Planta a receber luz solar">
                        <p>Ao contrário dos animais, as plantas não saem à procura de alimento. Elas próprias o fabricam!</p>
                        <p>Com a energia da luz do Sol, transformam água e dióxido de carbono em glicose, um açúcar que lhes fornece energia para crescer e sobreviver. Como "bónus", libertam oxigénio para a atmosfera. Este incrível processo chama-se <strong>fotossíntese</strong>.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Sabias que a fotossíntese tem uma fórmula química? Parece um bicho de sete cabeças, mas não é!</p>
                            <p style="text-align: center; font-size: 1.2em;"><strong>6CO<sub>2</sub> + 6H<sub>2</sub>O &rarr; C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6O<sub>2</sub></strong></p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Já sabemos que as plantas fabricam o seu alimento. Mas onde acontece essa transformação?</strong></p>
                        <p style="text-align: center; margin-top: 18px;"></p>
                        
                    </div>

                    <div class="screen-card">
                        <h3>As folhas: o principal local da fotossíntese</h3>
                        <img class="card-visual" src="assets/images/Folha.png" alt="Folha de planta">
                        <p>Embora toda a planta seja importante, é nas <strong>folhas</strong> que a maior parte da fotossíntese acontece.</p>
                        <p>As folhas possuem muitos cloroplastos, recebem luz solar e estão em contacto direto com o ar, facilitando a entrada de dióxido de carbono.</p>
                 <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Algumas folhas conseguem “mover-se” para captar melhor a luz do Sol e, assim, tornar a fotossíntese mais eficiente. Esse movimento chama-se <strong>heliotropismo!</strong>.</p>
                        </details>
                        </div>


<div class="screen-card">
                        <h3>Os estomas: as "portas" da folha</h3>
                        <img class="card-visual" src="assets/images/Estoma.png" alt="Estomas na folha de planta">
                        <p>As plantas também precisam de captar dióxido de carbono do ar. Para isso existem pequenos poros nas folhas chamados <strong>estomas</strong>.</p>
                        <p>Os estomas permitem a entrada de dióxido de carbono e a saída do oxigénio produzido durante a fotossíntese. Além disso, regulam a perda de vapor de água para o ambiente.</p>
                   <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>🌵 Algumas plantas de ambientes secos, como os cactos, abrem os estomas principalmente durante a noite. Assim, conseguem absorver dióxido de carbono sem perder tanta água durante o dia quente — uma adaptação que ajuda a sobreviver em desertos. 🌙🌵</p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <h3>O cloroplasto: a "fábrica" da fotossíntese</h3>
                        <img class="card-visual" src="assets/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Cloroplasto com destaque interno">
                        <p> Para fabricar o seu alimento, a planta precisa de um local onde todas as reações da fotossíntese acontecem. Esse local chama-se <strong>cloroplasto</strong>.</p>
                        <p>O cloroplasto é um organelo presente nas células das plantas e é considerado a fábrica da fotossíntese. É aqui que a energia da luz é captada e utilizada para transformar água e dióxido de carbono em glicose.</p>
                        <p>No interior do cloroplasto destacam-se os <strong>tilacoides</strong>, a <strong>clorofila</strong> e o <strong>estroma</strong>.</p>
                   <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Os cloroplastos têm o seu próprio DNA. Isso acontece porque, há milhões de anos, eles eram bactérias independentes que foram incorporadas por células ancestrais das plantas através de um processo chamado endossimbiose. Com o tempo, passaram a viver dentro das células vegetais e tornaram-se responsáveis pela fotossíntese.</p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <h3>Os tilacoides: os "painéis solares" da fotossíntese</h3>
                        <img class="card-visual" src="assets/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Cloroplasto com destaque interno">
                        <p> Dentro do cloroplasto existem pequenas estruturas em forma de discos empilhados chamadas tilacóides. É na membrana destes tilacóides que se encontra a clorofila, o pigmento verde responsável por captar a energia da luz solar.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Sabias que um único cloroplasto pode conter dezenas de tilacóides empilhados? Esta organização aumenta a superfície disponível para captar luz, tornando a fotossíntese muito mais eficiente.</p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <h3>A clorofila: o pigmento que capta a luz</h3>
                        <img class="card-visual" src="assets/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Cloroplasto com destaque interno">
                        <p>A <strong>clorofila</strong> é um pigmento verde presente nos cloroplastos. A sua principal função é <strong>captar a energia da luz solar</strong>, fornecendo a energia necessária para que a fotossíntese possa ocorrer.</p>
                        <p>É também a clorofila que dá às plantas a sua cor verde característica.</p>
                         <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Sabias que, a clorofila não é o único pigmento fotossintético nas plantas? Elas possuem vários, cada um capaz de absorver diferentes comprimentos de onda da luz. Isto permite que a planta aproveite melhor a energia do Sol. Alguns exemplos de pigmentos fotossintéticos são:</p>
                            <ul>
                                <li><strong>Carotenoides:</strong> pigmentos que absorvem luz azul e verde, refletindo tons de laranja e vermelho.</li>
                                <li><strong>Ficobilinas:</strong> pigmentos encontrados em algas, que absorvem luz verde e refletem tons de vermelho.</li>
                            </ul>
                    </div>

<div class="screen-card">
                        <h3>O estroma: o "citosol" do cloroplasto</h3>
                        <img class="card-visual" src="assets/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Cloroplasto com destaque interno">
                        <p> À volta dos tilacóides encontra-se um líquido chamado <strong>estroma</strong>. É nesta região que a planta utiliza a energia captada pela luz para fabricar glicose.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Sabias que, ao contrário dos tilacóides, que captam a energia da luz, o estroma utiliza essa energia para construir moléculas de glicose.</p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <h3>As raízes: a origem da água</h3>
                        <img class="card-visual" src="assets/images/Raízes 2.png" alt="Raízes da planta">
                        <p>A água utilizada na fotossíntese é absorvida pelas raízes. Depois de entrar na planta, a água é transportada através do caule até chegar às folhas, onde será utilizada na produção de glicose.</p>
                    <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>🌳 Algumas árvores têm redes de raízes que se ligam a fungos do solo, formando uma relação chamada <strong>micorriza</strong>. Os fungos ajudam a planta a absorver água e minerais, enquanto recebem açúcares produzidos pela fotossíntese.</p>
                        </details>
                        </div>


                </div>
            `,
            quiz: {
                questions: [
                    {
                        question: "O que é a fotossíntese?",
                        options: [
                            { text: "Processo em que a planta produz glicose a partir de luz, água e CO<sub>2</sub>", correct: true },
                            { text: "Processo de respiração noturna da planta", correct: false },
                            { text: "Processo que só produz oxigénio", correct: false }
                        ],
                        feedback: {
                            correct: "Correto! Essa é a definição central da fotossíntese.",
                            incorrect: "Revê: a fotossíntese produz glicose e liberta oxigénio."
                        }
                    },
                    {
                        question: "Em que organelo ocorre a fotossíntese?",
                        options: [
                            { text: "No núcleo", correct: false },
                            { text: "No cloroplasto", correct: true },
                            { text: "Na mitocôndria", correct: false }
                        ],
                        feedback: {
                            correct: "Exato! O cloroplasto é o organelo chave da fotossíntese.",
                            incorrect: "A fotossíntese ocorre no cloroplasto."
                        }
                    },
                    {
                        question: "Qual pigmento capta a luz?",
                        options: [
                            { text: "Rubisco", correct: false },
                            { text: "Clorofila", correct: true },
                            { text: "Amido", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! A clorofila capta a energia luminosa.",
                            incorrect: "Quem capta a luz é a clorofila."
                        }
                    },
                    {
                        question: "Qual estrutura permite a entrada de CO<sub>2</sub> na folha?",
                        options: [
                            { text: "Estoma", correct: true },
                            { text: "Nervura", correct: false },
                            { text: "Raiz", correct: false }
                        ],
                        feedback: {
                            correct: "Boa! O CO2 entra pelos estomas.",
                            incorrect: "A entrada de CO2 ocorre pelos estomas."
                        }
                    },
                    {
                        question: "Qual é o principal açúcar produzido pela fotossíntese?",
                        options: [
                            { text: "Glicose", correct: true },
                            { text: "Celulose", correct: false },
                            { text: "Proteína", correct: false }
                        ],
                        feedback: {
                            correct: "Muito bem! A glicose é o produto energético principal.",
                            incorrect: "O principal açúcar produzido é a glicose."
                        }
                    }
                ]
            }
        },
        {
            id: "do-ar-ao-açúcar",
            title: "Fase clara",
            icon: "⚡",
            xpReward: 60,
            completionMessage: "Missão completa! +60 XP. Já entendes como a luz se converte em ATP e NADPH.",
            content: `
                <div class="section-content">
                    
                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Já sabemos onde acontece a fotossíntese. Mas como é que a luz do Sol é transformada em energia útil para a planta?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 1 - Gancho</h3>
                        <img class="screen-visual" src="assets/images/Membrana dos tilacoides.jpg" alt="Luz solar a atingir membrana verde">
                        <p>Tudo começa quando a luz do Sol atinge a clorofila. Ao absorver essa luz, a clorofila capta energia que dá início às primeiras reações da fotossíntese. Esta etapa recebe o nome de fase clara.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 2 - Pergunta guia</h3>
                        <img class="screen-visual" src="assets/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Cloroplasto com tilacoides">
                        <p>A água serve apenas para transporte, ou também participa diretamente na fase clara?</p>
                        <div class="guide-options">
                            <button class="guide-option" data-choice="so-transporta" data-correct="false">So transporta</button>
                            <button class="guide-option" data-choice="participa" data-correct="true">Participa diretamente</button>
                        </div>
                        <p class="neutral-feedback">Vamos ver como a água entra na fase clara.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 3 - Onde ocorre</h3>
                        <img class="card-visual" src="assets/images/Tilacoides 2.jpg" alt="Tilacoides no cloroplasto">
                        <p>A fase clara ocorre nos <strong>tilacoides</strong>, onde estão os pigmentos e a maquinaria que usa a luz.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 4 - Fotólise da água</h3>
                        <img class="card-visual" src="assets/images/Fotólise da água.jpg" alt="Divisao da agua em produtos">
                        <p>A luz permite dividir água (fotólise), libertando <strong>eletrões</strong>, <strong>H+</strong> e <strong>O2</strong>.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 5 - Cadeia de eletrões</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m1-card-chain.svg" alt="Cadeia transportadora de eletrões">
                        <p>Os eletrões percorrem uma cadeia de transporte. A energia libertada bombeia H+ para o interior do tilacoide.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 6 - ATP e NADPH</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m1-card-atp.svg" alt="Formacao de ATP e NADPH">
                        <p>O gradiente de H+ alimenta a ATP sintase para formar <strong>ATP</strong>. No fim, tambem se forma <strong>NADPH</strong>.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 7 - Mini-interacao</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m1-mini.svg" alt="Sequencia da fase clara">
                        <p><strong>Sequenciar:</strong> Luz na clorofila -> Fotolise -> Cadeia de eletrões -> Gradiente de H+ -> ATP/NADPH.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 8 - Curiosidade</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m1-curiosity.svg" alt="Curiosidade da fase clara">
                        <p>O oxigenio libertado na atmosfera vem desta fase, a partir da fotolise da agua.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 9 - Quiz rapido</h3>
                        <p>Valida o teu entendimento da fase clara com 5 perguntas.</p>
                    </div>

                    <div class="screen-card reward-card">
                        <h3>Ecra 10 - Recompensa</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-reward.svg" alt="Recompensa da fase clara">
                        <p>Missão completa! +60 XP. Já estás pronto para a fase escura.</p>
                    </div>
                </div>
            `,
            quiz: {
                questions: [
                    {
                        question: "Onde ocorre a fase clara da fotossintese?",
                        options: [
                            { text: "No estroma", correct: false },
                            { text: "Nos tilacoides", correct: true },
                            { text: "No nucleo", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! A fase clara decorre nos tilacoides.",
                            incorrect: "Revê: esta fase acontece nos tilacoides."
                        }
                    },
                    {
                        question: "De onde vem o oxigenio libertado?",
                        options: [
                            { text: "Do CO2", correct: false },
                            { text: "Da agua (fotolise)", correct: true },
                            { text: "Da glicose", correct: false }
                        ],
                        feedback: {
                            correct: "Exato. O O2 vem da divisao da agua.",
                            incorrect: "Pista: a origem do O2 e a fotolise da agua."
                        }
                    },
                    {
                        question: "Qual e a funcao da cadeia transportadora de eletrões?",
                        options: [
                            { text: "Criar gradiente de H+ para produzir ATP", correct: true },
                            { text: "Produzir glicose diretamente", correct: false },
                            { text: "Fixar CO2", correct: false }
                        ],
                        feedback: {
                            correct: "Isso mesmo! A cadeia prepara energia para a sintese de ATP.",
                            incorrect: "A cadeia serve para gerar gradiente de H+, nao para produzir glicose direta."
                        }
                    },
                    {
                        question: "O que impulsiona a ATP sintase?",
                        options: [
                            { text: "A luz diretamente", correct: false },
                            { text: "O gradiente de H+", correct: true },
                            { text: "O CO2", correct: false }
                        ],
                        feedback: {
                            correct: "Correto! O fluxo de H+ e o motor da ATP sintase.",
                            incorrect: "Pensa no gradiente de H+ como a forca que move a enzima."
                        }
                    },
                    {
                        question: "Que moleculas energeticas resultam da fase clara?",
                        options: [
                            { text: "ATP e NADPH", correct: true },
                            { text: "Glicose e amido", correct: false },
                            { text: "RuBP e rubisco", correct: false }
                        ],
                        feedback: {
                            correct: "Perfeito. ATP e NADPH alimentam a fase escura.",
                            incorrect: "As moleculas energeticas desta fase sao ATP e NADPH."
                        }
                    }
                ]
            }
        },
        {
            id: "liga-os-pontos",
            title: "Fase escura (ciclo de Calvin)",
            icon: "🌑",
            xpReward: 70,
            completionMessage: "Missao completa! +70 XP. Ja consegues explicar como o CO2 vira glicose no ciclo de Calvin.",
            content: `
                <div class="section-content">
                    <div class="screen-card">
                        <h3>Ecra 1 - Gancho</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-hook.svg" alt="ATP e NADPH a entrar no estroma">
                        <p>A fase escura usa a energia da fase clara para transformar CO2 em compostos organicos.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 2 - Pergunta guia</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-guide.svg" alt="CO2 a entrar pelo estoma">
                        <p>A fase escura precisa de luz direta, ou pode funcionar sem luz direta se houver ATP e NADPH?</p>
                        <div class="guide-options">
                            <button class="guide-option" data-choice="luz-direta" data-correct="false">Precisa de luz direta</button>
                            <button class="guide-option" data-choice="sem-luz-direta" data-correct="true">Nao usa luz direta, usa ATP/NADPH</button>
                        </div>
                        <p class="neutral-feedback">Boa! Esta fase e chamada de independente da luz direta.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 3 - Onde ocorre</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m2-card-where.svg" alt="Estroma no cloroplasto">
                        <p>O ciclo de Calvin ocorre no <strong>estroma</strong> do cloroplasto.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 4 - Fixacao do carbono</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m2-card-fix.svg" alt="CO2 ligado a RuBP">
                        <p>O CO2 fixa-se a <strong>RuBP</strong> com ajuda da <strong>rubisco</strong>.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 5 - Reducao</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m2-card-reduction.svg" alt="Reducao para formar G3P">
                        <p>ATP e NADPH fornecem energia e eletrões para formar <strong>G3P</strong>.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 6 - Regeneracao</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m2-card-regeneration.svg" alt="Regeneracao da RuBP">
                        <p>Grande parte do G3P regenera RuBP; uma parte sai para produzir glicose.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 7 - Mini-interacao</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-mini.svg" alt="Representacao do ciclo de Calvin">
                        <p><strong>Completar o ciclo:</strong> CO2 -> RuBP -> fixacao -> G3P -> regeneracao.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 8 - Curiosidade</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-curiosity.svg" alt="Curiosidade sobre voltas do ciclo">
                        <p>Sao necessarias 6 voltas do ciclo para produzir uma molecula de glicose.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Ecra 9 - Quiz da fase escura</h3>
                        <p>Consolida agora os passos do ciclo de Calvin.</p>
                    </div>

                    <div class="screen-card reward-card">
                        <h3>Ecra 10 - Recompensa</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m3-reward.svg" alt="Recompensa da fase escura">
                        <p>Capitulo completo! +70 XP. Agora conheces definicao, fase clara e fase escura.</p>
                    </div>
                </div>
            `,
            quiz: {
                questions: [
                    {
                        question: "Onde ocorre o ciclo de Calvin?",
                        options: [
                            { text: "Nos tilacoides", correct: false },
                            { text: "No estroma", correct: true },
                            { text: "No nucleo", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! O ciclo de Calvin ocorre no estroma.",
                            incorrect: "Revê: a fase escura ocorre no estroma."
                        }
                    },
                    {
                        question: "Qual enzima fixa CO2 a RuBP?",
                        options: [
                            { text: "ATP sintase", correct: false },
                            { text: "Rubisco", correct: true },
                            { text: "Amilase", correct: false }
                        ],
                        feedback: {
                            correct: "Exato! A rubisco e a enzima de fixacao do carbono.",
                            incorrect: "A enzima correta e a rubisco."
                        }
                    },
                    {
                        question: "O que fornece energia para formar G3P?",
                        options: [
                            { text: "ATP e NADPH", correct: true },
                            { text: "Luz direta", correct: false },
                            { text: "Oxigenio", correct: false }
                        ],
                        feedback: {
                            correct: "Correto! ATP e NADPH alimentam esta fase.",
                            incorrect: "A fase escura usa ATP e NADPH vindos da fase clara."
                        }
                    },
                    {
                        question: "Porque a fase escura e dita independente da luz?",
                        options: [
                            { text: "Porque nao usa luz diretamente", correct: true },
                            { text: "Porque ocorre apenas a noite", correct: false },
                            { text: "Porque nao precisa de energia", correct: false }
                        ],
                        feedback: {
                            correct: "Boa! Ela nao usa fotões diretamente, mas depende de ATP/NADPH.",
                            incorrect: "Nao e fase noturna obrigatoria: apenas nao usa luz diretamente."
                        }
                    },
                    {
                        type: "open",
                        question: "Explica em 2-3 frases como o CO2 e transformado em glicose na fase escura.",
                        placeholder: "Ex.: O CO2 entra no ciclo de Calvin, fixa-se a RuBP...",
                        minKeywords: 2,
                        keywords: ["co2", "rubisco", "rubp", "g3p", "atp", "nadph", "glicose"],
                        feedback: {
                            correct: "Boa explicacao! Ligaste corretamente os passos da fase escura.",
                            incorrect: "Inclui fixacao do CO2 (rubisco/RuBP) e uso de ATP/NADPH para formar glicose."
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
