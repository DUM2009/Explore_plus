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
    path('onboarding/', views.pagina_onboarding, name='onboarding'),
    path('missions/', views.pagina_index_missions, name='index-missions'),
    path('dashboard/', views.pagina_dashboard, name='dashboard'),
    path('lesson/', views.pagina_lesson, name='lesson'),
    path('Testes/', views.pagina_Testes, name='Testes'),
    path('exames/', views.pagina_exames, name='exames'),
    path('biblioteca/', views.pagina_biblioteca, name='biblioteca'),
    path('biblioteca/<str:unidade_id>/', views.pagina_biblioteca_unidade, name='biblioteca-unidade'),
    path('flashcards/<str:missao_id>/', views.pagina_flashcards, name='flashcards'),
    path('api/atualizar-vocabulario/<str:missao_id>/', views.atualizar_vocabulario, name='atualizar-vocabulario'),
    path('Resumos/', views.pagina_Resumos, name='Resumos'),
    path('Resumos/<str:resumo_id>/', views.pagina_resumo_detalhe, name='resumo-detalhe'),
    path('Conquistas/', views.pagina_Conquistas, name='Conquistas'),
    path('about/', views.pagina_about, name='about'),
    path('Configurações/', views.pagina_Configurações, name='Configurações'),
    path('superexplore/', views.pagina_superexplore, name='superexplore'),
    path('testes/fotossintese/<str:teste_id>/', views.pagina_teste_fotossintese, name='teste-fotossintese'),
    path('api/testes/<str:teste_id>/corrigir/', views.corrigir_teste_fotossintese, name='corrigir-teste-fotossintese'),
    path('api/guardar-progresso-teste/', views.guardar_progresso_teste, name='guardar-progresso-teste'),
    path('logout/', views.pagina_logout, name='logout'),
    path('conteudo/', views.pagina_conteudo, name='conteudo'),
    path('mission/', views.pagina_mission, name='mission'),
    path('mission/photosynthesis/', views.pagina_mission_photosynthesis, name='mission-photosynthesis'),
    path('mission/photosynthesis/goldtest/', views.pagina_mission_photosynthesis_goldtest, name='mission-photosynthesis-goldtest'),
    path('api/progresso-missao/', views.salvar_progresso_missao, name='salvar-progresso-missao'),
    path('api/pergunta-errada/', views.registar_pergunta_errada, name='registar-pergunta-errada'),
    path('api/mascote-chat/', views.mascote_chat, name='mascote-chat'),
]

urlpatterns += staticfiles_urlpatterns()