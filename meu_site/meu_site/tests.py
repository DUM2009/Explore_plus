import json
from types import SimpleNamespace
from unittest import mock

import anthropic
import httpx2 as httpx
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse

from . import views
from .models import PerfilAluno


def _resposta(texto):
    return SimpleNamespace(
        content=[SimpleNamespace(type='text', text=texto)],
        usage=SimpleNamespace(input_tokens=10, output_tokens=5),
    )


class _Stream:
    def __init__(self, pedacos, erro=None):
        self.pedacos, self.erro = pedacos, erro
        self.text_stream = self._gerar()

    def _gerar(self):
        for p in self.pedacos:
            yield p
        if self.erro:
            raise self.erro

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get_final_message(self):
        return _resposta(''.join(self.pedacos))


def _timeout():
    return anthropic.APITimeoutError(request=httpx.Request('POST', 'https://api.anthropic.com'))


@override_settings(ANTHROPIC_API_KEY='teste', ANTHROPIC_MODEL='modelo-teste')
class MascoteChatTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('aluno', password='x')
        self.client.force_login(self.user)
        self.url = reverse('mascote-chat')

    def _post(self, **extra):
        corpo = {'message': 'O que é o ADN?', 'history': [], **extra}
        return self.client.post(self.url, json.dumps(corpo), content_type='application/json')

    def _usadas(self):
        return PerfilAluno.objects.get(user=self.user).uso_chat_semana.get('perguntas', 0)

    @mock.patch('time.sleep')
    @mock.patch.object(views.anthropic, 'Anthropic')
    def test_sem_streaming_tenta_de_novo_uma_vez(self, anthropic_cls, _sleep):
        anthropic_cls.return_value.messages.create.side_effect = [_timeout(), _resposta('Boa!')]
        r = self._post()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['reply'], 'Boa!')
        self.assertEqual(anthropic_cls.return_value.messages.create.call_count, 2)

    @mock.patch('time.sleep')
    @mock.patch.object(views.anthropic, 'Anthropic')
    def test_sem_streaming_mensagem_simpatica_e_devolve_pergunta(self, anthropic_cls, _sleep):
        anthropic_cls.return_value.messages.create.side_effect = [_timeout(), _timeout()]
        r = self._post()
        self.assertEqual(r.status_code, 504)
        self.assertIn('pensar demais', r.json()['erro'])
        self.assertEqual(self._usadas(), 0)

    @mock.patch.object(views.anthropic, 'Anthropic')
    def test_streaming_envia_pedacos_e_guarda_conversa(self, anthropic_cls):
        anthropic_cls.return_value.messages.stream.return_value = _Stream(['Olá', ', aluno!'])
        r = self._post(stream=True)
        self.assertEqual(r['Content-Type'], 'application/x-ndjson')
        eventos = [json.loads(l) for l in b''.join(r.streaming_content).decode().splitlines()]
        self.assertEqual([e['t'] for e in eventos], ['delta', 'delta', 'done'])
        self.assertEqual(eventos[-1]['reply'], 'Olá, aluno!')
        self.assertEqual(self._usadas(), 1)

    @mock.patch('time.sleep')
    @mock.patch.object(views.anthropic, 'Anthropic')
    def test_streaming_tenta_de_novo_se_falha_antes_do_texto(self, anthropic_cls, _sleep):
        anthropic_cls.return_value.messages.stream.side_effect = [
            _Stream([], erro=_timeout()), _Stream(['Boa!']),
        ]
        r = self._post(stream=True)
        eventos = [json.loads(l) for l in b''.join(r.streaming_content).decode().splitlines()]
        self.assertEqual(eventos[-1]['t'], 'done')
        self.assertEqual(eventos[-1]['reply'], 'Boa!')

    @mock.patch('time.sleep')
    @mock.patch.object(views.anthropic, 'Anthropic')
    def test_streaming_erro_a_meio_nao_repete_texto(self, anthropic_cls, _sleep):
        anthropic_cls.return_value.messages.stream.return_value = _Stream(['Olá'], erro=_timeout())
        r = self._post(stream=True)
        eventos = [json.loads(l) for l in b''.join(r.streaming_content).decode().splitlines()]
        self.assertEqual([e['t'] for e in eventos], ['delta', 'erro'])
        self.assertIn('pensar demais', eventos[-1]['erro'])
        self.assertEqual(anthropic_cls.return_value.messages.stream.call_count, 1)
        self.assertEqual(self._usadas(), 0)

    @mock.patch.object(views.anthropic, 'Anthropic')
    def test_historico_limitado_e_comeca_no_aluno(self, anthropic_cls):
        anthropic_cls.return_value.messages.create.return_value = _resposta('ok')
        historico = []
        for i in range(10):
            historico.append({'role': 'user', 'text': f'p{i}'})
            historico.append({'role': 'assistant', 'text': f'r{i}'})
        self._post(history=historico, context='x' * 10000)
        enviado = anthropic_cls.return_value.messages.create.call_args.kwargs
        msgs = enviado['messages']
        self.assertLessEqual(len(msgs), 6 + 1)
        self.assertEqual(msgs[0]['role'], 'user')
        self.assertLessEqual(len(enviado['system'][0]['text']), 3000 + 4000)


