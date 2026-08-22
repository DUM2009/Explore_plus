from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User

def pagina_inicial(request):
    return render(request, 'index.html')

def pagina_perfil(request):
    return render(request, 'perfil.html')

def pagina_login(request):
    # Se o utilizador já fez login e tenta entrar na página de login, vai direto para o perfil
    if request.user.is_authenticated:
        return redirect('/perfil/')
        
    if request.method == 'POST':
        email_digitado = request.POST.get('email')  
        password_digitada = request.POST.get('password')
        
        try:
            user_obj = User.objects.get(email=email_digitado)
            username_aluno = user_obj.username
        except User.DoesNotExist:
            username_aluno = email_digitado
        
        user = authenticate(request, username=username_aluno, password=password_digitada)
        
        if user is not None:
            login(request, user)
            return redirect('/perfil/')
        else:
            return render(request, 'login.html', {'erro': 'Credenciais incorretas! Tenta novamente.'})
            
    return render(request, 'login.html')
