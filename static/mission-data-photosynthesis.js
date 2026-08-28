/**
 * Mission Data - Fotossintese
 * Estrutura alinhada com o guiao pedagogico em cartoes por ecra.
 * 6 etapas: Introducao, Componentes da planta, Fase clara, Fase escura,
 * Importancia, Desafio final.
 */

const missionData = {
    id: "photosynthesis",
    title: "🌿 Fotossíntese",
    description: "Descobre como a luz vira energia e como o CO2 se transforma em açúcar.",
    screenFlowEnabled: true,
    totalXP: 290,
    badge: { icon: "🌿", name: "Mestre da Fotossíntese" },
    goldTestUrl: "mission-photosynthesis-goldtest.html",
    mascot: {
        image: "Mascote Explore+ Geology.png",
        introGreeting: "Olá, aprendiz! 👋 Hoje vamos explorar a missão {missionTitle}. Estás preparado para começar a aventura?",
        introCta: "Estou sempre preparado",
        startGreeting: "Olá {studentTitle}! Hoje, a tua missão é perceber a fotossíntese. Posso ser o teu ajudante nesta aventura ou podes embarcar nela sozinho! O que preferes?",
        startGuidedLabel: "Exploração guiada (com a mascote)",
        startAutonomousLabel: "Exploração livre (autónomo)",
        startGuidedFollowup: "Fantástico. Que comece a aventura. Estás preparado?",
        startGuidedCta: "Estou sempre preparado",
        startAutonomousFollowup: "Que corajoso! Mas lembra-te... sempre que precisares, estarei aqui para ajudar.",
        curiosityPrompt: "Queres saber uma curiosidade? 🔍",
        curiosityAcceptCta: "Claro",
        curiosityDeclineCta: "Talvez mais tarde",
        quizIntro: "Agora que já exploramos {sectionTitle}, vou desafiar-te com algumas perguntas. Estás preparado?",
        quizIntroCta: "Estou sempre preparado",
        correctPopup: "Boa! 👍",
        incorrectIntro: "Opa, vejo que não percebeste muito bem esta matéria. Deixa-me explicar de outra forma:"
    },
    sections: [
        {
            id: "introducao",
            title: "Introdução",
            subtitle: "Onde tudo começa",
            icon: "🌱",
            accentColor: "#1f8a5b",
            xpReward: 30,
            completionMessage: "Etapa concluída! +30 XP. Já sabes o que é a fotossíntese e como se resume.",
            explorerTip: "Relembra: luz + água + CO₂ = energia para a planta! ☀️💧",
            content: `
            <div class="section-content">
                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Como é que uma planta consegue fabricar o próprio alimento sem cozinhar, sem boca e sem estômago?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

                    <div class="screen-card">
                        <h3>O que é a fotossíntese?</h3> <br>
                        <img class="card-visual" src="/static/images/Planta-fotossíntese.png" alt="Planta a receber luz solar">
                        <p>Ao contrário dos animais, as plantas não saem à procura de alimento. Elas próprias o fabricam!</p>
                        <p>Com a energia da luz do Sol, transformam água e dióxido de carbono em glicose, um açúcar que lhes fornece energia para crescer e sobreviver. Como "bónus", libertam oxigénio para a atmosfera. Este incrível processo chama-se <strong>fotossíntese</strong>.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Sabias que a fotossíntese tem uma fórmula química? Parece um bicho de sete cabeças, mas não é!</p>
                            <p style="text-align: center; font-size: 1.2em;"><strong>6CO<sub>2</sub> + 6H<sub>2</sub>O &rarr; C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6O<sub>2</sub></strong></p>
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
                        },
                        alternateExplanation: "Pensa nisto como uma 'receita': a planta usa a luz do Sol como fonte de energia para combinar água e dióxido de carbono e cozinhar o seu próprio alimento — a glicose. O oxigénio que sobra desta receita é libertado para o ar que respiramos."
                    },
                    {
                        question: "Quais são os reagentes (matérias-primas) da fotossíntese?",
                        options: [
                            { text: "Água e dióxido de carbono", correct: true },
                            { text: "Oxigénio e glicose", correct: false },
                            { text: "Azoto e glicose", correct: false }
                        ],
                        feedback: {
                            correct: "Exato! Água e CO<sub>2</sub> são os ingredientes de partida.",
                            incorrect: "Revê: os ingredientes de partida são água e dióxido de carbono."
                        },
                        alternateExplanation: "Se a fotossíntese fosse uma receita de cozinha, a água (que vem das raízes) e o dióxido de carbono (que entra pelos estomas) seriam os ingredientes crus. A glicose e o oxigénio só aparecem no fim, como o prato pronto."
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
                        },
                        alternateExplanation: "De todos os produtos da fotossíntese, a glicose é o que a planta usa como 'combustível' imediato para crescer — é como o pão que sai do forno no final do processo."
                    }
                ]
            }
        },
        {
            id: "componentes-da-planta",
            title: "Componentes da planta",
            subtitle: "Quem participa?",
            icon: "🧩",
            accentColor: "#1f8a5b",
            xpReward: 40,
            completionMessage: "Etapa concluída! +40 XP. Já dominas as estruturas envolvidas na fotossíntese.",
            explorerTip: "As folhas são o principal local da fotossíntese — é lá que estão a maioria dos cloroplastos! 🍃",
            introGreeting: "Já sabemos que as plantas fabricam o seu alimento. Mas onde acontece essa transformação?",
            introCta: "Vamos descobrir",
            summarySteps: [
                { icon: "🍃", label: "Folha" },
                { icon: "🌬️", label: "Estomas" },
                { icon: "🟢", label: "Cloroplasto" },
                { icon: "🥞", label: "Tilacóides" },
                { icon: "💚", label: "Clorofila" }
            ],
            content: `
            <div class="section-content">
                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Já sabemos que as plantas fabricam o seu alimento. Mas onde acontece essa transformação?</strong></p>
                        <p style="text-align: center; margin-top: 18px;"></p>
                    </div>

                    <div class="screen-card plant-diagram-card">
                        <h3>Onde fica cada parte da planta?</h3>
                        <p class="plant-diagram-hint">Clica num ponto da imagem para veres a explicação.</p>
                        <div class="plant-diagram">
                            <img class="plant-diagram-image" src="/static/images/Planta-fotossíntese.png" alt="Planta com as suas partes">
                            <button type="button" class="plant-hotspot" data-hotspot="folhas" style="left: 65%; top: 25%;">
                                <span class="plant-hotspot-dot"></span>
                                <span class="plant-hotspot-label">Folhas</span>
                            </button>
                            <button type="button" class="plant-hotspot" data-hotspot="estomas" style="left: 32%; top: 48%;">
                                <span class="plant-hotspot-dot"></span>
                                <span class="plant-hotspot-label">Estomas</span>
                            </button>
                            <button type="button" class="plant-hotspot" data-hotspot="raizes" style="left: 50%; top: 85%;">
                                <span class="plant-hotspot-dot"></span>
                                <span class="plant-hotspot-label">Raízes</span>
                            </button>
                        </div>
                        <div class="plant-hotspot-panels" hidden>
                            <div class="plant-hotspot-panel" data-hotspot="folhas">
                                <h4>As folhas: o principal local da fotossíntese</h4>
                                <p>Embora toda a planta seja importante, é nas <strong>folhas</strong> que a maior parte da fotossíntese acontece.</p>
                                <p>As folhas possuem muitos cloroplastos, recebem luz solar e estão em contacto direto com o ar, facilitando a entrada de dióxido de carbono.</p>
                                <p>Algumas folhas conseguem “mover-se” para captar melhor a luz do Sol — esse movimento chama-se <strong>heliotropismo</strong>.</p>
                            </div>
                            <div class="plant-hotspot-panel" data-hotspot="estomas">
                                <h4>Os estomas: as “portas” da folha</h4>
                                <p>As plantas também precisam de captar dióxido de carbono do ar. Para isso existem pequenos poros nas folhas chamados <strong>estomas</strong>.</p>
                                <p>Os estomas permitem a entrada de dióxido de carbono e a saída do oxigénio produzido durante a fotossíntese. Além disso, regulam a perda de vapor de água para o ambiente.</p>
                                <p>🌵 Algumas plantas de ambientes secos, como os cactos, abrem os estomas principalmente durante a noite, para perder menos água.</p>
                            </div>
                            <div class="plant-hotspot-panel" data-hotspot="raizes">
                                <h4>As raízes: a origem da água</h4>
                                <p>A água utilizada na fotossíntese é absorvida pelas <strong>raízes</strong>. Depois de entrar na planta, a água é transportada através do caule até chegar às folhas, onde será utilizada na produção de glicose.</p>
                                <p>🌳 Algumas árvores ligam as suas raízes a fungos do solo, numa relação chamada <strong>micorriza</strong>: os fungos ajudam a planta a absorver água e minerais, e recebem açúcares em troca.</p>
                            </div>
                        </div>
                        <div class="plant-hotspot-explanation">
                            <p class="plant-hotspot-explanation-empty">👆 Clica num ponto da imagem para veres a explicação.</p>
                        </div>
                    </div>

                    <div class="screen-card plant-diagram-card">
                        <h3>O que há dentro do cloroplasto?</h3>
                        <p class="plant-diagram-hint">Clica numa estrutura do cloroplasto para veres a explicação.</p>
                        <div class="plant-diagram">
                            <img class="plant-diagram-image" src="/static/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Cloroplasto com destaque interno">
                            <button type="button" class="plant-hotspot" data-hotspot="cloroplasto" style="left: 15%; top: 25%;">
                                <span class="plant-hotspot-dot"></span>
                                <span class="plant-hotspot-label">Cloroplasto</span>
                            </button>
                            <button type="button" class="plant-hotspot" data-hotspot="tilacoides" style="left: 50%; top: 28%;">
                                <span class="plant-hotspot-dot"></span>
                                <span class="plant-hotspot-label">Tilacóides</span>
                            </button>
                            <button type="button" class="plant-hotspot" data-hotspot="clorofila" style="left: 78%; top: 50%;">
                                <span class="plant-hotspot-dot"></span>
                                <span class="plant-hotspot-label">Clorofila</span>
                            </button>
                            <button type="button" class="plant-hotspot" data-hotspot="estroma" style="left: 48%; top: 68%;">
                                <span class="plant-hotspot-dot"></span>
                                <span class="plant-hotspot-label">Estroma</span>
                            </button>
                        </div>
                        <div class="plant-hotspot-panels" hidden>
                            <div class="plant-hotspot-panel" data-hotspot="cloroplasto">
                                <h4>O cloroplasto: a “fábrica” da fotossíntese</h4>
                                <p>Para fabricar o seu alimento, a planta precisa de um local onde todas as reações da fotossíntese acontecem. Esse local chama-se <strong>cloroplasto</strong>.</p>
                                <p>O cloroplasto é um organelo presente nas células das plantas. É aqui que a energia da luz é captada e utilizada para transformar água e dióxido de carbono em glicose.</p>
                                <p>Os cloroplastos têm o seu próprio DNA — há milhões de anos eram bactérias independentes, incorporadas pelas células ancestrais das plantas.</p>
                            </div>
                            <div class="plant-hotspot-panel" data-hotspot="tilacoides">
                                <h4>Os tilacóides: os “painéis solares” da fotossíntese</h4>
                                <p>Dentro do cloroplasto existem pequenas estruturas em forma de discos empilhados chamadas <strong>tilacóides</strong>. É na sua membrana que se encontra a clorofila, o pigmento responsável por captar a energia da luz solar.</p>
                                <p>Um único cloroplasto pode conter dezenas de tilacóides empilhados, o que aumenta a superfície disponível para captar luz.</p>
                            </div>
                            <div class="plant-hotspot-panel" data-hotspot="clorofila">
                                <h4>A clorofila: o pigmento que capta a luz</h4>
                                <p>A <strong>clorofila</strong> é um pigmento verde presente nos tilacóides. A sua principal função é captar a energia da luz solar, fornecendo a energia necessária para a fotossíntese.</p>
                                <p>É também a clorofila que dá às plantas a sua cor verde característica.</p>
                            </div>
                            <div class="plant-hotspot-panel" data-hotspot="estroma">
                                <h4>O estroma: o “citosol” do cloroplasto</h4>
                                <p>À volta dos tilacóides encontra-se um líquido chamado <strong>estroma</strong>. É nesta região que a planta utiliza a energia captada pela luz para fabricar glicose.</p>
                                <p>Ao contrário dos tilacóides, que captam a energia da luz, o estroma utiliza essa energia para construir moléculas de glicose.</p>
                            </div>
                        </div>
                        <div class="plant-hotspot-explanation">
                            <p class="plant-hotspot-explanation-empty">👆 Clica numa estrutura do cloroplasto para veres a explicação.</p>
                        </div>
                    </div>
                </div>
            `,
            quiz: {
                questions: [
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
                        },
                        alternateExplanation: "Pensa no cloroplasto como a 'fábrica' dentro da célula vegetal: é lá dentro, e só lá, que existem as estruturas e os pigmentos necessários para captar luz e fabricar glicose."
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
                        },
                        alternateExplanation: "A clorofila funciona como um pequeno 'painel solar' verde dentro do cloroplasto — é ela que absorve a energia da luz e a entrega ao resto do processo."
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
                        },
                        alternateExplanation: "Imagina os estomas como pequenas 'portas' microscópicas na folha: abrem para deixar entrar o CO2 e sair o O2, e fecham para a planta não perder água em excesso."
                    },
                    {
                        question: "Onde, dentro do cloroplasto, se encontra a clorofila?",
                        options: [
                            { text: "Nos tilacóides", correct: true },
                            { text: "No estroma", correct: false },
                            { text: "No núcleo", correct: false }
                        ],
                        feedback: {
                            correct: "Isso mesmo! A clorofila está na membrana dos tilacóides.",
                            incorrect: "Revê: a clorofila encontra-se na membrana dos tilacóides."
                        },
                        alternateExplanation: "Os tilacóides são como pilhas de 'discos' dentro do cloroplasto, e é na sua membrana que a clorofila fica posicionada — bem exposta para captar a luz que entra na folha."
                    },
                    {
                        question: "De onde vem a água usada na fotossíntese?",
                        options: [
                            { text: "É absorvida pelas raízes e transportada até às folhas", correct: true },
                            { text: "É produzida pelo próprio cloroplasto", correct: false },
                            { text: "Vem do ar através dos estomas", correct: false }
                        ],
                        feedback: {
                            correct: "Exato! A água entra pelas raízes e viaja até às folhas.",
                            incorrect: "Revê: a água é absorvida pelas raízes, não pelo ar."
                        },
                        alternateExplanation: "Segue o percurso da água: entra pelas raízes, sobe pelo caule e só chega às folhas quando já está pronta para ser usada na fotossíntese — ao contrário do CO2, que entra diretamente pelos estomas."
                    }
                ]
            }
        },
        {
            id: "fase-clara",
            title: "Fase clara",
            subtitle: "Luz em ação",
            icon: "⚡",
            accentColor: "#e0a316",
            xpReward: 60,
            completionMessage: "Etapa concluída! +60 XP. Já entendes como a luz se converte em ATP e NADPH.",
            explorerTip: "A fase clara só acontece com luz — sem Sol, não há ATP nem NADPH! ☀️",
            summarySteps: [
                { icon: "☀️", label: "Luz do Sol" },
                { icon: "🍃", label: "Absorção da luz pelos pigmentos" },
                { icon: "💧", label: "Fotólise da água (H₂O)" },
                { icon: "🔋", label: "Produção de ATP e NADPH" },
                { icon: "💨", label: "Libertação de oxigénio (O₂)" }
            ],
            factOfTheDay: "Os cientistas só descobriram a existência de dois fotossistemas na década de 1960.",
            introIcon: "☀️",
            introHighlight: "A fase clara da fotossíntese ocorre nas <span class=\"key-term\">membranas dos tilacóides</span> dos cloroplastos e depende da <span class=\"key-term\">luz do Sol</span>. É nela que a energia luminosa é captada e transformada em energia química: <span class=\"key-term\">ATP e NADPH</span>.",
            content: `
                <div class="section-content">

                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Já sabemos onde acontece a fotossíntese. Mas como é que a luz do Sol é transformada em energia útil para a planta?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

 <div class="screen-card">
                        <h3>Como é que a luz inicia a fotossíntese?</h3>
                        <img class="screen-visual" src="/static/images/Membrana dos tilacoides.jpg" alt="Luz solar a atingir membrana verde">
                        <p><strong>Tudo começa quando a luz do Sol atinge a clorofila.</strong>
                        <p>A clorofila não trabalha sozinha. Ela encontra-se organizada em estruturas chamadas fotossistemas, responsáveis por captar a energia luminosa.

Existem dois fotossistemas: Fotossistema II e Fotossistema I. Ambos participam na fase clara, mas desempenham funções diferentes.</p>
                         <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Sabias que os cientistas só descobriram que existem dois fotossistemas na década de 1960. Até então, acreditava-se que toda a fotossíntese era realizada por um único sistema de captação de luz.</p>
                        </details>
</div>

                    <div class="screen-card">
                        <h3>A entrada da luz</h3>
                        <img class="screen-visual" src="/static/images/Membrana dos tilacoides.jpg" alt="Luz solar a atingir membrana verde">
                        <p>A luz atinge o fotossistema II e a clorofila absorve a energia da luz. Essa energia é suficiente para fazer com que alguns eletrões da clorofila fiquem energizados e sejam libertados.</p>
                        <p><strong>Mas surge um problema...</strong></p>
                        <p>Ao perder eletrões (oxidar), a clorofila do Fotossistema II precisa de os substituir para continuar a captar energia luminosa.</p>
                        </div>



                    <div class="screen-card">
                        <p><strong>De onde achas que vêm os eletrões que vão substituir os que a clorofila perdeu?</strong></p>
                        <div class="guide-options electron-loss-options">
                            <button type="button" class="guide-option electron-loss-option" data-correct="false">A) Do CO<sub>2</sub></button>
                            <button type="button" class="guide-option electron-loss-option" data-correct="true">B) Da água</button>
                            <button type="button" class="guide-option electron-loss-option" data-correct="false">C) Da glicose</button>
                        </div>
                        <div class="neutral-feedback electron-loss-feedback">
                            <p><strong>Explicação:</strong></p>
                            <blockquote>
                                Os eletrões que substituem os perdidos pela clorofila vêm da fotólise da água. Vamos descobrir como!
                            </blockquote>
                        </div>
                    </div>

                    <div class="screen-card">
                        <h3>Fotólise da água</h3>
                        <img class="card-visual" src="/static/images/Fotólise da água.jpg" alt="Divisao da agua em produtos">
                        <p>A fotólise da água é uma etapa da fase luminosa da fotossíntese que ocorre no fotossistema II (PSII), localizado na membrana dos tilacóides dos cloroplastos.</p>
                        <p>A energia luminosa permite a quebra das moléculas de água (H₂O) em eletrões (e⁻), protões (H⁺) e oxigénio (O₂).</p>
                        <ul>
                            <li>Os <strong>eletrões</strong> libertados vão substituir os eletrões perdidos pela clorofila do fotossistema II, permitindo a continuação da fotossíntese.</li>
                            <li>Os <strong>protões</strong> contribuem para a formação de um gradiente de concentração usado na produção de ATP.</li>
                            <li>O <strong>oxigénio</strong> é libertado para a atmosfera como um produto secundário.</li>
                        </ul>
                    </div>

