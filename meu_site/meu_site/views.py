import json
import re
import unicodedata
import anthropic
from django.conf import settings
from django.http import JsonResponse, Http404
from django.shortcuts import render, redirect
from django.urls import reverse
from django.db import OperationalError
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
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
    return render(request, 'index-missions.html', {'perfil': perfil})


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
    {
        'categoria': 'Botânica',
        'titulo': 'Fotossíntese',
        'meta': ['Grupos I, II e III', '14-16 perguntas', '45 minutos'],
        'correcao': 'Correção automática e por IA.',
        'testes': [
            {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': 'fotossintese'},
            {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': 'fotossintese-c4-milho'},
            {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': 'fotossintese-cam-opuntia'},
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


@login_required(login_url='login')
def pagina_exames(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'exames.html', {'perfil': perfil})


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


def pagina_Configurações(request):
    return render(request, 'Configurações.html')


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