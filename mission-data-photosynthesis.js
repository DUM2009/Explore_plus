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
                        <h3>Como é que a luz inicia a fotossíntese?</h3>
                        <img class="screen-visual" src="assets/images/Membrana dos tilacoides.jpg" alt="Luz solar a atingir membrana verde">
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
                        <img class="screen-visual" src="assets/images/Membrana dos tilacoides.jpg" alt="Luz solar a atingir membrana verde">
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
                        <img class="card-visual" src="assets/images/Fotólise da água.jpg" alt="Divisao da agua em produtos">
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
                        <img class="card-visual" src="assets/images/photosynthesis/m1-card-chain.svg" alt="Cadeia transportadora de eletrões">
                        <p>A cadeia transportadora de eletrões é uma etapa da fase luminosa da fotossíntese que ocorre na membrana dos tilacóides dos cloroplastos. Esta etapa acontece após a excitação da clorofila no fotossistema II (PSII).</p>
                        <p>Quando a luz fornece energia à clorofila, os eletrões são libertados e transferidos para uma série de proteínas e moléculas transportadoras. À medida que os eletrões passam de uma molécula para outra ao longo da cadeia transportadora, libertam energia que é utilizada para transportar protões (H⁺) para o interior do tilacóide, criando um gradiente de concentração de protões.</p>
                    </div>

                    <div class="screen-card">
                        <h3>Protões H⁺ e ATP</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m1-card-atp.svg" alt="Formacao de ATP e NADPH">
                        <p>O gradiente de protões (H⁺) permite a produção de ATP através da enzima ATP sintase, num processo chamado <strong>quimiosmose</strong>.</p>
                    </div>

<div class="screen-card">
                        <p style="text-align: center; font-size: 1.2em;"><strong>🌱 Mas será que os eletrões já terminaram o seu percurso?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>

<div class="screen-card">
                        <h3>Síntese de NADPH</h3>
                        <img class="card-visual" src="assets/images/photosynthesis/m1-card-atp.svg" alt="Formacao de ATP e NADPH">
                        <p>Os eletrões continuam o seu percurso até chegarem ao fotossistema I (PSI), onde recebem novamente energia da luz e são transferidos para uma molécula recetora.</p>
                        <p>No final da cadeia transportadora, os eletrões são utilizados para reduzir o NADP⁺, formando NADPH, uma molécula que transporta energia química e que será utilizada na fase escura da fotossíntese (ciclo de Calvin).</p>
                    </div>

<div class="screen-card">
                        <h3>Exercício</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m1-mini.svg" alt="Sequencia da fase clara">
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
                        }
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
                        }
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
                        }
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
                        }
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
                        <p style="text-align: center; font-size: 1.2em;"><strong>☀️ A luz já fez o seu trabalho! A planta tem ATP e NADPH nas mãos... mas ainda precisa de transformar o CO₂ em alimento. Como será que o faz?</strong></p>
                        <p style="text-align: center; margin-top: 18px;">
                        </p>
                    </div>
                
                <div class="screen-card">
                        <h3>Ecra 1 - Gancho</h3>
                        <img class="screen-visual" src="assets/images/photosynthesis/m2-hook.svg" alt="ATP e NADPH a entrar no estroma">
                        <p><strong>É agora que começa a fase escura, também chamada Ciclo de Calvin!</strong></p>
                        <p>Nesta etapa, a planta utiliza a energia produzida na fase luminosa para captar dióxido de carbono (CO₂) e construir moléculas de açúcar — o alimento que irá sustentar o seu crescimento.</p>
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