<div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Agora que o Fotossistema II conseguiu repor os eletrões perdidos, é altura de acompanhar o percurso dos eletrões que saíram da clorofila.</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

                    <div class="screen-card">
                        <h3>Cadeia transportadora de eletrões</h3>
                        <img class="card-visual" src="/static/images/Cadeia transportadora de eletrões.png" alt="Cadeia transportadora de eletrões">
                        <p>A cadeia transportadora de eletrões é uma etapa da fase luminosa da fotossíntese que ocorre na membrana dos tilacóides dos cloroplastos. Esta etapa acontece após a excitação da clorofila no fotossistema II (PSII).</p>
                        <p>Quando a luz fornece energia à clorofila, os eletrões são libertados e transferidos para uma série de proteínas e moléculas transportadoras. À medida que os eletrões passam de uma molécula para outra ao longo da cadeia transportadora, libertam energia que é utilizada para transportar protões (H⁺) para o interior do tilacóide, criando um gradiente de concentração de protões.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Protões H⁺ e ATP</h3>
                        <img class="card-visual" src="/static/images/Fotólise da água.jpg" alt="Formacao de ATP e NADPH">
                        <p>O gradiente de protões (H⁺) permite a produção de ATP através da enzima ATP sintase, num processo chamado <strong>quimiosmose</strong>.</p>
                    </div>

