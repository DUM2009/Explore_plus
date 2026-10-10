from django.conf import settings


def constantes_do_site(request):
    """Disponibiliza em todos os templates constantes do site (ver
    settings.py) sem ter de as passar explicitamente em cada view — usado
    por exemplo no link "Suporte" do menu da conta ({{ EMAIL_SUPORTE }})."""
    return {
        'EMAIL_SUPORTE': settings.EMAIL_SUPORTE,
    }