@override_settings(STORAGES={
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
})
class EstatisticasProTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('aluno2', password='x')
        self.client.force_login(self.user)
        self.perfil, _ = PerfilAluno.objects.get_or_create(user=self.user)

    def test_gratuito_ve_separador_bloqueado_e_nao_abre_a_pagina(self):
        r = self.client.get(reverse('perfil'))
        self.assertContains(r, 'profile-tab--pro is-locked')
        self.assertContains(r, 'profile-tab-lock')
        r = self.client.get(reverse('estatisticas'))
        self.assertRedirects(r, reverse('superexplore'), fetch_redirect_response=False)

    def test_pro_ve_separador_sem_cadeado_e_abre_a_pagina(self):
        self.perfil.plano = 'pro'
        self.perfil.save()
        r = self.client.get(reverse('perfil'))
        self.assertContains(r, 'profile-tab--pro')
        self.assertNotContains(r, 'profile-tab--pro is-locked')
        self.assertEqual(self.client.get(reverse('estatisticas')).status_code, 200)


@override_settings(
    BREVO_API_KEY='k', DEFAULT_FROM_EMAIL='nao-responder@exploremore.pt',
    EMAIL_REPLY_TO='exploremore.pt26@gmail.com', SITE_URL='https://exploremore.pt',
    STORAGES={
        'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    },
)
class EmailRecuperacaoTests(TestCase):
    def _enviar(self, **dados_user):
        User.objects.create_user('aluno3', email='a@b.pt', password='x', **dados_user)
        with mock.patch.object(views.requests, 'post') as post:
            post.return_value.ok = True
            self.client.post(reverse('recuperar-password'), {'email': 'a@b.pt'})
        return post.call_args.kwargs['json']

    def test_email_formal_com_primeiro_nome(self):
        p = self._enviar(first_name='Maria Joana')
        self.assertEqual(p['subject'], 'Pedido de recuperação da palavra-passe — Explore+')
        self.assertEqual(p['sender'], {'email': 'nao-responder@exploremore.pt', 'name': 'Explore+'})
        self.assertEqual(p['replyTo']['email'], 'exploremore.pt26@gmail.com')
        self.assertTrue(p['textContent'].startswith('Caro/a Maria,'))
        self.assertIn('Definir nova palavra-passe', p['htmlContent'])
        self.assertIn('Explore+', p['htmlContent'])
        link = [l for l in p['textContent'].split() if l.startswith('https://exploremore.pt/')][0]
        self.assertIn('/redefinir-password/', link)
        self.assertIn(link, p['htmlContent'])
        texto_sem_link = p['textContent'].replace(link, '')
        for proibido in (' tu ', 'você', 'Clica', 'password'):
            self.assertNotIn(proibido, texto_sem_link)

    def test_sem_nome(self):
        p = self._enviar()
        self.assertTrue(p['textContent'].startswith('Caro/a utilizador/a,'))