<div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Mas será que os eletrões já terminaram o seu percurso?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

<div class="screen-card">
                        <h3>Síntese de NADPH</h3>
                        <img class="card-visual" src="/static/images/Fotólise da água.jpg" alt="Formacao de ATP e NADPH">
                        <p>Os eletrões continuam o seu percurso até chegarem ao fotossistema I (PSI), onde recebem novamente energia da luz e são transferidos para uma molécula recetora.</p>
                        <p>No final da cadeia transportadora, os eletrões são utilizados para reduzir o NADP⁺, formando NADPH, uma molécula que transporta energia química e que será utilizada na fase escura da fotossíntese (ciclo de Calvin).</p>
                    </div>

<div class="screen-card">
                        <h3>Exercício</h3>
                        <img class="screen-visual" src="/static/images/Membrana dos tilacoides.jpg" alt="Sequencia da fase clara">
                        <p>Seleciona os passos pela ordem correta para reconstruir a fase clara.</p>
                        <div class="phase-clear-sequence" aria-label="Exercicio de ordenar a fase clara">
                            <div class="sequence-options">
                                <button type="button" class="sequence-option" data-step="3">Cadeia de eletrões</button>
                                <button type="button" class="sequence-option" data-step="1">Luz na clorofila</button>
                                <button type="button" class="sequence-option" data-step="5">ATP/NADPH</button>
                                <button type="button" class="sequence-option" data-step="2">Fotolise</button>
                                <button type="button" class="sequence-option" data-step="4">Gradiente de H+</button>
                            </div>
                            <div class="sequence-current" aria-live="polite"></div>
                            <p class="sequence-feedback" aria-live="polite">Seleciona os elementos pela ordem correta.</p>
                            <div class="sequence-result" aria-hidden="true">
                                <div class="sequence-chain" aria-hidden="true">
                                    <span class="chain-node">1</span>
                                    <span class="chain-link"></span>
                                    <span class="chain-node">2</span>
                                    <span class="chain-link"></span>
                                    <span class="chain-node">3</span>
                                    <span class="chain-link"></span>
                                    <span class="chain-node">4</span>
                                    <span class="chain-link"></span>
                                    <span class="chain-node">5</span>
                                </div>
                                <span class="sequence-final">Luz na clorofila -> Fotolise -> Cadeia de eletrões -> Gradiente de H+ -> ATP/NADPH</span>
                            </div>
                            <button type="button" class="sequence-reset">Tentar novamente</button>
                        </div>
                    </div>

                </div>
            `,
            quiz: {
                questions: [
                    {
                        question: "Onde ocorre a fase clara da fotossíntese?",
                        options: [
                            { text: "No estroma", correct: false },
                            { text: "Nos tilacóides", correct: true },
                            { text: "No núcleo", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! A fase clara decorre nos tilacóides.",
                            incorrect: "Revê: esta fase acontece nos tilacóides."
                        },
                        alternateExplanation: "A fase clara precisa de luz, e é exatamente na membrana dos tilacóides — onde está a clorofila — que essa luz é captada e transformada em energia química."
                    },
                    {
                        question: "De onde vem o oxigénio libertado?",
                        options: [
                            { text: "Do CO2", correct: false },
                            { text: "Da água (fotólise)", correct: true },
                            { text: "Da glicose", correct: false }
                        ],
                        feedback: {
                            correct: "Exato. O O<sub>2</sub> vem da divisão da água.",
                            incorrect: "Pista: a origem do O2 é a fotólise da água."
                        },
                        alternateExplanation: "O oxigénio não vem do CO2, como se poderia pensar — vem da própria água, que é 'partida' (fotólise) para libertar eletrões, protões e, como subproduto, oxigénio."
                    },
                    {
                        question: "Qual é a função da cadeia transportadora de eletrões?",
                        options: [
                            { text: "Criar gradiente de H<sup>+</sup> para produzir ATP", correct: true },
                            { text: "Produzir glicose diretamente", correct: false },
                            { text: "Fixar CO<sub>2</sub>", correct: false }
                        ],
                        feedback: {
                            correct: "Isso mesmo! A cadeia prepara energia para a síntese de ATP.",
                            incorrect: "A cadeia serve para gerar gradiente de H+, não para produzir glicose direta."
                        },
                        alternateExplanation: "Pensa na cadeia transportadora como uma escada onde os eletrões vão descendo degrau a degrau, libertando energia em cada passo — essa energia é usada para empurrar protões (H+) para dentro do tilacóide, criando o gradiente que mais tarde produz ATP."
                    },
                    {
                        question: "O que impulsiona a ATP sintase?",
                        options: [
                            { text: "A luz diretamente", correct: false },
                            { text: "O gradiente de H<sup>+</sup>", correct: true },
                            { text: "O CO2", correct: false }
                        ],
                        feedback: {
                            correct: "Correto! O fluxo de H+ é o motor da ATP sintase.",
                            incorrect: "Pensa no gradiente de H+ como a força que move a enzima."
                        },
                        alternateExplanation: "A ATP sintase funciona como uma pequena turbina: é o fluxo de protões (H+) a sair do tilacóide através dela que faz a 'turbina' girar e produzir ATP — sem esse gradiente, não há produção de energia."
                    },
                    {
                        question: "Que moléculas energéticas resultam da fase clara?",
                        options: [
                            { text: "ATP e NADPH", correct: true },
                            { text: "Glicose e amido", correct: false },
                            { text: "RuBP e rubisco", correct: false }
                        ],
                        feedback: {
                            correct: "Perfeito. ATP e NADPH alimentam a fase escura.",
                            incorrect: "As moléculas energéticas desta fase são ATP e NADPH."
                        },
                        alternateExplanation: "No final da fase clara, a planta fica com duas moléculas 'carregadas' de energia — ATP e NADPH — que vão servir de combustível para a fase escura poder transformar CO2 em glicose."
                    }
                ]
            }
        },
        {
            id: "fase-escura",
            title: "Fase escura",
            subtitle: "Transformar para crescer",
            icon: "🌑",
            accentColor: "#8b5fbf",
            xpReward: 70,
            completionMessage: "Etapa concluída! +70 XP. Já consegues explicar como o CO2 vira glicose no ciclo de Calvin.",
            explorerTip: "O ciclo de Calvin usa a energia guardada na fase clara para fabricar glicose. ♻️",
            summarySteps: [
                { icon: "🌬️", label: "CO₂" },
                { icon: "🔗", label: "Fixação (RuBP + Rubisco)" },
                { icon: "⚡", label: "Redução (ATP/NADPH)" },
                { icon: "♻️", label: "Regeneração da RuBP" },
                { icon: "🍬", label: "Glicose" }
            ],
            factOfTheDay: "São precisas 6 voltas do ciclo de Calvin para produzir uma única molécula de glicose.",
            introIcon: "🌑",
            introHighlight: "A fase escura, ou <span class=\"key-term\">ciclo de Calvin</span>, usa o <span class=\"key-term\">ATP e NADPH</span> produzidos na fase clara para transformar <span class=\"key-term\">CO₂</span> em <span class=\"key-term\">glicose</span>, no estroma do cloroplasto.",
            content: `
                <div class="section-content">
                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>☀️ A luz já fez o seu trabalho! A planta tem ATP e NADPH nas mãos... mas ainda precisa de transformar o CO₂ em alimento. Como será que o faz?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

                <div class="screen-card">
                        <h3>O Ciclo de Calvin</h3>
                        <img class="screen-visual" src="/static/images/Membrana dos tilacoides.jpg" alt="ATP e NADPH a entrar no estroma">
                        <p><strong>É agora que começa a fase escura, também chamada Ciclo de Calvin!</strong></p>
                        <p>Nesta etapa, a planta utiliza a energia produzida na fase luminosa para captar dióxido de carbono (CO₂) e construir moléculas de açúcar — o alimento que irá sustentar o seu crescimento.</p>
                       <p> O Ciclo de Calvin divide-se em três etapas principais:

