import re

from django import template
from django.utils.html import escape
from django.utils.safestring import mark_safe

register = template.Library()

_BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
_ITALIC_RE = re.compile(r'\*(.+?)\*')


@register.filter(name='md_inline')
def md_inline(value):
    """Renderiza **negrito** e *itálico* nos textos dos resumos (conteúdo
    interno, escrito por nós — não input de utilizadores)."""
    if not value:
        return ''
    texto = escape(str(value))
    texto = _BOLD_RE.sub(r'<strong>\1</strong>', texto)
    texto = _ITALIC_RE.sub(r'<em>\1</em>', texto)
    return mark_safe(texto)
