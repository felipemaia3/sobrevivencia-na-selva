
(function (SV) {
  'use strict';

  function start() {
    var host = document.getElementById('game');
    var config = {
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: '#16241c',
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      fps: { target: 60, forceSetTimeOut: false },
      fps: { target: 60, forceSetTimeOut: !!document.hidden },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: host.clientWidth || window.innerWidth,
        height: host.clientHeight || window.innerHeight
      },
      scene: [SV.BootScene, SV.MenuScene, SV.GameScene, SV.UiScene]
    };

    /* espera o navegador pintar a tela de carregamento antes de gerar a arte */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        SV.game = new Phaser.Game(config);
      });
    });
    /* Espera o navegador pintar a tela de carregamento antes de gerar a arte.
       O requestAnimationFrame não dispara em aba em segundo plano (link aberto
       em outra aba, celular com a tela bloqueada), então há um fallback por
       tempo e uma guarda para iniciar uma única vez. */
    var iniciado = false;
    function boot() {
      if (iniciado) return;
      if (!window.Phaser) { falha('O Phaser (vendor/phaser.min.js) não foi carregado. Verifique se a pasta vendor/ está no servidor.'); return; }
      iniciado = true;
      SV.game = new Phaser.Game(config);
    }
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(boot); });
      setTimeout(boot, 1200);
    } else {
      boot();
    }

    SV.hideLoader = function () { document.body.classList.add('pronto'); };

    /** Mostra o problema na própria tela de carregamento em vez de girar para sempre. */
    function falha(msg) {
      var caixa = document.querySelector('#carregando .caixa');
      if (!caixa) return;
      caixa.querySelector('.barra').style.display = 'none';
      var p = caixa.querySelector('p');
      p.innerHTML = '<span style="color:#ff9a8a">Não foi possível iniciar:</span><br>' + msg +
        '<br><small style="color:#7fa28c">Abra o console (F12) para mais detalhes.</small>';
    }
    window.addEventListener('error', function (e) {
      if (iniciado || !e || !e.target) return;
      var t = e.target;
      if (t.tagName === 'SCRIPT' || t.tagName === 'LINK') {
        falha('Arquivo não encontrado: <b>' + (t.src || t.href) + '</b>. Confira se todos os arquivos e pastas ' +
          '(<b>src/</b>, <b>vendor/</b>, <b>styles.css</b>) foram enviados e se os nomes estão com as mesmas maiúsculas.');
      }
    }, true);

    /* impede que Tab e setas rolem a página */
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' || (e.key && e.key.indexOf('Arrow') === 0)) e.preventDefault();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.SV);
