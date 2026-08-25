"""
URL configuration for meu_site project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from . import views  # Importa o ficheiro views que criaste

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.pagina_inicial, name='pagina_inicial'),  # Rota para a tua página inicial
    path('login/', views.pagina_login, name='login'),
    path('signup/', views.pagina_signup, name='signup'),
    path('perfil/', views.pagina_perfil, name='perfil'),
    path('missions/', views.pagina_index_missions, name='index-missions'),
    path('dashboard/', views.pagina_dashboard, name='dashboard'),
    path('lesson/', views.pagina_lesson, name='lesson'),
    path('Testes/', views.pagina_Testes, name='Testes'),
    path('dicionario/', views.pagina_dicionario, name='dicionario'),
    path('Resumos/', views.pagina_Resumos, name='Resumos'),
    path('Conquistas/', views.pagina_Conquistas, name='Conquistas'),
    path('about/', views.pagina_about, name='about'),
    path('Configurações/', views.pagina_Configurações, name='Configurações'),
    path('logout/', views.pagina_logout, name='logout'),
    path('conteudo/', views.pagina_conteudo, name='conteudo'),
    path('mission/', views.pagina_mission, name='mission'),
    path('mission/photosynthesis/', views.pagina_mission_photosynthesis, name='mission-photosynthesis'),
    path('mission/photosynthesis/goldtest/', views.pagina_mission_photosynthesis_goldtest, name='mission-photosynthesis-goldtest'),
    path('api/progresso-missao/', views.salvar_progresso_missao, name='salvar-progresso-missao'),
]

urlpatterns += staticfiles_urlpatterns()