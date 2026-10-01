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

    // Separador "10º ano" / "11º ano" — só a Física tem missões dos dois
    // anos por agora, por isso o separador só aparece para essa disciplina
    // (ver anoSwitcher, escondido por padrão no template).
    const anoSwitcher = document.getElementById('anoSwitcher');
    const anoOpcoes = anoSwitcher ? anoSwitcher.querySelectorAll('.ano-switcher-option') : [];
    let anoAtual = '10';

    function aplicarFiltroAno() {
        categorias.forEach((categoria) => {
            if (categoria.dataset.subject !== 'physics' || !categoria.dataset.ano) return;
            categoria.hidden = categoria.dataset.ano !== anoAtual;
        });
    }

    function selecionarDisciplina(disciplina) {
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
        if (anoSwitcher) {
            const temAnos = Array.from(categorias).some((c) => c.dataset.subject === disciplina && c.dataset.ano);
            anoSwitcher.hidden = !temAnos;
        }
    }

    opcoes.forEach((opcao) => {
        opcao.addEventListener('click', () => {
            selecionarDisciplina(opcao.dataset.subject);
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

    // Estado inicial: filtra logo ao carregar a página pela disciplina
    // já marcada como ativa no menu (ver .is-active no HTML), em vez de
    // depender de cada categoria já vir com o atributo "hidden" certo do
    // servidor — necessário em páginas como Testes, onde as categorias são
    // geradas todas pelo mesmo loop genérico, sem "hidden" por disciplina.
    const disciplinaInicial = menu.querySelector('.subject-switcher-option.is-active')?.dataset.subject;
    if (disciplinaInicial) selecionarDisciplina(disciplinaInicial);
})();
