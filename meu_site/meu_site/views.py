import json
import re
import unicodedata
import anthropic
import stripe
from django.conf import settings
from django.http import JsonResponse, Http404, HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from django.db import OperationalError
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from .models import PerfilAluno, InqueritoAluno, obter_limite_chat, titulo_para_nivel


def redirecionar_apos_autenticacao(user):
    return redirect('perfil')


def pagina_inicial(request):
    return render(request, 'index.html')

@login_required(login_url='login')
def pagina_mission(request):
    return render(request, 'mission.html')


@login_required(login_url='login')
def pagina_perfil(request):
    perfil_legacy = False
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        # Permite o acesso durante a atualização de uma base criada antes dos campos de progresso.
        perfil = PerfilAluno.objects.only('id', 'user', 'pontos_xp', 'nivel', 'titulo_atual').get(user=request.user)
        perfil_legacy = True
    progresso = {} if perfil_legacy else (perfil.progresso_missoes or {})
    percentagens = [int(progresso.get(missao, 0)) for missao in ('photosynthesis', 'mitosis', 'meiosis')]
    badges = {} if perfil_legacy else (perfil.conquistas or {})
    secoes = {} if perfil_legacy else (perfil.progresso_secoes or {})

    (_, titulo_nome, titulo_icone, titulo_descricao), proximo_titulo = titulo_para_nivel(perfil.nivel)
    if not perfil_legacy and perfil.titulo_atual != titulo_nome:
        perfil.titulo_atual = titulo_nome
        perfil.save(update_fields=['titulo_atual'])

    def cor_subtopico(pontuacao):
        if pontuacao is None:
            return 'gray'
        if pontuacao >= 70:
            return 'green'
        if pontuacao >= 40:
            return 'yellow'
        return 'red'

    definicoes_missoes = [
        {
            'id': 'photosynthesis',
            'titulo': 'Fotossíntese',
            'capitulo': 'Capítulo 1 · Biologia',
            'categoria': 'Biologia',
            'icone': '🌿',
            'descricao': 'Continua a descobrir como as plantas transformam luz em energia.',
            'url': 'mission-photosynthesis',
            'subtopicos': [('fase-clara', 'Fase clara'), ('fase-escura', 'Fase escura')],
        },
        {
            'id': 'mitosis',
            'titulo': 'Mitose',
            'capitulo': 'Capítulo 2 · Biologia',
            'categoria': 'Biologia',
            'icone': '🧫',
            'descricao': 'Em breve: como uma célula se divide em duas células idênticas.',
            'url': None,
            'subtopicos': [('fases-mitose', 'Fases da mitose'), ('citocinese', 'Citocinese')],
        },
        {
            'id': 'meiosis',
            'titulo': 'Meiose',
            'capitulo': 'Capítulo 3 · Biologia',
            'categoria': 'Biologia',
            'icone': '🧬',
            'descricao': 'Em breve: como se formam as células sexuais.',
            'url': None,
            'subtopicos': [('meiose-1', 'Meiose I'), ('meiose-2', 'Meiose II')],
        },
    ]

    missoes = []
    missoes_bloqueadas = False
    for definicao in definicoes_missoes:
        if not definicao['url']:
            missoes_bloqueadas = True
            continue
        secoes_missao = secoes.get(definicao['id'], {}) or {}
        subtopicos = [
            {'label': label, 'cor': cor_subtopico(secoes_missao.get(secao_id))}
            for secao_id, label in definicao['subtopicos']
        ]
        missoes.append({
            'id': definicao['id'],
            'titulo': definicao['titulo'],
            'capitulo': definicao['capitulo'],
            'categoria': definicao['categoria'],
            'icone': definicao['icone'],
            'descricao': definicao['descricao'],
            'url': definicao['url'],
            'percent': int(progresso.get(definicao['id'], 0)),
            'subtopicos': subtopicos,
        })

    definicoes_conquistas = [
        {'id': 'primeira-missao', 'nome': 'Primeiros Passos', 'icone': '🌱', 'descricao': 'Conclui a tua primeira missão.'},
        {'id': 'fotossintese-mestre', 'nome': 'Mestre da Fotossíntese', 'icone': '🌿', 'descricao': 'Termina o capítulo da Fotossíntese a 100%.'},
        {'id': 'sequencia-3-dias', 'nome': 'Em Chamas', 'icone': '🔥', 'descricao': 'Estuda 3 dias seguidos.'},
        {'id': 'sequencia-7-dias', 'nome': 'Semana Perfeita', 'icone': '⭐', 'descricao': 'Estuda 7 dias seguidos.'},
        {'id': 'nivel-5', 'nome': 'Explorador Veterano', 'icone': '🏅', 'descricao': 'Atinge o nível 5.'},
        {'id': 'primeiro-teste-ouro', 'nome': 'Emblema de Ouro', 'icone': '🥇', 'descricao': 'Consegue emblema de ouro num teste final.'},
    ]
    conquistas_lista = [
        {**definicao, 'desbloqueada': bool(badges.get(definicao['id']))}
        for definicao in definicoes_conquistas
    ]

    return render(request, 'perfil.html', {
        'perfil': perfil,
        'nivel': perfil.nivel,
        'xp': perfil.pontos_xp,
        'xp_progress_percent': perfil.pontos_xp % 100,
        'proximo_nivel_xp': perfil.nivel * 100,
        'xp_restante': (perfil.nivel * 100) - perfil.pontos_xp,
        'proximo_nivel': perfil.nivel + 1,
        'progresso_missoes': progresso,
        'progresso_medio': round(sum(percentagens) / len(percentagens)),
        'missoes_completas': sum(1 for percentagem in percentagens if percentagem >= 100),
        'conquistas': badges,
        'conquistas_lista': conquistas_lista,
        'total_conquistas': sum(1 for desbloqueada in badges.values() if desbloqueada),
        'missoes': missoes,
        'missoes_bloqueadas': missoes_bloqueadas,
        'titulo_nome': titulo_nome,
        'titulo_icone': titulo_icone,
        'titulo_descricao': titulo_descricao,
        'proximo_titulo': proximo_titulo,
    })


def pagina_login(request):
    # Se o utilizador já estiver autenticado, vai direto para o perfil
    if request.user.is_authenticated:
        return redirecionar_apos_autenticacao(request.user)

    erro = None

    if request.method == 'POST':
        campo_input = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        if campo_input and password:
            username = campo_input

            # Se digitou um e-mail, procura o username associado
            if '@' in campo_input:
                user_obj = User.objects.filter(email=campo_input).first()
                if user_obj:
                    username = user_obj.username

            # Autenticação no Django
            user = authenticate(request, username=username, password=password)

            if user is not None:
                login(request, user)
                return redirecionar_apos_autenticacao(user)
            else:
                erro = "E-mail/Utilizador ou palavra-passe incorretos!"
        else:
            erro = "Preencha todos os campos!"

    return render(request, 'login.html', {'erro': erro})


def pagina_signup(request):
    if request.user.is_authenticated:
        return redirecionar_apos_autenticacao(request.user)

    erro = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirmarPassword', '')

        if not username or not email or not password:
            erro = 'Preencha todos os campos.'
        elif password != confirm_password:
            erro = 'As palavras-passe não coincidem.'
        elif User.objects.filter(username=username).exists():
            erro = 'Esse nome de utilizador já existe.'
        elif User.objects.filter(email=email).exists():
            erro = 'Esse email já está registado.'
        else:
            user = User.objects.create_user(username=username, email=email, password=password)
            login(request, user)
            return redirecionar_apos_autenticacao(user)

    return render(request, 'signup.html', {'erro': erro})


def pagina_logout(request):
    logout(request)
    return redirect('login')


DISCIPLINAS_INQUERITO = [
    ('biologia', 'Biologia'),
    ('quimica', 'Química'),
    ('fisica', 'Física'),
    ('geologia', 'Geologia'),
    ('matematica', 'Matemática'),
]


@login_required(login_url='login')
def pagina_onboarding(request):
    inquerito, _ = InqueritoAluno.objects.get_or_create(user=request.user)

    if inquerito.concluido:
        return redirect('perfil')

    erro = None
    if request.method == 'POST':
        ano_escolar = request.POST.get('ano_escolar', '').strip()
        curso_pretendido = request.POST.get('curso_pretendido', '').strip()

        if ano_escolar not in dict(InqueritoAluno.ANOS_ESCOLARES):
            erro = 'Escolhe o teu ano escolar.'
        else:
            niveis = {}
            for disciplina, _rotulo in DISCIPLINAS_INQUERITO:
                if request.POST.get(f'{disciplina}_nao_tem') == 'on':
                    niveis[disciplina] = None
                    continue

                valor = request.POST.get(f'nivel_{disciplina}', '').strip()
                if not valor.isdigit() or not (0 <= int(valor) <= 10):
                    erro = 'Escolhe um nível de 0 a 10 (ou marca "Não tenho esta disciplina") para cada disciplina.'
                    break
                niveis[disciplina] = int(valor)

            if not erro:
                inquerito.ano_escolar = ano_escolar
                inquerito.curso_pretendido = curso_pretendido
                inquerito.niveis_disciplinas = niveis
                inquerito.concluido = True
                inquerito.save()
                return redirect('perfil')

    return render(request, 'onboarding.html', {
        'erro': erro,
        'anos_escolares': InqueritoAluno.ANOS_ESCOLARES,
        'disciplinas': DISCIPLINAS_INQUERITO,
        'niveis_range': list(range(11)),
    })


