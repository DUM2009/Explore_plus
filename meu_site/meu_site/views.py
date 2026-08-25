import json
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.db import OperationalError
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.views.decorators.http import require_POST
from .models import PerfilAluno


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
    return render(request, 'perfil.html', {
        'perfil': perfil,
        'nivel': perfil.nivel,
        'xp': perfil.pontos_xp,
        'xp_progress_percent': perfil.pontos_xp % 100,
        'proximo_nivel_xp': (perfil.nivel + 1) * 100,
        'progresso_missoes': progresso,
        'progresso_medio': round(sum(percentagens) / len(percentagens)),
        'missoes_completas': sum(1 for percentagem in percentagens if percentagem >= 100),
        'conquistas': badges,
        'total_conquistas': sum(1 for desbloqueada in badges.values() if desbloqueada),
    })


def pagina_login(request):
    # Se o utilizador já estiver autenticado, vai para a página inicial ou perfil
    if request.user.is_authenticated:
        return redirect('pagina_inicial')  # Ajuste para o 'name' da sua rota inicial

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
                return redirect('perfil')
            else:
                erro = "E-mail/Utilizador ou palavra-passe incorretos!"
        else:
            erro = "Preencha todos os campos!"

    return render(request, 'login.html', {'erro': erro})


def pagina_signup(request):
    if request.user.is_authenticated:
        return redirect('perfil')

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
            return redirect('perfil')

    return render(request, 'signup.html', {'erro': erro})


def pagina_logout(request):
    logout(request)
    return redirect('login')


@login_required(login_url='login')
def pagina_index_missions(request):
    return render(request, 'index-missions.html')


@login_required(login_url='login')
def pagina_lesson(request):
    return render(request, 'lesson.html')


def pagina_dashboard(request):
    return render(request, 'dashboard.html')


@login_required(login_url='login')
def pagina_mission_photosynthesis(request):
    return render(request, 'mission-photosynthesis.html')


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

    xp = dados.get('xp')
    if isinstance(xp, (int, float)) and xp >= 0:
        perfil.pontos_xp = max(perfil.pontos_xp, int(xp))
        perfil.nivel = perfil.pontos_xp // 100
        update_fields.extend(['pontos_xp', 'nivel'])

    perfil.save(update_fields=update_fields)

    return JsonResponse({
        'ok': True,
        'missionId': mission_id,
        'percent': percentage,
        'xp': perfil.pontos_xp,
        'level': perfil.nivel,
    })


def pagina_Testes(request):
    return render(request, 'Testes.html')


def pagina_dicionario(request):
    return render(request, 'dicionario.html')


def pagina_Resumos(request):
    return render(request, 'Resumos.html')


def pagina_Conquistas(request):
    return render(request, 'Conquistas.html')


def pagina_about(request):
    return render(request, 'about.html')


def pagina_Configurações(request):
    return render(request, 'Configurações.html')


def pagina_conteudo(request):
    caminho_json = settings.BASE_DIR.parent / 'static' / 'conteudo.json'

    with open(caminho_json, 'r', encoding='utf-8') as f:
        dados = json.load(f)

    return render(request, 'mission.html', {'conteudo': dados})