(function () {
    const btn = document.getElementById('subjectSwitcherBtn');
    const menu = document.getElementById('subjectSwitcherMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        menu.hidden = isOpen;
    });

    document.addEventListener('click', (event) => {
        if (!menu.hidden && !menu.contains(event.target) && !btn.contains(event.target)) {
            menu.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        }
    });

    // Mostra só as categorias da disciplina escolhida (ver data-subject em
    // cada .missions-category, Templates/index-missions.html) — as
    // disciplinas "Em breve" continuam sem opção clicável (disabled),
    // então não precisam de entrar aqui.
    const categorias = document.querySelectorAll('.missions-category[data-subject]');
    const opcoes = menu.querySelectorAll('.subject-switcher-option:not([disabled])');
    const trigger = btn.querySelector('span');

    // Separador de ano ("10º ano" / "11º ano" / ...) — só aparece nas
    // disciplinas cujas categorias têm data-ano (ver anoSwitcher, escondido
    // por padrão no template).
    const anoSwitcher = document.getElementById('anoSwitcher');
    const anoOpcoes = anoSwitcher ? anoSwitcher.querySelectorAll('.ano-switcher-option') : [];
    let anoAtual = '10';

    // Frase "Escolhe uma missão e começa a tua aventura na Biologia." — só
    // existe em Templates/index-missions.html (ver #missionsPageIntro);
    // nas outras páginas com subject-switcher este elemento não existe, daí
    // o guard abaixo em vez de assumir que está sempre presente.
    const introParagrafo = document.getElementById('missionsPageIntro');
    const NOME_DISCIPLINA = { biology: 'Biologia', chemistry: 'Química', physics: 'Física', geology: 'Geologia' };

    let disciplinaAtual = null;

    function aplicarFiltroAno() {
        categorias.forEach((categoria) => {
            if (categoria.dataset.subject !== disciplinaAtual || !categoria.dataset.ano) return;
            categoria.hidden = categoria.dataset.ano !== anoAtual;
        });
    }

    // Só mostra os anos que a disciplina tem de facto (ex: Química só tem
    // 10º ano) e, se o ano ativo não existir nela, passa para o primeiro
    // que existir.
    function atualizarAnosDisponiveis(disciplina) {
        const anosDisponiveis = new Set(
            Array.from(categorias)
                .filter((c) => c.dataset.subject === disciplina && c.dataset.ano)
                .map((c) => c.dataset.ano)
        );
        anoOpcoes.forEach((opcao) => {
            opcao.hidden = !anosDisponiveis.has(opcao.dataset.ano);
        });
        if (anosDisponiveis.size && !anosDisponiveis.has(anoAtual)) {
            const primeiro = Array.from(anoOpcoes).find((o) => anosDisponiveis.has(o.dataset.ano));
            if (primeiro) anoAtual = primeiro.dataset.ano;
        }
        anoOpcoes.forEach((o) => o.classList.toggle('is-active', o.dataset.ano === anoAtual));
        return anosDisponiveis.size > 0;
    }

    function selecionarDisciplina(disciplina) {
        disciplinaAtual = disciplina;
        const temAnos = anoSwitcher ? atualizarAnosDisponiveis(disciplina) : false;
        categorias.forEach((categoria) => {
            if (categoria.dataset.subject !== disciplina) {
                categoria.hidden = true;
                return;
            }
            categoria.hidden = categoria.dataset.ano ? categoria.dataset.ano !== anoAtual : false;
        });
        opcoes.forEach((opcao) => {
            opcao.classList.toggle('is-active', opcao.dataset.subject === disciplina);
        });
        if (trigger) trigger.textContent = `Explore ${disciplina.charAt(0).toUpperCase()}${disciplina.slice(1)}`;
        if (introParagrafo && NOME_DISCIPLINA[disciplina]) {
            introParagrafo.textContent = `Escolhe uma missão e começa a tua aventura na ${NOME_DISCIPLINA[disciplina]}.`;
        }
        if (anoSwitcher) anoSwitcher.hidden = !temAnos;
    }

    // Guarda a disciplina escolhida (localStorage, partilhado entre
    // páginas) para não voltar sempre a Explore Biology ao recarregar —
    // ver disciplinaInicial mais abaixo. try/catch por causa de navegação
    // privada/quota, tal como noutros usos de localStorage no projeto.
    const CHAVE_DISCIPLINA = 'explore_disciplina_switcher';
    function guardarDisciplina(disciplina) {
        try {
            localStorage.setItem(CHAVE_DISCIPLINA, disciplina);
        } catch (erro) {
            // Ignora erros de storage (navegação privada/quota).
        }
    }
    function disciplinaGuardada() {
        try {
            return localStorage.getItem(CHAVE_DISCIPLINA);
        } catch (erro) {
            return null;
        }
    }

    opcoes.forEach((opcao) => {
        opcao.addEventListener('click', () => {
            selecionarDisciplina(opcao.dataset.subject);
            guardarDisciplina(opcao.dataset.subject);
            menu.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        });
    });

    anoOpcoes.forEach((opcao) => {
        opcao.addEventListener('click', () => {
            anoAtual = opcao.dataset.ano;
            anoOpcoes.forEach((o) => o.classList.toggle('is-active', o === opcao));
            aplicarFiltroAno();
        });
    });

    // Estado inicial: usa a disciplina guardada da última escolha do
    // aluno (ver guardarDisciplina), se ainda existir como opção não
    // desativada nesta página — senão cai na disciplina já marcada como
    // ativa no menu (ver .is-active no HTML), em vez de depender de cada
    // categoria já vir com o atributo "hidden" certo do servidor —
    // necessário em páginas como Testes, onde as categorias são geradas
    // todas pelo mesmo loop genérico, sem "hidden" por disciplina.
    const guardada = disciplinaGuardada();
    const guardadaValida = guardada && Array.from(opcoes).some((opcao) => opcao.dataset.subject === guardada);
    const disciplinaInicial = guardadaValida
        ? guardada
        : menu.querySelector('.subject-switcher-option.is-active')?.dataset.subject;
    if (disciplinaInicial) selecionarDisciplina(disciplinaInicial);
})();