1. Fixação do carbono
2. Redução
3. Regeneração
                        </div>

<div class="screen-card">
                        <p><strong>🔍 Mas onde acontece este processo?</strong></p>
                        <div class="guide-options electron-loss-options">
                            <button type="button" class="guide-option electron-loss-option" data-correct="false">A) Nos tilacoides</button>
                            <button type="button" class="guide-option electron-loss-option" data-correct="false">B) Na raiz</button>
                            <button type="button" class="guide-option electron-loss-option" data-correct="true">C) No estroma</button>
                        </div>
                    </div>

                    <div class="screen-card">
                        <h3>A fase escura precisa de luz?</h3>
                        <img class="screen-visual" src="/static/images/Estoma.png" alt="CO2 a entrar pelo estoma">
                        <p>A fase escura precisa de luz direta, ou pode funcionar sem luz direta se houver ATP e NADPH?</p>
                        <div class="guide-options">
                            <button class="guide-option" data-choice="luz-direta" data-correct="false">Precisa de luz direta</button>
                            <button class="guide-option" data-choice="sem-luz-direta" data-correct="true">Não usa luz direta, usa ATP/NADPH</button>
                        </div>
                        <p class="neutral-feedback">Boa! Esta fase é chamada de independente da luz direta.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Onde ocorre</h3>
                        <img class="card-visual" src="/static/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Estroma no cloroplasto">
                        <p>O ciclo de Calvin ocorre no <strong>estroma</strong> do cloroplasto.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Fixação do carbono</h3>
                        <img class="card-visual" src="/static/images/Cloroplasto com destaque para os tilacoides.jpg" alt="CO2 ligado a RuBP">
                        <p>O CO2 fixa-se a <strong>RuBP</strong> com ajuda da <strong>rubisco</strong>.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Redução</h3>
                        <img class="card-visual" src="/static/images/Fotólise da água.jpg" alt="Reducao para formar G3P">
                        <p>ATP e NADPH fornecem energia e eletrões para formar <strong>G3P</strong>.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Regeneração</h3>
                        <img class="card-visual" src="/static/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Regeneracao da RuBP">
                        <p>Grande parte do G3P regenera RuBP; uma parte sai para produzir glicose.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Curiosidade</h3>
                        <img class="screen-visual" src="/static/images/Raízes 2.png" alt="Curiosidade sobre voltas do ciclo">
                        <p>São necessárias 6 voltas do ciclo para produzir uma molécula de glicose.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Isto acontece porque cada volta do ciclo só fixa um átomo de carbono de cada vez, e a glicose precisa de 6 átomos de carbono para se formar.</p>
                        </details>
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
                        },
                        alternateExplanation: "Enquanto a fase clara acontece na membrana dos tilacóides, o ciclo de Calvin acontece no líquido à volta deles — o estroma — que é onde estão disponíveis o CO2, o ATP e o NADPH necessários."
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
                        },
                        alternateExplanation: "A rubisco funciona como uma 'cola' molecular: agarra o CO2 que entrou pelos estomas e liga-o à RuBP, dando o primeiro passo para transformar carbono do ar em açúcar."
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
                        },
                        alternateExplanation: "Sem a energia e os eletrões trazidos pelo ATP e NADPH da fase clara, o carbono fixado não conseguiria ser transformado em G3P — por isso as duas fases estão sempre ligadas."
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
                        },
                        alternateExplanation: "O nome pode enganar: a fase escura não precisa de fotões de luz diretamente, mas só funciona se houver ATP e NADPH disponíveis — e estes só existem porque a fase clara os produziu momentos antes."
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
        },
        {
            id: "importancia",
            title: "Importância",
            subtitle: "Por que é tão importante?",
            icon: "🌍",
            accentColor: "#3b82f6",
            xpReward: 40,
            completionMessage: "Etapa concluída! +40 XP. Já sabes porque é que a fotossíntese é essencial para a vida na Terra.",
            explorerTip: "Sem fotossíntese, não haveria oxigénio suficiente para respirarmos! 💨",
            summarySteps: [
                { icon: "💨", label: "Oxigénio para a vida" },
                { icon: "🍽️", label: "Base das cadeias alimentares" },
                { icon: "🌍", label: "Regula o CO₂ e o clima" },
                { icon: "⛽", label: "Origem dos combustíveis fósseis" }
            ],
            factOfTheDay: "Grande parte do oxigénio que respiramos é produzido por microrganismos marinhos fotossintéticos, como o fitoplâncton.",
            introIcon: "🌍",
            introHighlight: "A fotossíntese sustenta a vida na Terra: produz o <span class=\"key-term\">oxigénio</span> que respiramos, é a base das <span class=\"key-term\">cadeias alimentares</span> e ajuda a regular o <span class=\"key-term\">clima</span> do planeta.",
            content: `
                <div class="section-content">
                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌍 Já sabemos como a fotossíntese acontece. Mas porque é que este processo é tão importante para a vida na Terra?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

                    <div class="screen-card">
                        <h3>Fonte de oxigénio para (quase) todos os seres vivos</h3>
                        <img class="card-visual" src="/static/images/Planta-fotossíntese.png" alt="Planta a libertar oxigénio">
                        <p>O oxigénio libertado durante a fotossíntese não é apenas um "resíduo" — é o gás que a maioria dos seres vivos, incluindo nós, precisa de respirar para produzir energia nas suas células.</p>
                        <p>Sem a fotossíntese, a atmosfera da Terra não teria oxigénio suficiente para sustentar a vida animal como a conhecemos.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Há cerca de 2,4 mil milhões de anos, cianobactérias fotossintéticas encheram a atmosfera da Terra de oxigénio pela primeira vez, num acontecimento conhecido como <strong>Grande Oxidação</strong>. Este evento mudou para sempre o rumo da vida no planeta.</p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <h3>A base de quase todas as cadeias alimentares</h3>
                        <img class="card-visual" src="/static/images/Folha.png" alt="Planta como produtora">
                        <p>As plantas, as algas e algumas bactérias são <strong>produtoras</strong>: usam a fotossíntese para transformar energia solar em energia química (glicose), que fica disponível para o resto do ecossistema.</p>
                        <p>Os herbívoros alimentam-se das plantas, os carnívoros alimentam-se dos herbívoros — e, em quase todos os casos, essa energia teve origem na fotossíntese.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Mesmo os organismos que vivem no fundo do oceano, longe da luz solar, muitas vezes dependem indiretamente de matéria orgânica que "chove" desde a superfície, onde a fotossíntese aconteceu.</p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <h3>Regulação do CO₂ atmosférico e do clima</h3>
                        <img class="card-visual" src="/static/images/Cloroplasto com destaque para os tilacoides.jpg" alt="Absorção de CO2">
                        <p>Ao absorverem dióxido de carbono (CO₂) da atmosfera para fazer a fotossíntese, as plantas ajudam a reduzir a quantidade deste gás com efeito de estufa, atenuando o aquecimento global.</p>
                        <p>Por isso, florestas como a Amazónia são muitas vezes chamadas de "pulmões verdes" do planeta.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>Os oceanos também têm o seu próprio "pulmão verde": o fitoplâncton, um conjunto de microrganismos fotossintéticos, é responsável por produzir uma parte muito significativa do oxigénio da Terra.</p>
                        </details>
                    </div>

                    <div class="screen-card">
                        <h3>A origem dos combustíveis fósseis</h3>
                        <img class="card-visual" src="/static/images/Raízes 2.png" alt="Restos de plantas antigas">
                        <p>O petróleo, o carvão e o gás natural formaram-se a partir de restos de plantas e outros seres vivos que fizeram fotossíntese há milhões de anos, e cuja energia solar ficou "armazenada" no subsolo.</p>
                        <p>Quando usamos estes combustíveis, estamos, na prática, a libertar energia solar captada há muito, muito tempo.</p>
                        <details class="did-you-know">
                            <summary>Saber mais...</summary>
                            <p>É também por isso que dizemos que os combustíveis fósseis não são renováveis: a fotossíntese que lhes deu origem demorou milhões de anos a acumular essa energia.</p>
                        </details>
                    </div>
                </div>
            `,
            quiz: {
                questions: [
                    {
                        question: "Qual é o principal gás libertado pela fotossíntese que sustenta a respiração dos seres vivos?",
                        options: [
                            { text: "Oxigénio", correct: true },
                            { text: "Dióxido de carbono", correct: false },
                            { text: "Azoto", correct: false }
                        ],
                        feedback: {
                            correct: "Exato! O oxigénio libertado sustenta a respiração de quase todos os seres vivos.",
                            incorrect: "Revê: o gás libertado que sustenta a respiração é o oxigénio."
                        },
                        alternateExplanation: "Sempre que respiras, estás a usar oxigénio que, direta ou indiretamente, foi produzido pela fotossíntese de plantas e algas — é por isso que este processo é essencial para quase toda a vida na Terra."
                    },
                    {
                        question: "Que papel têm as plantas nas cadeias alimentares?",
                        options: [
                            { text: "São produtoras, a base que fornece energia a todos os outros níveis", correct: true },
                            { text: "São consumidoras de outros seres vivos", correct: false },
                            { text: "Não têm qualquer papel nas cadeias alimentares", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! As plantas são produtoras, a base de quase todas as cadeias alimentares.",
                            incorrect: "Revê: as plantas são produtoras, não consumidoras."
                        },
                        alternateExplanation: "Pensa numa cadeia alimentar como uma pirâmide: as plantas estão na base, porque são elas que capturam a energia do Sol e a transformam em alimento que todos os outros níveis (herbívoros, carnívoros) acabam por aproveitar."
                    },
                    {
                        question: "Como é que a fotossíntese ajuda a regular o clima?",
                        options: [
                            { text: "Absorve CO2 da atmosfera", correct: true },
                            { text: "Liberta CO2 para a atmosfera", correct: false },
                            { text: "Não tem qualquer efeito no clima", correct: false }
                        ],
                        feedback: {
                            correct: "Isso mesmo! Ao absorver CO2, a fotossíntese ajuda a reduzir o efeito de estufa.",
                            incorrect: "Revê: a fotossíntese absorve CO2, não o liberta."
                        },
                        alternateExplanation: "O CO2 é um dos principais gases responsáveis pelo aquecimento global — cada vez que uma planta faz fotossíntese, está a retirar um pouco desse CO2 do ar, funcionando como um 'filtro' natural do planeta."
                    },
                    {
                        question: "Os combustíveis fósseis (petróleo, carvão) têm origem em quê?",
                        options: [
                            { text: "Energia solar captada pela fotossíntese há milhões de anos, armazenada em restos de seres vivos", correct: true },
                            { text: "Reações nucleares no interior da Terra", correct: false },
                            { text: "Erupções vulcânicas antigas", correct: false }
                        ],
                        feedback: {
                            correct: "Exato! Os combustíveis fósseis guardam energia solar captada há milhões de anos.",
                            incorrect: "Revê: os combustíveis fósseis vêm de restos de seres vivos que fizeram fotossíntese há milhões de anos."
                        },
                        alternateExplanation: "Quando queimamos petróleo ou carvão, estamos na verdade a libertar energia solar que plantas e outros organismos captaram através da fotossíntese há milhões de anos, e que ficou 'guardada' no subsolo desde então."
                    }
                ]
            }
        },
        {
            id: "desafio-final",
            title: "Desafio final",
            subtitle: "Testa o que aprendeste!",
            icon: "🏆",
            accentColor: "#f97316",
            xpReward: 50,
            isFinalQuiz: true,
            completionMessage: "Missão completa! +50 XP. Dominaste a fotossíntese do início ao fim!",
            explorerTip: "Rever o resumo de cada etapa antes do desafio final ajuda a fixar tudo! 🏆",
            introIcon: "🏆",
            introHighlight: "Chegou a hora de testares tudo o que aprendeste sobre a <span class=\"key-term\">fotossíntese</span> — da definição à importância para a vida na Terra.",
            content: `
                <div class="section-content">
                    <div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🏆 Já exploramos toda a missão da Fotossíntese! Está na altura de testar tudo o que aprendeste.</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
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
                        },
                        alternateExplanation: "Lembra-te: a planta usa a luz do Sol como energia para combinar água e CO2 e fabricar glicose, libertando oxigénio como subproduto."
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
                        },
                        alternateExplanation: "É dentro do cloroplasto que estão a clorofila, os tilacóides e o estroma — tudo o que é preciso para a fotossíntese acontecer."
                    },
                    {
                        question: "Qual é a ordem correta entre a fase clara e a fase escura?",
                        options: [
                            { text: "A fase clara acontece primeiro e fornece ATP/NADPH à fase escura", correct: true },
                            { text: "A fase escura acontece primeiro e fornece glicose à fase clara", correct: false },
                            { text: "As duas fases acontecem sempre ao mesmo tempo e são independentes uma da outra", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! A fase clara produz ATP e NADPH, que a fase escura depois utiliza.",
                            incorrect: "Revê: a fase clara vem primeiro e alimenta a fase escura com ATP e NADPH."
                        },
                        alternateExplanation: "Pensa nas duas fases como uma equipa: a fase clara 'carrega as baterias' (ATP e NADPH) usando a luz do Sol, e só depois a fase escura usa essas baterias para transformar CO2 em glicose."
                    },
                    {
                        question: "De onde vem o oxigénio libertado na fotossíntese?",
                        options: [
                            { text: "Do CO2", correct: false },
                            { text: "Da água (fotólise)", correct: true },
                            { text: "Da glicose", correct: false }
                        ],
                        feedback: {
                            correct: "Exato. O O<sub>2</sub> vem da divisão da água.",
                            incorrect: "Pista: a origem do O2 é a fotólise da água."
                        },
                        alternateExplanation: "Na fase clara, a água é 'partida' (fotólise) para repor os eletrões perdidos pela clorofila — e o oxigénio é libertado como subproduto dessa quebra."
                    },
                    {
                        question: "Onde ocorre o ciclo de Calvin (fase escura)?",
                        options: [
                            { text: "Nos tilacoides", correct: false },
                            { text: "No estroma", correct: true },
                            { text: "No núcleo", correct: false }
                        ],
                        feedback: {
                            correct: "Certo! O ciclo de Calvin ocorre no estroma.",
                            incorrect: "Revê: a fase escura ocorre no estroma."
                        },
                        alternateExplanation: "Enquanto a fase clara usa a membrana dos tilacóides, o ciclo de Calvin acontece no estroma, o líquido à volta deles."
                    },
                    {
                        question: "Qual é a principal importância da fotossíntese para a vida na Terra?",
                        options: [
                            { text: "Produz oxigénio e é a base da maioria das cadeias alimentares", correct: true },
                            { text: "Consome todo o oxigénio da atmosfera", correct: false },
                            { text: "Não tem qualquer papel relevante fora das plantas", correct: false }
                        ],
                        feedback: {
                            correct: "Muito bem! É esse duplo papel que torna a fotossíntese essencial à vida.",
                            incorrect: "Revê: a fotossíntese produz oxigénio e sustenta quase todas as cadeias alimentares."
                        },
                        alternateExplanation: "Sem fotossíntese, não haveria oxigénio suficiente para a maioria dos seres vivos respirar, nem energia disponível para sustentar herbívoros e carnívoros — é por isso que este processo é tão importante."
                    }
                ]
            }
        }
    ]
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = missionData;
}
