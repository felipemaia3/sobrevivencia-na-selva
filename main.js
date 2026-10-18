/*
 * main.js — ponto de entrada: monta o config do Phaser e inicia o jogo.
 * As cenas são: Boot (gera a arte) -> Menu -> Game (+ Ui sobreposta).
 */
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

    SV.hideLoader = function () { document.body.classList.add('pronto'); };

    /* impede que Tab e setas rolem a página */
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' || (e.key && e.key.indexOf('Arrow') === 0)) e.preventDefault();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.SV);