@login_required(login_url='login')
def pagina_index_missions(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    missoes_lancadas = set()
    try:
        caminho_lancamento = settings.BASE_DIR.parent / 'missoes' / 'lancamento.json'
        with open(caminho_lancamento, encoding='utf-8') as ficheiro:
            configuracao_lancamento = json.load(ficheiro)
        missoes_lancadas = {
            chave for chave, visivel in configuracao_lancamento.items()
            if visivel is True
        }
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    return render(request, 'index-missions.html', {
        'perfil': perfil,
        'missoes_lancadas': missoes_lancadas,
    })


@login_required(login_url='login')
def pagina_lesson(request):
    return render(request, 'lesson.html')


def pagina_dashboard(request):
    return render(request, 'dashboard.html')


@login_required(login_url='login')
def pagina_mission_photosynthesis(request):
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    return render(request, 'mission-photosynthesis.html', {'perfil': perfil})


@login_required(login_url='login')
def pagina_mission_photosynthesis_goldtest(request):
    return render(request, 'mission-photosynthesis-goldtest.html')


@login_required(login_url='login')
def pagina_missao(request, missao_id):
    """
    Serve qualquer missão do motor genérico (ver static/missao-engine.js):
    basta existir um missoes/<missao_id>.json neste formato para a missão
    ficar disponível aqui, sem código novo por missão.
    """
    caminho_json = settings.BASE_DIR.parent / 'missoes' / f'{missao_id}.json'
    try:
        with open(caminho_json, 'r', encoding='utf-8') as f:
            missao = json.load(f)
    except FileNotFoundError:
        raise Http404('Missão não encontrada.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    return render(request, 'missao.html', {'missao': missao, 'missao_json': missao, 'perfil': perfil})


@login_required(login_url='login')
@require_POST
def salvar_progresso_missao(request):
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    mission_id = str(dados.get('missionId', '')).strip()
    progress = dados.get('progress')
    if not mission_id or not isinstance(progress, dict):
        return JsonResponse({'erro': 'Missão ou progresso ausente.'}, status=400)

    total_sections = max(0, int(progress.get('totalSections') or 0))
    completed_sections = progress.get('completedSections')
    completed_count = len(completed_sections) if isinstance(completed_sections, list) else 0
    percentage = round(min(completed_count / total_sections, 1) * 100) if total_sections else 0

    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    progresso = dict(perfil.progresso_missoes or {})
    if mission_id != 'profile':
        progresso[mission_id] = percentage
    perfil.progresso_missoes = progresso
    update_fields = ['progresso_missoes']

    section_scores = progress.get('sectionScores')
    if isinstance(section_scores, dict) and mission_id != 'profile':
        secoes = dict(perfil.progresso_secoes or {})
        secoes[mission_id] = {
            str(secao_id): int(score)
            for secao_id, score in section_scores.items()
            if isinstance(score, (int, float))
        }
        perfil.progresso_secoes = secoes
        update_fields.append('progresso_secoes')

    xp = dados.get('xp')
    if isinstance(xp, (int, float)) and xp >= 0:
        perfil.pontos_xp = max(perfil.pontos_xp, int(xp))
        perfil.nivel = perfil.pontos_xp // 100 + 1
        update_fields.extend(['pontos_xp', 'nivel'])

    perfil.save(update_fields=update_fields)

    return JsonResponse({
        'ok': True,
        'missionId': mission_id,
        'percent': percentage,
        'xp': perfil.pontos_xp,
        'level': perfil.nivel,
    })


@login_required(login_url='login')
@require_POST
def registar_pergunta_errada(request):
    """
    Mantém o banco de perguntas erradas do aluno (PerfilAluno.perguntas_erradas)
    atualizado a cada resposta de quiz — chamado tanto para respostas certas
    (para "curar" uma pergunta já lá guardada) como erradas (para a
    adicionar/atualizar). Pensado para uma futura funcionalidade de
    "simulação" da IA voltar a questionar o aluno sobre o que já errou.
    """
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    mission_id = str(dados.get('missionId', '')).strip()
    section_id = str(dados.get('sectionId', '')).strip()
    question_index = dados.get('questionIndex')
    pergunta_texto = str(dados.get('question', '')).strip()
    is_correct = dados.get('isCorrect')

    if not mission_id or not section_id or not isinstance(question_index, int) or not isinstance(is_correct, bool):
        return JsonResponse({'erro': 'Dados da pergunta em falta.'}, status=400)

    chave = f"{mission_id}:{section_id}:{question_index}"

    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    banco = dict(perfil.perguntas_erradas or {})

    if is_correct:
        # Acertou desta vez — sai do banco de perguntas erradas.
        banco.pop(chave, None)
    else:
        existente = banco.get(chave) or {}
        banco[chave] = {
            'missionId': mission_id,
            'sectionId': section_id,
            'questionIndex': question_index,
            'pergunta': pergunta_texto or existente.get('pergunta', ''),
            'vezesErrada': int(existente.get('vezesErrada', 0)) + 1,
            'ultimaVez': timezone.now().isoformat(),
        }

    perfil.perguntas_erradas = banco
    perfil.save(update_fields=['perguntas_erradas'])

    return JsonResponse({'ok': True})


@login_required(login_url='login')
@require_POST
def mascote_chat(request):
    """
    Proxies a chat message to Claude so the mascot can answer questions
    grounded in the mission's own content. The API key lives only here
    (server-side, read from the untracked .env file) — it never reaches
    the browser.
    """
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    user_message = str(dados.get('message', '')).strip()
    if not user_message:
        return JsonResponse({'erro': 'Mensagem vazia.'}, status=400)
    if len(user_message) > 1000:
        return JsonResponse({'erro': 'Mensagem demasiado longa.'}, status=400)

    # O limite semanal é verificado antes de chamar a Claude — mesmo sem
    # chave da API configurada, o aluno não deve poder "gastar" perguntas à
    # borla, e assim dá para testar o limite independentemente da IA estar
    # ligada. Só pedidos com uma mensagem válida chegam a consumir quota.
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    if not perfil.verificar_e_incrementar_uso_chat():
        limite = obter_limite_chat(perfil.plano)
        return JsonResponse({
            'erro': f'Atingiste o limite de {limite} perguntas ao Kim esta semana. Volta na próxima semana ou passa para o plano Pro para teres mais perguntas.',
            'limiteAtingido': True,
        }, status=429)

    if not settings.ANTHROPIC_API_KEY:
        return JsonResponse({'erro': 'O chat da mascote ainda não está configurado.'}, status=503)

    mission_title = str(dados.get('missionTitle', ''))[:200]
    section_title = str(dados.get('sectionTitle', ''))[:200]
    context_text = str(dados.get('context', ''))[:6000]

    history = dados.get('history')
    messages = []
    if isinstance(history, list):
        for entry in history[-10:]:
            if not isinstance(entry, dict):
                continue
            role = entry.get('role')
            text = str(entry.get('text', ''))[:2000]
            if role in ('user', 'assistant') and text:
                messages.append({'role': role, 'content': text})
    messages.append({'role': 'user', 'content': user_message})

    system_prompt = (
        "Chamas-te Kim, o Aventureiro, a mascote da Explore+, uma app de estudo de Biologia para alunos "
        "do ensino secundário em Portugal. Falas sempre em português de Portugal, "
        "de forma simpática, encorajadora e simples, como um explicador amigo.\n\n"
        f"O aluno está na missão \"{mission_title}\", na etapa \"{section_title}\".\n\n"
        "Usa o seguinte conteúdo desta etapa como referência para responderes com "
        "rigor científico — não inventes factos que o contradigam:\n\n"
        f"{context_text}\n\n"
        "Regras importantes:\n"
        "- Ajuda o aluno a perceber, mas não resolvas exercícios de teste por ele "
        "sem explicares o raciocínio.\n"
        "- Se perguntarem algo sem relação com Biologia ou com esta missão, recusa "
        "com simpatia e traz a conversa de volta ao tema.\n"
        "- Respostas curtas (2 a 4 frases), adequadas a um adolescente."
    )

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=500,
            system=[{
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=messages,
        )
        reply = next((block.text for block in response.content if block.type == 'text'), '')
    except anthropic.RateLimitError:
        return JsonResponse({'erro': 'Muitos pedidos de momento. Tenta novamente daqui a pouco.'}, status=429)
    except anthropic.APIStatusError:
        return JsonResponse({'erro': 'O serviço de chat está indisponível de momento.'}, status=502)
    except anthropic.APIConnectionError:
        return JsonResponse({'erro': 'Não foi possível ligar ao serviço de chat.'}, status=502)

    return JsonResponse({'reply': reply})


# Cada missão tem 3 testes: o primeiro incluído no plano Free, os outros
# dois exclusivos do SuperExplore (Pro). 'teste_id' fica a None enquanto o
# teste ainda não tiver conteúdo — a página mostra-o como "Em breve".
MISSOES_TESTES = [
    # Fotossíntese temporariamente ocultada da lista de testes a pedido da
    # Daniela — voltar a incluir este bloco quando ela pedir para reativar.
    # {
    #     'categoria': 'Botânica',
    #     'titulo': 'Fotossíntese',
    #     'meta': ['Grupos I, II e III', '14-16 perguntas', '45 minutos'],
    #     'correcao': 'Correção automática e por IA.',
    #     'testes': [
    #         {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': 'fotossintese'},
    #         {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': 'fotossintese-c4-milho'},
    #         {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': 'fotossintese-cam-opuntia'},
    #     ],
    # },
    {
        'categoria': 'Biodiversidade',
        'titulo': 'Diversidade e Organização Biológica',
        'meta': ['Grupos I, II e III', '14 perguntas', '45 minutos'],
        'correcao': 'Correção automática e por IA.',
        'testes': [
            {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': 'diversidade'},
            {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': 'diversidade-ornitorrinco'},
            {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': 'diversidade-liquenes'},
        ],
    },
    {
        'categoria': 'Citologia',
        'titulo': 'Células e Organelos',
        'meta': ['Grupos I, II e III', '14 perguntas', '45 minutos'],
        'correcao': 'Correção automática e por IA.',
        'testes': [
            {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': 'celulas'},
            {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': 'celulas-pancreas'},
            {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': 'celulas-endossimbiotica'},
        ],
    },
]


def encontrar_config_teste(teste_id):
    for missao in MISSOES_TESTES:
        for teste in missao['testes']:
            if teste.get('teste_id') == teste_id:
                return teste
    return None


def montar_categorias_testes(plano_aluno):
    categorias = {}
    for missao in MISSOES_TESTES:
        testes = []
        for teste in missao['testes']:
            disponivel = teste.get('teste_id') is not None
            testes.append({
                'titulo': teste['titulo'],
                'plano': teste['plano'],
                'disponivel': disponivel,
                'desbloqueado': teste['plano'] == 'free' or plano_aluno == 'pro',
                'url': reverse('teste-fotossintese', args=[teste['teste_id']]) if disponivel else None,
            })
        categorias.setdefault(missao['categoria'], []).append({**missao, 'testes': testes})
    return [{'nome': nome, 'missoes': missoes} for nome, missoes in categorias.items()]


@login_required(login_url='login')
def pagina_Testes(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    plano_aluno = perfil.plano if perfil is not None else 'free'
    return render(request, 'Testes.html', {
        'perfil': perfil,
        'categorias_testes': montar_categorias_testes(plano_aluno),
    })


EXAMES_DISPONIVEIS = [
    {
        'exame_id': 'biologia-geologia-2026-v1',
        'titulo': 'Exame Nacional de Biologia e Geologia — 2026, 1.ª Fase (V1)',
        'disciplina': 'Biologia e Geologia',
        'meta': ['11.º ano', 'Grupos I, II e III', '28 itens', '120 minutos'],
    },
    {
        'exame_id': 'biologia-geologia-2025-v1',
        'titulo': 'Exame Nacional de Biologia e Geologia — 2025, 1.ª Fase (V1)',
        'disciplina': 'Biologia e Geologia',
        'meta': ['11.º ano', 'Grupos I, II e III', '28 itens', '120 minutos'],
    },
]


def encontrar_config_exame(exame_id):
    for exame in EXAMES_DISPONIVEIS:
        if exame['exame_id'] == exame_id:
            return exame
    return None


@login_required(login_url='login')
def pagina_exames(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'exames.html', {
        'perfil': perfil,
        'exames': EXAMES_DISPONIVEIS,
    })


def carregar_exame(exame_id):
    """Tal como os testes, os exames vivem fora de static/: contêm o
    gabarito e nunca devem chegar ao browser do aluno."""
    caminho_json = settings.BASE_DIR.parent / 'exames' / f'{exame_id}.json'
    with open(caminho_json, 'r', encoding='utf-8') as f:
        return json.load(f)


def _perguntas_publicas_por_id(perguntas):
    return {
        pergunta['id']: {chave: valor for chave, valor in pergunta.items() if chave not in CHAVES_SECRETAS_PERGUNTA}
        for pergunta in perguntas
    }


@login_required(login_url='login')
def pagina_exame_detalhe(request, exame_id):
    config_exame = encontrar_config_exame(exame_id)
    if config_exame is None:
        raise Http404('Exame não encontrado.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    try:
        exame = carregar_exame(exame_id)
    except FileNotFoundError:
        raise Http404('Exame não encontrado.')

    perguntas_publicas_por_id = _perguntas_publicas_por_id(exame['perguntas'])

    # Monta, para cada secção de cada grupo, a lista já resolvida das suas
    # perguntas (sem chaves secretas) — o template não precisa de saber o
    # gabarito, só de desenhar as perguntas na ordem certa.
    grupos_para_template = []
    for grupo in exame['grupos']:
        seccoes_resolvidas = []
        for seccao in grupo['seccoes']:
            seccoes_resolvidas.append({
                **seccao,
                'perguntas': [perguntas_publicas_por_id[pid] for pid in seccao['pergunta_ids']],
            })
        grupos_para_template.append({**grupo, 'seccoes': seccoes_resolvidas})

    progresso_guardado = {}
    if perfil is not None:
        progresso_testes = perfil.progresso_testes if isinstance(perfil.progresso_testes, dict) else {}
        entrada = progresso_testes.get(exame_id)
        if isinstance(entrada, dict) and isinstance(entrada.get('respostas'), dict):
            progresso_guardado = entrada['respostas']

    return render(request, 'exame-detalhe.html', {
        'perfil': perfil,
        'exame': exame,
        'exame_id': exame_id,
        'grupos': grupos_para_template,
        'progresso_guardado': progresso_guardado,
    })


@login_required(login_url='login')
@require_POST
def corrigir_exame(request, exame_id):
    config_exame = encontrar_config_exame(exame_id)
    if config_exame is None:
        raise Http404('Exame não encontrado.')

    try:
        perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    try:
        dados_pedido = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    respostas_aluno = dados_pedido.get('respostas')
    if not isinstance(respostas_aluno, dict):
        return JsonResponse({'erro': 'Respostas em falta.'}, status=400)

    try:
        exame = carregar_exame(exame_id)
    except FileNotFoundError:
        raise Http404('Exame não encontrado.')

    resultado_perguntas = {}
    pontos_por_pergunta = {}
    perguntas_longas = []

    for pergunta in exame['perguntas']:
        resposta = respostas_aluno.get(pergunta['id'])
        if pergunta['tipo'] == 'resposta_longa':
            perguntas_longas.append((pergunta, resposta))
            continue
        pontos = corrigir_pergunta_automatica(pergunta, resposta)
        pontos_por_pergunta[pergunta['id']] = pontos
        resultado_perguntas[pergunta['id']] = {'pontos': pontos, 'cotacao': pergunta['cotacao']}

    feedback_ia = {}
    if perguntas_longas:
        correcao_ia = corrigir_perguntas_longas_com_ia(perguntas_longas)
        for pergunta, _ in perguntas_longas:
            item = correcao_ia.get(pergunta['id'], {'pontos': 0, 'feedback': ''})
            pontos_por_pergunta[pergunta['id']] = item['pontos']
            resultado_perguntas[pergunta['id']] = {'pontos': item['pontos'], 'cotacao': pergunta['cotacao']}
            feedback_ia[pergunta['id']] = item['feedback']

    # Itens de "melhor N de M" (ex: exames nacionais) — só as melhores
    # pontuações do conjunto opcional contam para a nota; as restantes são
    # descartadas, tal como na classificação oficial.
    pool_opcional = exame.get('pool_opcional')
    if pool_opcional:
        ids_pool = pool_opcional['ids']
        melhores_n = pool_opcional['melhores']
        pontuacoes_pool = sorted((pontos_por_pergunta.get(pid, 0) for pid in ids_pool), reverse=True)
        pontos_totais = sum(pontos for pid, pontos in pontos_por_pergunta.items() if pid not in ids_pool)
        pontos_totais += sum(pontuacoes_pool[:melhores_n])
    else:
        pontos_totais = sum(pontos_por_pergunta.values())

    nota_final = round(pontos_totais / (exame['cotacao_total'] / 20), 1)

    if perfil is not None:
        progresso_testes = dict(perfil.progresso_testes or {})
        if progresso_testes.pop(exame_id, None) is not None:
            perfil.progresso_testes = progresso_testes
            perfil.save(update_fields=['progresso_testes'])

    return JsonResponse({
        'notaFinal': nota_final,
        'pontosTotais': round(pontos_totais, 2),
        'cotacaoTotal': exame['cotacao_total'],
        'perguntas': resultado_perguntas,
        'feedbackIA': feedback_ia,
    })


def carregar_vocabulario(missao_id):
    caminho_json = settings.BASE_DIR.parent / 'vocabulario' / f'{missao_id}.json'
    with open(caminho_json, 'r', encoding='utf-8') as f:
        return json.load(f)


def guardar_vocabulario(missao_id, dados):
    caminho_json = settings.BASE_DIR.parent / 'vocabulario' / f'{missao_id}.json'
    with open(caminho_json, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
        f.write('\n')


# Biblioteca do Explorador: um "livro" de vocabulário por unidade, cada um
# associado ao ficheiro vocabulario/<id>.json (mesmo formato usado pelos
# flashcards — daí "Praticar com flashcards" reutilizar diretamente a rota
# de flashcards com o id da unidade). Uma unidade sem ficheiro ainda aparece
# na estante, mas como "ainda por começar".
UNIDADES_BIBLIOTECA = [
    {'id': 'citologia', 'nome': 'Citologia', 'cor_a': '#2f7ea6', 'cor_b': '#1fa6c9', 'cor_soft': '#e3f3f7'},
    {'id': 'genetica', 'nome': 'Genética', 'cor_a': '#6c4fb0', 'cor_b': '#8a6bd1', 'cor_soft': '#efe7fa'},
    {'id': 'ecologia', 'nome': 'Ecologia', 'cor_a': '#5f7d33', 'cor_b': '#789b4a', 'cor_soft': '#eef3e0'},
    {'id': 'corpo_humano', 'nome': 'Corpo Humano', 'cor_a': '#b03a3a', 'cor_b': '#dc3545', 'cor_soft': '#fdecee'},
    {'id': 'botanica', 'nome': 'Botânica', 'cor_a': '#2f6b45', 'cor_b': '#1f8a5b', 'cor_soft': '#eaf3e9'},
]


def carregar_termos_unidade(unidade_id):
    try:
        return carregar_vocabulario(unidade_id).get('termos', [])
    except FileNotFoundError:
        return []


def montar_biblioteca_estante():
    estante = []
    for unidade in UNIDADES_BIBLIOTECA:
        termos = carregar_termos_unidade(unidade['id'])
        novos = sum(1 for termo in termos if termo.get('estado', 'novo') == 'novo')
        estante.append({**unidade, 'total_termos': len(termos), 'novos': novos})
    return estante


@login_required(login_url='login')
def pagina_biblioteca(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'biblioteca.html', {
        'perfil': perfil,
        'estante': montar_biblioteca_estante(),
    })


@login_required(login_url='login')
def pagina_biblioteca_unidade(request, unidade_id):
    unidade = next((u for u in UNIDADES_BIBLIOTECA if u['id'] == unidade_id), None)
    if unidade is None:
        raise Http404('Unidade não encontrada.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    termos = carregar_termos_unidade(unidade_id)
    nomes_por_id = {termo['id']: termo['termo'] for termo in termos}
    for termo in termos:
        termo['relacionados_nomes'] = [
            nomes_por_id.get(rel_id, rel_id) for rel_id in termo.get('relacionados', [])
        ]

    contagens = {'novo': 0, 'dominado': 0, 'a_rever': 0}
    for termo in termos:
        estado = termo.get('estado', 'novo')
        if estado in contagens:
            contagens[estado] += 1

    return render(request, 'biblioteca-unidade.html', {
        'perfil': perfil,
        'unidade': unidade,
        'termos': termos,
        'total_termos': len(termos),
        'contagens': contagens,
    })


@login_required(login_url='login')
def pagina_flashcards(request, missao_id):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    try:
        vocabulario = carregar_vocabulario(missao_id)
    except FileNotFoundError:
        raise Http404('Vocabulário não encontrado para esta missão.')

    return render(request, 'flashcards.html', {
        'perfil': perfil,
        'vocabulario': vocabulario,
        'missao_id': missao_id,
    })


@login_required(login_url='login')
@require_POST
def atualizar_vocabulario(request, missao_id):
    """Grava o resultado desta ronda de revisão diretamente no ficheiro de
    vocabulário da missão (estado + última revisão por termo)."""
    try:
        dados_pedido = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    atualizacoes = dados_pedido.get('atualizacoes')
    if not isinstance(atualizacoes, list):
        return JsonResponse({'erro': 'Atualizações em falta.'}, status=400)

    estados_por_id = {}
    for item in atualizacoes:
        if not isinstance(item, dict):
            continue
        termo_id = item.get('id')
        estado = item.get('estado')
        if termo_id and estado in ('dominado', 'a_rever'):
            estados_por_id[termo_id] = estado

    try:
        vocabulario = carregar_vocabulario(missao_id)
    except FileNotFoundError:
        raise Http404('Vocabulário não encontrado para esta missão.')

    hoje = timezone.localdate().isoformat()
    for termo in vocabulario['termos']:
        novo_estado = estados_por_id.get(termo['id'])
        if novo_estado:
            termo['estado'] = novo_estado
            termo['ultima_revisao'] = hoje

    guardar_vocabulario(missao_id, vocabulario)

    return JsonResponse({'ok': True})


RESUMOS = [
    {
        'id': 'fotossintese',
        'nome': 'Fotossíntese',
        'disciplina': 'Biologia',
        'cor_a': '#2f6b45',
        'cor_b': '#1f8a5b',
        'cor_soft': '#eaf3e9',
        'descricao_curta': 'Como as plantas convertem luz solar em energia química, do cloroplasto ao Ciclo de Calvin.',
    },
    {
        'id': 'diversidade-organizacao-biologica',
        'nome': 'Diversidade e Organização Biológica',
        'disciplina': 'Biologia',
        'cor_a': '#1d5f73',
        'cor_b': '#2a8fae',
        'cor_soft': '#e8f4f7',
        'descricao_curta': 'Dos átomos à biosfera, e da célula às moléculas da vida — os níveis de organização, os ecossistemas e a biodiversidade.',
    },
]

RESUMOS_CONTEUDO = {
    'fotossintese': {
        'seccoes': [
            {
                'titulo': 'Localização Celular: O Cloroplasto',
                'texto': (
                    'Nas plantas, a fotossíntese ocorre dentro de organelos celulares especializados chamados '
                    '**cloroplastos**, presentes maioritariamente nas células do parênquima clorofilino das folhas.'
                ),
                'imagem': 'images/Tilacoides 2.jpg',
                'imagem_alt': 'Ilustração do zoom da folha até à membrana dos tilacoides, com a grana e o estroma dentro do cloroplasto',
                # Coordenadas no espaço original da imagem (1536×1024 px). A
                # legenda vive numa faixa extra à direita ("imagem_gutter"),
                # fora dos limites da própria imagem — por isso o SVG que a
                # desenha é mais largo do que a <img> por baixo dela (ver
                # 'imagem_svg_largura_pct', calculado a partir destes números).
                'imagem_largura': 1536,
                'imagem_altura': 1024,
                'imagem_gutter': 430,
                # = (imagem_largura + imagem_gutter) / imagem_largura * 100 —
                # a largura do SVG de legenda face à <img> por baixo dele.
                'imagem_svg_largura_pct': 128,
                'imagem_marcadores': [
                    # Membranas e Tilacoides — ponto de ancoragem na membrana.
                    {'numero': 1, 'ax': 1352, 'ay': 461, 'lx': 1736, 'ly': 512},
                    # Grana — ponto de ancoragem na pilha de tilacoides.
                    {'numero': 2, 'ax': 952, 'ay': 430, 'lx': 1736, 'ly': 200},
                    # Estroma — ponto de ancoragem no espaço fluido entre as pilhas.
                    {'numero': 3, 'ax': 876, 'ay': 563, 'lx': 1736, 'ly': 824},
                ],
                'definicoes': [
                    {
                        'termo': 'Membranas e Tilacoides',
                        'texto': (
                            'No interior do cloroplasto existem sacos membranares achatados chamados '
                            '**tilacoides**. É na membrana dos tilacoides que se encontram ancorados os pigmentos '
                            'fotossintéticos (principalmente as clorofilas *a* e *b* e os carotenoides), '
                            'organizados em fotossistemas.'
                        ),
                    },
                    {
                        'termo': 'Grana',
                        'texto': 'O conjunto de tilacoides empilhados recebe o nome de **grana** (no singular, *granum*).',
                    },
                    {
                        'termo': 'Estroma',
                        'texto': (
                            'O espaço fluido e denso que preenche o interior do cloroplasto, envolvendo os '
                            'tilacoides. É rico em enzimas, ribossomas e DNA próprio.'
                        ),
                    },
                ],
                'dica': (
                    'pensa no cloroplasto como uma **fábrica de açúcar movida a energia solar**. Os tilacoides '
                    'são os **painéis solares**, empilhados em torres (grana) para captar o máximo de luz '
                    'possível. O estroma é o **chão de fábrica** à volta desses painéis, onde as peças (CO₂) são '
                    'montadas no produto final (glicose), usando a eletricidade (ATP/NADPH) que os painéis '
                    'acabaram de gerar.'
                ),
            },
            {
                'titulo': 'Fase 1 — Reações Fotoquímicas (Fase Dependente da Luz)',
                'texto': (
                    'Esta fase ocorre exclusivamente na membrana dos tilacoides e requer a presença direta '
                    'da luz solar.'
                ),
                'imagem': 'images/Cadeia transportadora de eletrões.png',
                'imagem_alt': 'Esquema da cadeia transportadora de eletrões na membrana do tilacoide: PSII, Cyt b6f, PSI e ATP-sintase',
                'imagem_max_width': '640px',
                'passos': [
                    {
                        'titulo': 'Excitação da clorofila e cadeia de transporte de eletrões',
                        'texto': (
                            'A luz incide nos pigmentos do Fotossistema II (PSII). A energia absorvida excita '
                            'os eletrões da clorofila, que saltam para níveis de energia superiores e são '
                            'transferidos ao longo de uma cadeia de transportadores.'
                        ),
                    },
                    {
                        'titulo': 'Fotólise da água',
                        'texto': (
                            'Para substituir os eletrões perdidos pela clorofila, ocorre a quebra de moléculas '
                            'de água (H₂O). A água divide-se em eletrões (repõem os da clorofila), protões H⁺ '
                            'e oxigénio gasoso.'
                        ),
                    },
                    {
                        'titulo': 'Produção de oxigénio',
                        'texto': 'O O₂ resultante da fotólise é libertado para o meio ambiente através dos estomas.',
                    },
                    {
                        'titulo': 'Fotofosforilação (síntese de ATP)',
                        'texto': (
                            'O movimento dos protões H⁺ através da enzima ATP-sintase impulsiona a conversão de '
                            'ADP em ATP.'
                        ),
                    },
                    {
                        'titulo': 'Formação de NADPH',
                        'texto': (
                            'Os eletrões chegam ao Fotossistema I (PSI), são novamente energizados pela luz, e '
                            'utilizados para reduzir o NADP⁺ a NADPH.'
                        ),
                    },
                ],
                'dica': (
                    'imagina a água como uma **garrafa reciclável que é esmagada** para libertar o que interessa '
                    '(eletrões) — o oxigénio que sobra é literalmente **lixo descartado** para o ar, não um '
                    'produto que a planta queira guardar. Já o ATP e o NADPH são como **dinheiro e um cartão de '
                    'crédito**: o ATP é dinheiro pronto a gastar (energia direta), o NADPH é um cartão que '
                    '"transporta" eletrões para serem usados como poder de compra mais tarde, na fase seguinte.'
                ),
            },
            {
                'titulo': 'Fase 2 — Reações Químicas (Ciclo de Calvin)',
                'texto': (
                    'Esta fase ocorre no **estroma** e utiliza a energia química gerada na fase fotoquímica '
                    '(ATP e NADPH) para converter o dióxido de carbono em compostos orgânicos.'
                ),
                'imagem': 'images/Ciclo de Calvin 2.png',
                'imagem_alt': 'Esquema do Ciclo de Calvin: fixação do carbono, redução e regeneração da RuBP',
                'imagem_max_width': '520px',
                'passos': [
                    {
                        'titulo': 'Fixação do carbono',
                        'texto': (
                            'O CO₂ difunde-se até ao estroma. A enzima **RuBisCO** catalisa a ligação do CO₂ a '
                            'uma molécula de 5 carbonos (RuBP), formando compostos de 3 carbonos (3-PGA).'
                        ),
                    },
                    {
                        'titulo': 'Redução',
                        'texto': (
                            'O ATP fornece energia e o NADPH fornece eletrões/hidrogénios para reduzir o 3-PGA '
                            'a G3P (gliceraldeído-3-fosfato).'
                        ),
                    },
                    {
                        'titulo': 'Produção de glicose',
                        'texto': (
                            'A cada 6 voltas do ciclo, são produzidas moléculas de G3P suficientes para '
                            'sintetizar uma molécula de glicose, além de sacarose e amido.'
                        ),
                    },
                    {
                        'titulo': 'Regeneração da RuBP',
                        'texto': (
                            'Parte das moléculas de G3P são reorganizadas, com mais ATP, para regenerar a RuBP, '
                            'permitindo que o ciclo recomece.'
                        ),
                    },
                ],
                'dica': (
                    'a RuBisCO é como um **anzol lançado ao ar** — "pesca" o CO₂ que está disperso na atmosfera '
                    'e prende-o a uma molécula maior, para deixar de andar solto. E pensa no ciclo todo como uma '
                    '**linha de montagem circular**: parte das peças a meio da linha (G3P) segue para o produto '
                    'final (glicose), mas outra parte volta ao início da linha (regenera a RuBP) para o processo '
                    'nunca parar — como uma correia transportadora fechada, não uma linha reta com fim.'
                ),
            },
        ],
        'fatores_titulo': 'Fatores Limitantes da Fotossíntese',
        'fatores': [
            {
                'titulo': 'Intensidade e comprimento de onda da luz',
                'texto': (
                    'a taxa aumenta com a luz até ao ponto de saturação. As clorofilas absorvem sobretudo azul '
                    'e vermelho, refletindo o verde (daí a cor das plantas).'
                ),
            },
            {
                'titulo': 'Concentração de CO₂',
                'texto': 'mais CO₂ acelera a taxa até a RuBisCO ficar saturada.',
            },
            {
                'titulo': 'Temperatura',
                'texto': (
                    'a taxa aumenta com a temperatura até um ótimo; temperaturas excessivas desnaturam as '
                    'enzimas e fecham os estomas.'
                ),
            },
            {
                'titulo': 'Disponibilidade de água',
                'texto': 'sem água, os estomas fecham para evitar dessecação, bloqueando a entrada de CO₂.',
            },
        ],
        'fatores_dica': (
            'pensa numa **autoestrada numa hora de ponta**. Mais carros (mais luz, mais CO₂) fazem o trânsito '
            'fluir mais depressa — até a estrada ficar cheia (saturação enzimática), e a partir daí, por mais '
            'carros que entrem, nada anda mais rápido. A temperatura é como o **motor de um carro de corrida**: '
            'quanto mais quente, mais rápido funciona — até sobreaquecer e avariar (desnaturação). E a água é '
            'como as **portas de um comboio no inverno**: fecham para não deixar entrar o frio (perder água), '
            'mas ao fechar, também impedem quem quer entrar (o CO₂) de o fazer.'
        ),
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {'label': 'Onde ocorre', 'valor': 'Cloroplastos'},
            {'label': 'Fase clara', 'valor': 'Tilacoides · usa H₂O e luz · produz O₂, ATP e NADPH'},
            {'label': 'Fase escura (Calvin)', 'valor': 'Estroma · usa CO₂, ATP e NADPH · produz glicose'},
            {'label': 'Origem do oxigénio', 'valor': 'Exclusivamente da água, na fase clara'},
        ],
        'sintese_dica': (
            '*"A luz parte a água lá em cima (tilacoides), o carbono é pescado lá em baixo (estroma) — o que '
            'sobe como energia (ATP/NADPH), desce para virar açúcar."*'
        ),
    },
    'diversidade-organizacao-biologica': {
        'seccoes': [
            {
                'titulo': 'O que é a Biodiversidade?',
                'texto': (
                    'A Terra alberga uma enorme variedade de seres vivos, distribuídos pelos mais diversos '
                    'ambientes (aquáticos, terrestres, extremos). A esta variedade dá-se o nome de '
                    '**diversidade biológica** ou **biodiversidade**. Apesar de toda esta diversidade, todos '
                    'os seres vivos partilham um conjunto de características comuns.'
                ),
                'definicoes': [
                    {
                        'termo': 'Constituição celular',
                        'texto': 'Todos os seres vivos são formados por uma ou mais células.',
                    },
                    {
                        'termo': 'Metabolismo',
                        'texto': 'Utilizam energia e matéria do meio para se manterem e crescerem.',
                    },
                    {
                        'termo': 'Irritabilidade',
                        'texto': 'Reagem a estímulos do ambiente que os rodeia.',
                    },
                    {
                        'termo': 'Reprodução',
                        'texto': 'Têm capacidade de originar novos seres vivos semelhantes a si.',
                    },
                    {
                        'termo': 'Crescimento e desenvolvimento',
                        'texto': 'Sofrem alterações ao longo do seu ciclo de vida.',
                    },
                ],
                'dica': (
                    'pensa nestas cinco características como um **"checklist de admissão" ao clube da vida** '
                    '— só entra quem tiver células, gastar energia, reagir ao que o rodeia, crescer e '
                    'conseguir reproduzir-se. Falta uma destas condições, e já não é considerado um ser vivo.'
                ),
            },
            {
                'titulo': 'Níveis de Organização Biológica',
                'texto': (
                    'O mundo vivo não é caótico — apresenta-se **hierarquicamente estruturado**, em níveis '
                    'de organização crescente, do mais simples ao mais complexo. Cada nível resulta da '
                    'interação e organização do nível anterior — é o chamado **princípio da hierarquização '
                    'biológica**.'
                ),
                'imagem': 'images/resumo-diversidade-organizacao-biologica/niveis-organizacao.png',
                'imagem_alt': 'Esquema dos níveis de organização biológica, em sequência: molécula e célula, tecido e órgão, organismo, população e comunidade, ecossistema e biosfera.',
                'definicoes': [
                    {
                        'termo': 'Átomo / Molécula',
                        'texto': 'Unidades químicas básicas (ex.: água, glicose, proteínas) que constituem a matéria viva.',
                    },
                    {
                        'termo': 'Célula',
                        'texto': 'Unidade estrutural e funcional básica de todos os seres vivos.',
                    },
                    {
                        'termo': 'Tecido',
                        'texto': 'Conjunto de células com a mesma origem, forma e função.',
                    },
                    {
                        'termo': 'Órgão',
                        'texto': 'Conjunto de tecidos diferentes que cooperam numa função comum.',
                    },
                    {
                        'termo': 'Sistema de órgãos',
                        'texto': 'Conjunto de órgãos que trabalham de forma coordenada (ex.: sistema digestivo).',
                    },
                    {
                        'termo': 'Organismo',
                        'texto': 'Ser vivo individual, resultante da integração de todos os sistemas.',
                    },
                    {
                        'termo': 'População',
                        'texto': 'Conjunto de organismos da mesma espécie que vivem na mesma área, na mesma altura, e que podem cruzar-se entre si.',
                    },
                    {
                        'termo': 'Comunidade (biocenose)',
                        'texto': 'Conjunto de populações de espécies diferentes que coexistem numa mesma área.',
                    },
                    {
                        'termo': 'Ecossistema',
                        'texto': 'Conjunto formado pela comunidade biótica e pelo meio abiótico (fatores físico-químicos) com que interage.',
                    },
                    {
                        'termo': 'Bioma',
                        'texto': 'Grande região com características climáticas e ecológicas semelhantes, que agrupa vários ecossistemas (ex.: floresta tropical, tundra).',
                    },
                    {
                        'termo': 'Biosfera',
                        'texto': 'Conjunto de todos os ecossistemas do planeta — a "camada" da Terra onde existe vida.',
                    },
                ],
                'dica': (
                    'imagina um conjunto de **bonecas russas (matrioskas)**: cada nível está contido no '
                    'seguinte e ajuda a construí-lo — os átomos formam moléculas, as moléculas formam '
                    'células, as células formam tecidos, e assim sucessivamente até à biosfera. Para '
                    'memorizar a ordem, tenta a frase: *"A Célula Trabalha Organizando Sistemas, Originando '
                    'Populações Companheiras Em Biomas Sempre."*'
                ),
            },
            {
                'titulo': 'Estrutura do Ecossistema: Biótopo e Biocenose',
                'texto': (
                    'Um ecossistema é constituído por dois componentes: o **biótopo** (componente abiótica) '
                    '— fatores físicos e químicos do meio, como luz, temperatura, água, solo, salinidade ou '
                    'pH — e a **biocenose** (componente biótica) — o conjunto dos seres vivos presentes. '
                    'Dentro da biocenose, os seres vivos organizam-se em três grandes grupos funcionais, '
                    'consoante o seu papel na cadeia alimentar.'
                ),
                'imagem': 'images/resumo-diversidade-organizacao-biologica/produtores-consumidores-decompositores.png',
                'imagem_alt': 'Esquema dos grupos funcionais de um ecossistema: produtores captam energia solar por fotossíntese, consumidores (herbívoros e carnívoros) alimentam-se deles, e decompositores (fungos e bactérias) devolvem a matéria ao meio, fechando o ciclo de volta aos produtores.',
                'imagem_max_width': '520px',
                'definicoes': [
                    {
                        'termo': 'Produtores',
                        'texto': 'Organismos autotróficos (ex.: plantas, algas, cianobactérias) que produzem matéria orgânica a partir de matéria inorgânica, geralmente através da fotossíntese.',
                    },
                    {
                        'termo': 'Consumidores primários',
                        'texto': 'Herbívoros — organismos heterotróficos que se alimentam diretamente dos produtores.',
                    },
                    {
                        'termo': 'Consumidores secundários e terciários',
                        'texto': 'Carnívoros que se alimentam, respetivamente, de consumidores primários ou de outros carnívoros.',
                    },
                    {
                        'termo': 'Decompositores',
                        'texto': 'Fungos e bactérias que decompõem matéria orgânica morta (restos de seres vivos, excrementos), devolvendo matéria inorgânica ao meio e fechando os ciclos de matéria.',
                    },
                ],
                'dica': (
                    'pensa numa **economia em miniatura**: os produtores são a fábrica que cria riqueza '
                    '(matéria orgânica) a partir do zero; os consumidores são quem compra e usa essa riqueza, '
                    'passando-a de mão em mão; e os decompositores são a reciclagem, que devolve os '
                    'materiais ao mercado para tudo poder recomeçar.'
                ),
            },
            {
                'titulo': 'Dinâmica do Ecossistema',
                'texto': (
                    'Um ecossistema não é estático — a energia e a matéria estão em constante movimento '
                    'entre os seus componentes, através de relações alimentares e de trocas com o meio '
                    'abiótico.'
                ),
                'definicoes': [
                    {
                        'termo': 'Fluxo de energia',
                        'texto': 'A energia entra no ecossistema pela luz solar (captada pelos produtores) e circula, de forma unidirecional, ao longo da cadeia/teia alimentar, dissipando-se progressivamente sob a forma de calor.',
                    },
                    {
                        'termo': 'Ciclo de matéria',
                        'texto': 'Ao contrário da energia, a matéria é reciclada: os decompositores devolvem os nutrientes ao meio abiótico, que voltam a ser utilizados pelos produtores.',
                    },
                    {
                        'termo': 'Cadeias e teias alimentares',
                        'texto': 'As cadeias alimentares raramente são lineares e isoladas; interligam-se formando teias alimentares complexas, o que confere maior estabilidade ao ecossistema.',
                    },
                    {
                        'termo': 'Fatores limitantes',
                        'texto': 'Fatores abióticos ou bióticos que condicionam o crescimento e a distribuição das populações (ex.: disponibilidade de água, temperatura, competição, predação).',
                    },
                ],
                'dica': (
                    'a energia é como a **água de um rio**: corre sempre no mesmo sentido e acaba por se '
                    'perder no mar, sob a forma de calor — nunca volta atrás. Já a matéria é como uma '
                    '**garrafa reutilizável**: anda sempre a circular entre os seres vivos e o meio, nunca '
                    'se perde, só muda de forma.'
                ),
            },
            {
                'titulo': 'Os Três Níveis da Biodiversidade',
                'texto': 'A biodiversidade pode ser analisada a três níveis distintos, do mais específico ao mais amplo.',
                'imagem': 'images/resumo-diversidade-organizacao-biologica/biodiversidade-extincao-conservacao.png',
                'imagem_alt': 'Esquema da biodiversidade (genes, espécies, ecossistemas), representada como uma árvore, e uma balança que equilibra as causas de extinção (destruição de habitats, poluição, exploração) com as estratégias de conservação (áreas protegidas, bancos de genes, educação).',
                'imagem_max_width': '480px',
                'definicoes': [
                    {
                        'termo': 'Diversidade genética',
                        'texto': 'Variabilidade de genes dentro de cada espécie (entre indivíduos da mesma população/espécie).',
                    },
                    {
                        'termo': 'Diversidade de espécies',
                        'texto': 'Número e variedade de espécies existentes numa determinada região ou no planeta.',
                    },
                    {
                        'termo': 'Diversidade de ecossistemas',
                        'texto': 'Variedade de habitats, comunidades bióticas e processos ecológicos numa dada área.',
                    },
                ],
                'dica': (
                    'pensa numa **biblioteca**: a diversidade de ecossistemas são as diferentes salas '
                    '(floresta, oceano, deserto); a diversidade de espécies são os livros diferentes em '
                    'cada sala; e a diversidade genética são as edições diferentes do mesmo livro — todas '
                    'contam para a riqueza total da biblioteca.'
                ),
            },
            {
                'titulo': 'Porque é Importante a Biodiversidade',
                'texto': 'A biodiversidade não é só uma curiosidade da natureza — sustenta diretamente a vida no planeta e a nossa própria qualidade de vida.',
                'definicoes': [
                    {
                        'termo': 'Equilíbrio e resiliência',
                        'texto': 'Garante o equilíbrio dos ecossistemas — quanto maior a diversidade, maior a capacidade de resposta a perturbações.',
                    },
                    {
                        'termo': 'Serviços de ecossistema',
                        'texto': 'Fornece polinização, purificação da água e do ar, regulação do clima e fertilidade do solo.',
                    },
                    {
                        'termo': 'Recursos genéticos',
                        'texto': 'Constitui uma reserva de recursos usados na alimentação, na medicina e na biotecnologia.',
                    },
                    {
                        'termo': 'Valor cultural, científico e estético',
                        'texto': 'Enriquece o conhecimento científico e a vida cultural e estética das sociedades humanas.',
                    },
                ],
                'dica': (
                    'quanto mais **ferramentas houver numa caixa de ferramentas** (biodiversidade), maior a '
                    'probabilidade de existir a ferramenta certa quando surge um problema novo — uma seca, '
                    'uma doença, uma alteração climática. É isso que dá **resiliência** a um ecossistema.'
                ),
            },
            {
                'titulo': 'Extinção de Espécies',
                'texto': (
                    'A **extinção** corresponde ao desaparecimento definitivo de uma espécie. Pode ser '
                    '**natural** — resultante de processos evolutivos e alterações ambientais ao longo do '
                    'tempo geológico, como as grandes extinções em massa registadas no registo fóssil — ou '
                    '**antrópica** — causada pela ação humana, atualmente a principal causa da perda '
                    'acelerada de biodiversidade.'
                ),
                'definicoes': [
                    {
                        'termo': 'Destruição e fragmentação de habitats',
                        'texto': 'Desflorestação, urbanização e agricultura intensiva reduzem e dividem os espaços onde as espécies vivem.',
                    },
                    {
                        'termo': 'Poluição',
                        'texto': 'Contaminação do solo, da água e do ar, que degrada habitats e prejudica os seres vivos.',
                    },
                    {
                        'termo': 'Sobre-exploração de recursos',
                        'texto': 'Pesca e caça excessivas, além da capacidade de renovação natural das populações.',
                    },
                    {
                        'termo': 'Espécies exóticas/invasoras',
                        'texto': 'Espécies introduzidas que competem com as espécies nativas ou as predam.',
                    },
                    {
                        'termo': 'Alterações climáticas globais',
                        'texto': 'Mudanças no clima que ultrapassam a capacidade de adaptação de muitas espécies.',
                    },
                ],
                'dica': (
                    'pensa nas causas antrópicas de extinção como **ameaças a uma casa**: destruíres a casa '
                    '(habitat), envenenares o ar lá dentro (poluição), esvaziares tudo o que lá está '
                    '(sobre-exploração), deixares entrar intrusos (espécies invasoras), ou mudares a própria '
                    'temperatura do bairro (alterações climáticas).'
                ),
            },
            {
                'titulo': 'Conservação da Biodiversidade',
                'texto': (
                    'Para travar a perda de biodiversidade, existem diferentes estratégias de conservação, '
                    'complementadas por legislação e acordos internacionais de proteção de espécies e '
                    'habitats, por sensibilização e educação ambiental, e pela gestão sustentável dos '
                    'recursos naturais.'
                ),
                'definicoes': [
                    {
                        'termo': 'Conservação in situ',
                        'texto': 'Proteção das espécies no seu habitat natural — ex.: parques naturais, reservas, áreas protegidas, corredores ecológicos.',
                    },
                    {
                        'termo': 'Conservação ex situ',
                        'texto': 'Conservação fora do habitat natural — ex.: jardins botânicos, zoológicos, bancos de sementes e de germoplasma, programas de reprodução em cativeiro.',
                    },
                ],
                'dica': (
                    'a conservação **in situ** é como tratar de um doente em casa dele; a conservação '
                    '**ex situ** é como levá-lo para o hospital — ambas podem salvar a espécie, mas fazem-no '
                    'em locais diferentes, e a ex situ costuma ser o último recurso quando o "ambiente '
                    'natural" já não é seguro.'
                ),
            },
            {
                'titulo': 'A Célula: Unidade da Vida (Teoria Celular)',
                'texto': (
                    'A **célula** é a unidade estrutural e funcional de todos os seres vivos. Esta ideia é '
                    'formalizada pela **Teoria Celular**, que assenta em três princípios fundamentais.'
                ),
                'passos': [
                    {
                        'titulo': 'Todos os seres vivos são celulares',
                        'texto': 'São constituídos por uma ou mais células.',
                    },
                    {
                        'titulo': 'A célula é a unidade básica',
                        'texto': 'É a unidade básica de estrutura e função dos seres vivos.',
                    },
                    {
                        'titulo': 'Continuidade celular',
                        'texto': 'Todas as células provêm de células pré-existentes, por divisão celular.',
                    },
                ],
                'dica': (
                    'pensa na célula como o **"tijolo" de qualquer construção viva**: todo o edifício (o '
                    'ser vivo) é feito de tijolos; cada tijolo já tem tudo o que precisa para funcionar por '
                    'si só; e um tijolo novo só nasce a partir de outro tijolo já existente — nunca do nada.'
                ),
            },
            {
                'titulo': 'Diversidade Celular: Procariótica vs. Eucariótica',
                'texto': (
                    'Apesar da grande variedade de formas, tamanhos e funções das células, distinguem-se '
                    'dois grandes tipos de organização celular.'
                ),
                'imagens': [
                    {
                        'imagem': 'images/resumo-diversidade-organizacao-biologica/procariotica-vs-eucariotica.png',
                        'imagem_alt': 'Comparação esquemática: a célula procariótica tem o material genético disperso no citoplasma (nucleoide), sem núcleo definido; a célula eucariótica tem um núcleo delimitado por membrana e organelos como mitocôndrias e retículo endoplasmático.',
                        'legenda': 'Célula procariótica vs. eucariótica',
                    },
                    {
                        'imagem': 'images/resumo-diversidade-organizacao-biologica/celula-eucariotica-detalhe.png',
                        'imagem_alt': 'Esquema pormenorizado de uma célula eucariótica, com a membrana celular, o núcleo, as mitocôndrias, o retículo endoplasmático, o complexo de Golgi, os ribossomas livres e um lisossoma assinalados.',
                        'legenda': 'Constituintes de uma célula eucariótica',
                    },
                ],
                'definicoes': [
                    {
                        'termo': 'Célula procariótica',
                        'texto': 'Não possui núcleo individualizado — o material genético encontra-se disperso no citoplasma, numa região designada nucleoide. Não apresenta organelos membranares. Estrutura mais simples e de menores dimensões. Característica das bactérias e arqueias.',
                    },
                    {
                        'termo': 'Célula eucariótica',
                        'texto': 'Possui um núcleo individualizado, delimitado por uma membrana nuclear, que contém o material genético. Apresenta diversos organelos membranares especializados (mitocôndrias, retículo endoplasmático, complexo de Golgi, etc.). Estrutura mais complexa e, em geral, de maiores dimensões. Característica dos protistas, fungos, plantas e animais.',
                    },
                ],
                'dica': (
                    'a célula procariótica é como um **escritório open-space**, sem paredes — tudo à vista, '
                    'incluindo o DNA "a boiar" na sala. A célula eucariótica é como um **escritório com '
                    'salas separadas** (os organelos), e o DNA tem a sua própria sala trancada — o núcleo.'
                ),
            },
            {
                'titulo': 'Célula Animal vs. Célula Vegetal, e o Número de Células',
                'texto': (
                    'Dentro das células eucarióticas distinguem-se, entre outras, a célula animal e a célula '
                    'vegetal, que apresentam diferenças estruturais. Os organismos podem ainda classificar-se '
                    'quanto ao número de células: os **unicelulares** são constituídos por uma única célula, '
                    'que desempenha todas as funções vitais (ex.: bactérias, muitos protistas); os '
                    '**pluricelulares** (multicelulares) são constituídos por muitas células, geralmente '
                    'especializadas e organizadas em tecidos, órgãos e sistemas.'
                ),
                'definicoes': [
                    {
                        'termo': 'Parede celular',
                        'texto': 'Ausente na célula animal; presente (de celulose) na célula vegetal.',
                    },
                    {
                        'termo': 'Cloroplastos',
                        'texto': 'Ausentes na célula animal; presentes na célula vegetal.',
                    },
                    {
                        'termo': 'Vacúolo',
                        'texto': 'Pequeno ou ausente na célula animal; grande vacúolo central na célula vegetal.',
                    },
                    {
                        'termo': 'Forma',
                        'texto': 'Geralmente irregular na célula animal; geralmente regular (definida pela parede) na célula vegetal.',
                    },
                ],
                'dica': (
                    'a célula vegetal tem "paredes de tijolo" (parede celular) e "painéis solares" '
                    '(cloroplastos) que a célula animal não tem — por isso a planta não precisa de "sair de '
                    'casa" para ir buscar energia, produz a sua própria.'
                ),
            },
            {
                'titulo': 'Constituintes Moleculares dos Seres Vivos',
                'texto': (
                    'Do ponto de vista químico, todos os seres vivos são constituídos pelos mesmos tipos de '
                    'moléculas, formadas essencialmente por um número reduzido de elementos químicos: '
                    '**Carbono (C), Oxigénio (O), Hidrogénio (H), Azoto/Nitrogénio (N)** e, em menor '
                    'quantidade, Fósforo (P), Enxofre (S), Cálcio (Ca), entre outros. Esta uniformidade '
                    'química é um forte argumento a favor da **unidade da vida**. Os compostos orgânicos '
                    '(macromoléculas) resultam da união de unidades mais simples — os monómeros — através '
                    'de reações de polimerização/condensação, com libertação de água; o processo inverso '
                    '(hidrólise) liberta os monómeros, com consumo de água.'
                ),
                'definicoes': [
                    {
                        'termo': 'Água',
                        'texto': 'A molécula mais abundante nos seres vivos. É uma molécula polar, o que lhe confere elevado poder solvente, coesão e adesão, e elevado calor específico. É o meio onde ocorrem as reações metabólicas, participa no transporte de substâncias, na termorregulação e em reações químicas como a hidrólise e a fotossíntese.',
                    },
                    {
                        'termo': 'Glícidos (hidratos de carbono)',
                        'texto': 'Monómeros: monossacarídeos (ex.: glicose). Função: fonte e reserva de energia (ex.: amido, glicogénio); função estrutural (ex.: celulose).',
                    },
                    {
                        'termo': 'Lípidos',
                        'texto': 'Monómeros: ácidos gordos e glicerol, entre outros. Função: reserva energética; constituintes das membranas celulares (fosfolípidos); função hormonal e isolamento.',
                    },
                    {
                        'termo': 'Proteínas',
                        'texto': 'Monómeros: aminoácidos. Função: estrutural, enzimática (catalisadores biológicos), defesa (anticorpos), transporte, regulação (hormonas).',
                    },
                    {
                        'termo': 'Ácidos nucleicos',
                        'texto': 'Monómeros: nucleótidos. Função: armazenamento e transmissão da informação genética (DNA) e síntese proteica (RNA).',
                    },
                ],
                'dica': (
                    'a água é o **"palco"** onde todas as reações químicas da vida acontecem — sem ela, as '
                    'moléculas não têm onde se encontrar. Já os monómeros são como **peças de LEGO**: os '
                    'glícidos são o "lego de energia rápida", os lípidos o "lego de reserva a longo prazo", '
                    'as proteínas o "lego das ferramentas" (fazem quase tudo) e os ácidos nucleicos o "lego '
                    'com o manual de instruções".'
                ),
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {'label': 'Organização da vida', 'valor': 'Níveis hierárquicos, do átomo à biosfera'},
            {'label': 'Ecossistema', 'valor': 'Biótopo (abiótico) + Biocenose (biótico) · fluxo de energia unidirecional · ciclo de matéria'},
            {'label': 'Biodiversidade', 'valor': '3 níveis — genética, espécies, ecossistemas · ameaçada sobretudo por ação antrópica'},
            {'label': 'Conservação', 'valor': 'In situ (no habitat) e ex situ (fora do habitat)'},
            {'label': 'Célula', 'valor': 'Unidade estrutural e funcional · procariótica (sem núcleo) ou eucariótica (com núcleo)'},
            {'label': 'Moléculas da vida', 'valor': 'Água, glícidos, lípidos, proteínas e ácidos nucleicos — unidade química comum a todos os seres vivos'},
        ],
        'sintese_dica': (
            '*"Do átomo à biosfera, da célula à espécie — a vida organiza-se em camadas, e cada camada só '
            'existe porque a anterior a sustenta."*'
        ),
    },
}


@login_required(login_url='login')
def pagina_Resumos(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'Resumos.html', {
        'perfil': perfil,
        'resumos': RESUMOS,
    })


@login_required(login_url='login')
def pagina_resumo_detalhe(request, resumo_id):
    resumo = next((r for r in RESUMOS if r['id'] == resumo_id), None)
    conteudo = RESUMOS_CONTEUDO.get(resumo_id)
    if resumo is None or conteudo is None:
        raise Http404('Resumo não encontrado.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    return render(request, 'resumo-detalhe.html', {
        'perfil': perfil,
        'resumo': resumo,
        'conteudo': conteudo,
    })


def pagina_Conquistas(request):
    return render(request, 'Conquistas.html')


def pagina_about(request):
    return render(request, 'about.html')


@login_required(login_url='login')
def pagina_Configurações(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    return render(request, 'Configurações.html', {'perfil': perfil})


@login_required(login_url='login')
def pagina_superexplore(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'superexplore.html', {
        'perfil': perfil,
        'limite_chat_free': obter_limite_chat('free'),
        'limite_chat_pro': obter_limite_chat('pro'),
    })


def _cliente_stripe():
    return stripe.StripeClient(
        api_key=settings.STRIPE_SECRET_KEY,
        stripe_version=settings.STRIPE_API_VERSION,
    )


@login_required(login_url='login')
@require_POST
def iniciar_checkout_superexplore(request):
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    if perfil.plano == 'pro':
        return redirect('superexplore')

    url_base = request.build_absolute_uri(reverse('superexplore'))
    dados_sessao = {
        'mode': 'subscription',
        'line_items': [{'price': settings.STRIPE_PRICE_ID_PRO, 'quantity': 1}],
        'client_reference_id': str(request.user.id),
        'success_url': f'{url_base}?checkout=sucesso',
        'cancel_url': f'{url_base}?checkout=cancelado',
    }
    if perfil.stripe_customer_id:
        dados_sessao['customer'] = perfil.stripe_customer_id
    else:
        dados_sessao['customer_email'] = request.user.email

    try:
        sessao = _cliente_stripe().v1.checkout.sessions.create(dados_sessao)
    except stripe.StripeError:
        return redirect(f'{url_base}?checkout=erro')

    return redirect(sessao.url)


@login_required(login_url='login')
def gerir_subscricao(request):
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    if not perfil.stripe_customer_id:
        return redirect('superexplore')

    url_retorno = request.build_absolute_uri(reverse('superexplore'))
    try:
        sessao_portal = _cliente_stripe().v1.billing_portal.sessions.create({
            'customer': perfil.stripe_customer_id,
            'return_url': url_retorno,
        })
    except stripe.StripeError:
        return redirect('superexplore')

    return redirect(sessao_portal.url)


@csrf_exempt
@require_POST
def stripe_webhook(request):
    try:
        evento = stripe.Webhook.construct_event(
            request.body,
            request.META.get('HTTP_STRIPE_SIGNATURE', ''),
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.SignatureVerificationError):
        return HttpResponse(status=400)

    tipo = evento['type']
    dados = evento['data']['object']

    if tipo == 'checkout.session.completed' or (
        tipo == 'checkout.session.async_payment_succeeded'
        and dados.get('payment_status') == 'paid'
    ):
        utilizador_id = dados.get('client_reference_id')
        if utilizador_id:
            try:
                utilizador = User.objects.get(pk=utilizador_id)
            except User.DoesNotExist:
                utilizador = None
            if utilizador is not None:
                perfil, _ = PerfilAluno.objects.get_or_create(user=utilizador)
                perfil.stripe_customer_id = dados.get('customer', '') or perfil.stripe_customer_id
                perfil.stripe_subscription_id = dados.get('subscription', '') or perfil.stripe_subscription_id
                perfil.plano = 'pro'
                perfil.save(update_fields=['stripe_customer_id', 'stripe_subscription_id', 'plano'])

    elif tipo == 'customer.subscription.updated':
        perfil = PerfilAluno.objects.filter(stripe_customer_id=dados.get('customer')).first()
        if perfil is not None:
            perfil.stripe_subscription_id = dados.get('id', '') or perfil.stripe_subscription_id
            perfil.plano = 'pro' if dados.get('status') in ('active', 'trialing') else 'free'
            perfil.save(update_fields=['stripe_subscription_id', 'plano'])

    elif tipo == 'customer.subscription.deleted':
        perfil = PerfilAluno.objects.filter(stripe_customer_id=dados.get('customer')).first()
        if perfil is not None:
            perfil.plano = 'free'
            perfil.stripe_subscription_id = ''
            perfil.save(update_fields=['plano', 'stripe_subscription_id'])

    return HttpResponse(status=200)


def carregar_teste(teste_id):
    """Testes vivem fora de static/ de propósito: static/ é servido
    publicamente, e este ficheiro contém o gabarito — nunca deve chegar
    ao browser do aluno."""
    caminho_json = settings.BASE_DIR.parent / 'testes' / f'{teste_id}.json'
    with open(caminho_json, 'r', encoding='utf-8') as f:
        return json.load(f)


CHAVES_SECRETAS_PERGUNTA = (
    'resposta_correta', 'criterios_correcao', 'tolerancia_numerica',
    'palavras_chave', 'grupos_palavras_chave', 'minimo_grupos',
)


@login_required(login_url='login')
def pagina_teste_fotossintese(request, teste_id):
    config_teste = encontrar_config_teste(teste_id)
    if config_teste is None:
        raise Http404('Teste não encontrado.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    plano_aluno = perfil.plano if perfil is not None else 'free'
    if config_teste['plano'] == 'pro' and plano_aluno != 'pro':
        return redirect('superexplore')

    try:
        teste = carregar_teste(teste_id)
    except FileNotFoundError:
        raise Http404('Teste não encontrado.')

    # Nunca enviar o gabarito para o browser — a correção só acontece
    # no servidor, em corrigir_teste_fotossintese().
    perguntas_publicas = [
        {chave: valor for chave, valor in pergunta.items() if chave not in CHAVES_SECRETAS_PERGUNTA}
        for pergunta in teste['perguntas']
    ]

    progresso_guardado = {}
    if perfil is not None:
        progresso_testes = perfil.progresso_testes if isinstance(perfil.progresso_testes, dict) else {}
        entrada = progresso_testes.get(teste_id)
        if isinstance(entrada, dict) and isinstance(entrada.get('respostas'), dict):
            progresso_guardado = entrada['respostas']

    return render(request, 'teste-fotossintese.html', {
        'perfil': perfil,
        'teste': teste,
        'teste_id': teste_id,
        'perguntas': perguntas_publicas,
        'progresso_guardado': progresso_guardado,
    })


@login_required(login_url='login')
@require_POST
def guardar_progresso_teste(request):
    """Guarda um rascunho das respostas do aluno a meio do teste, para que
    possa fechar a página e continuar mais tarde de onde ficou — a correção
    em si só acontece quando ele submete (corrigir_teste_fotossintese)."""
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    teste_id = str(dados.get('testeId', '')).strip()
    respostas = dados.get('respostas')
    if not teste_id or not isinstance(respostas, dict):
        return JsonResponse({'erro': 'Teste ou respostas em falta.'}, status=400)

    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    progresso_testes = dict(perfil.progresso_testes or {})
    progresso_testes[teste_id] = {
        'respostas': respostas,
        'atualizado_em': timezone.now().isoformat(),
    }
    perfil.progresso_testes = progresso_testes
    perfil.save(update_fields=['progresso_testes'])

    return JsonResponse({'ok': True})


def normalizar_resposta(valor):
    return str(valor if valor is not None else '').strip().lower()


def normalizar_sem_acentos(valor):
    """Para correspondência por palavras-chave: minúsculas e sem
    acentuação, para "espécie" e "especie" contarem como a mesma palavra."""
    texto = normalizar_resposta(valor)
    sem_acentos = unicodedata.normalize('NFKD', texto)
    return ''.join(c for c in sem_acentos if not unicodedata.combining(c))


def extrair_numero(valor):
    texto = str(valor if valor is not None else '').replace(',', '.')
    encontrado = re.search(r'-?\d+(\.\d+)?', texto)
    return float(encontrado.group()) if encontrado else None


def corrigir_pergunta_automatica(pergunta, resposta_aluno):
    """Corrige tudo exceto resposta_longa — sem chamar nenhuma API. Itens
    com várias partes (correspondência, ordenação, completar texto,
    verdadeiro/falso) têm a cotação repartida em partes iguais."""
    tipo = pergunta['tipo']
    cotacao = pergunta['cotacao']
    correta = pergunta.get('resposta_correta')

    if tipo == 'escolha_multipla':
        return cotacao if normalizar_resposta(resposta_aluno) == normalizar_resposta(correta) else 0

    if tipo == 'correspondencia' or tipo == 'completar_texto' or tipo == 'verdadeiro_falso':
        if not isinstance(resposta_aluno, dict) or not correta:
            return 0
        pontos_por_parte = cotacao / len(correta)
        pontos = sum(
            pontos_por_parte
            for chave, valor_correto in correta.items()
            if normalizar_resposta(resposta_aluno.get(chave)) == normalizar_resposta(valor_correto)
        )
        return round(pontos, 2)

    if tipo == 'ordenacao':
        if not isinstance(resposta_aluno, list) or not correta:
            return 0
        pontos_por_parte = cotacao / len(correta)
        pontos = 0
        for indice, letra_correta in enumerate(correta):
            valor_aluno = resposta_aluno[indice] if indice < len(resposta_aluno) else None
            if normalizar_resposta(valor_aluno) == normalizar_resposta(letra_correta):
                pontos += pontos_por_parte
        return round(pontos, 2)

    if tipo == 'selecao_multipla':
        # Escolher N de várias afirmações (ex: "as três afirmações corretas") —
        # cotação tudo-ou-nada, sem meios pontos, tal como nos exames nacionais.
        if not isinstance(resposta_aluno, list) or not correta:
            return 0
        aluno_normalizado = {normalizar_resposta(v) for v in resposta_aluno}
        correta_normalizada = {normalizar_resposta(v) for v in correta}
        return cotacao if aluno_normalizado == correta_normalizada else 0

    if tipo == 'resposta_curta':
        modo = pergunta.get('modo_correcao')

        # Um único grupo de sinónimos aceitáveis — qualquer um dá cotação
        # inteira (ex: "bicarbonato" ou "CO2" para a mesma variável).
        if modo == 'palavras_chave':
            palavras = pergunta.get('palavras_chave') or []
            texto_aluno = normalizar_sem_acentos(resposta_aluno)
            acertou = any(normalizar_sem_acentos(palavra) in texto_aluno for palavra in palavras)
            return cotacao if acertou else 0

        # Vários grupos de sinónimos (cada grupo = uma variável/ideia
        # distinta); cotação proporcional a quantos grupos diferentes o
        # aluno referiu, até ao mínimo pedido no enunciado.
        if modo == 'grupos_multiplos':
            grupos = pergunta.get('grupos_palavras_chave') or []
            minimo = pergunta.get('minimo_grupos') or len(grupos) or 1
            texto_aluno = normalizar_sem_acentos(resposta_aluno)
            grupos_encontrados = sum(
                1 for grupo in grupos
                if any(normalizar_sem_acentos(palavra) in texto_aluno for palavra in grupo)
            )
            pontos = cotacao * min(grupos_encontrados, minimo) / minimo
            return round(pontos, 2)

        numero_correto = extrair_numero(correta)
        numero_aluno = extrair_numero(resposta_aluno)
        tolerancia = pergunta.get('tolerancia_numerica')
        if numero_correto is not None and numero_aluno is not None and tolerancia is not None:
            return cotacao if abs(numero_correto - numero_aluno) <= tolerancia else 0
        return cotacao if normalizar_resposta(resposta_aluno) == normalizar_resposta(correta) else 0

    return 0


def corrigir_perguntas_longas_com_ia(perguntas_longas):
    """Uma única chamada à Claude (Haiku) que corrige todas as perguntas de
    resposta_longa do teste de uma vez. Sem limite de uso — não passa por
    verificar_e_incrementar_uso_chat(), disponível para Free e Pro."""
    resultado = {}

    if not settings.ANTHROPIC_API_KEY:
        for pergunta, _ in perguntas_longas:
            resultado[pergunta['id']] = {
                'pontos': 0,
                'feedback': 'A correção automática desta pergunta ainda não está configurada.',
            }
        return resultado

    blocos_pedido = [
        (
            f"Pergunta \"{pergunta['id']}\" (cotação máxima: {pergunta['cotacao']} pontos)\n"
            f"Enunciado: {pergunta['enunciado']}\n"
            f"Critérios de correção: {pergunta['criterios_correcao']}\n"
            f"Resposta do aluno: {(resposta or '').strip() or '(sem resposta)'}"
        )
        for pergunta, resposta in perguntas_longas
    ]
    formato_json = ', '.join(
        f'"{pergunta["id"]}": {{"pontuacao": numero, "feedback": "texto"}}'
        for pergunta, _ in perguntas_longas
    )
    prompt = (
        "És um professor de Biologia do ensino secundário em Portugal a corrigir um teste. "
        "Para cada pergunta abaixo, atribui uma pontuação entre 0 e a cotação máxima indicada, "
        "com base em quão bem a resposta do aluno cobre os critérios de correção, e escreve um "
        "feedback curto (1 a 2 frases, em português de Portugal) sobre o que está bem ou o que falta.\n\n"
        + "\n\n---\n\n".join(blocos_pedido)
        + "\n\nResponde APENAS com um objeto JSON válido, sem texto antes ou depois, no formato exato:\n"
        + "{" + formato_json + "}"
    )

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        texto_resposta = next((bloco.text for bloco in response.content if bloco.type == 'text'), '{}')
        correcao_ia = json.loads(texto_resposta)
    except (anthropic.RateLimitError, anthropic.APIStatusError, anthropic.APIConnectionError, ValueError, TypeError):
        correcao_ia = {}

    for pergunta, _ in perguntas_longas:
        item = correcao_ia.get(pergunta['id']) if isinstance(correcao_ia, dict) else None
        if isinstance(item, dict) and isinstance(item.get('pontuacao'), (int, float)):
            pontos = max(0.0, min(float(pergunta['cotacao']), float(item['pontuacao'])))
            feedback = str(item.get('feedback', ''))[:500]
        else:
            pontos = 0
            feedback = 'Não foi possível obter a correção da IA para esta pergunta. Tenta submeter novamente.'
        resultado[pergunta['id']] = {'pontos': pontos, 'feedback': feedback}

    return resultado


@login_required(login_url='login')
@require_POST
def corrigir_teste_fotossintese(request, teste_id):
    config_teste = encontrar_config_teste(teste_id)
    if config_teste is None:
        raise Http404('Teste não encontrado.')

    try:
        perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    plano_aluno = perfil.plano if perfil is not None else 'free'
    if config_teste['plano'] == 'pro' and plano_aluno != 'pro':
        return JsonResponse({'erro': 'Este teste está disponível apenas no plano SuperExplore.'}, status=403)

    try:
        dados_pedido = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    respostas_aluno = dados_pedido.get('respostas')
    if not isinstance(respostas_aluno, dict):
        return JsonResponse({'erro': 'Respostas em falta.'}, status=400)

    try:
        teste = carregar_teste(teste_id)
    except FileNotFoundError:
        raise Http404('Teste não encontrado.')

    resultado_perguntas = {}
    pontos_totais = 0.0
    perguntas_longas = []

    for pergunta in teste['perguntas']:
        resposta = respostas_aluno.get(pergunta['id'])
        if pergunta['tipo'] == 'resposta_longa':
            perguntas_longas.append((pergunta, resposta))
            continue
        pontos = corrigir_pergunta_automatica(pergunta, resposta)
        pontos_totais += pontos
        resultado_perguntas[pergunta['id']] = {'pontos': pontos, 'cotacao': pergunta['cotacao']}

    feedback_ia = {}
    if perguntas_longas:
        correcao_ia = corrigir_perguntas_longas_com_ia(perguntas_longas)
        for pergunta, _ in perguntas_longas:
            item = correcao_ia.get(pergunta['id'], {'pontos': 0, 'feedback': ''})
            resultado_perguntas[pergunta['id']] = {'pontos': item['pontos'], 'cotacao': pergunta['cotacao']}
            feedback_ia[pergunta['id']] = item['feedback']
            pontos_totais += item['pontos']

    nota_final = round(pontos_totais / (teste['cotacao_total'] / 20), 1)

    # O teste já foi corrigido — o rascunho de respostas em curso deixa de
    # fazer sentido (evita reaparecer pré-preenchido se o aluno repetir o
    # teste mais tarde).
    if perfil is not None:
        progresso_testes = dict(perfil.progresso_testes or {})
        if progresso_testes.pop(teste_id, None) is not None:
            perfil.progresso_testes = progresso_testes
            perfil.save(update_fields=['progresso_testes'])

    return JsonResponse({
        'notaFinal': nota_final,
        'pontosTotais': round(pontos_totais, 2),
        'cotacaoTotal': teste['cotacao_total'],
        'perguntas': resultado_perguntas,
        'feedbackIA': feedback_ia,
    })


def pagina_conteudo(request):
    caminho_json = settings.BASE_DIR.parent / 'static' / 'conteudo.json'

    with open(caminho_json, 'r', encoding='utf-8') as f:
        dados = json.load(f)

    return render(request, 'mission.html', {'conteudo': dados})