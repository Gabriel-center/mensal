// Configuração das landing pages. Edite antes de publicar.
window.MENSALINHA = {
  // Seu WhatsApp com DDI e DDD, só números (ex.: '5519999991234').
  // Enquanto estiver vazio, os botões "Falar no WhatsApp" ficam escondidos.
  whatsapp: '',
  precoMensal: 'R$ 19',
  precoUnico: 'R$ 97',
};

// Aplica a configuração na página.
document.addEventListener('DOMContentLoaded', function () {
  var cfg = window.MENSALINHA || {};
  document.querySelectorAll('[data-wa]').forEach(function (a) {
    var num = String(cfg.whatsapp || '').replace(/\D/g, '');
    if (!num) { a.style.display = 'none'; return; }
    a.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(a.getAttribute('data-wa'));
    a.target = '_blank'; a.rel = 'noopener';
  });
  document.querySelectorAll('[data-preco]').forEach(function (el) {
    el.textContent = el.getAttribute('data-preco') === 'unico' ? cfg.precoUnico : cfg.precoMensal;
  });
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
});
