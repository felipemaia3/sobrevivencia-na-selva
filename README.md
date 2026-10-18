# Sobrevivência na Floresta

Jogo 2D de sobrevivência em mundo aberto, pixel art, rodando inteiramente no navegador.
Inspirado na imagem de referência: floresta tropical chuvosa, rio ao fundo, fogueira com
fumaceiro, explorador de mochila, capivaras, tucanos e interface em português brasileiro.

Todo o arte e todo o áudio são **gerados por código** em tempo de execução — não há PNG,
MP3 ou motor de terceiros além do Phaser 3 (incluído localmente em `vendor/`).

---

## 1. Executar localmente

### Opção A — abrir o arquivo (mais simples)
1. Dê dois cliques em `index.html`.
2. O jogo abre no navegador (Chrome, Edge, Firefox ou Safari) e funciona até offline.

### Opção B — servidor local (recomendado)
Qualquer Node.js 16+ serve. O script `tools/serve.js` é um servidor estático de 30 linhas:

```bash
node tools/serve.js 8080
# -> Jogo em http://localhost:8080
```

Alternativas equivalentes:

```bash
npx serve .
python -m http.server 8080
```

Não há etapa de compilação, `npm install`, bundler ou variável de ambiente.

### Primeiro acesso
O navegador bloqueia áudio até o primeiro clique/toque — por isso o som liga sozinho assim
que você interage com o jogo. O uso de áudio pode ser desligado no menu de pausa (`Esc`).

---

## 2. Publicar na internet

O projeto é 100% estático: qualquer hospedagem que sirva `index.html` funciona.

**GitHub Pages**
```bash
git init && git add . && git commit -m "Sobrevivência na Floresta"
git branch -M main && git remote add origin <url-do-repositorio> && git push -u origin main
```
Depois, em *Settings → Pages*, escolha a branch `main` / pasta `/ (root)` e salve.

**Netlify / Vercel / Cloudflare Pages** — arraste a pasta do projeto no painel de deploy
(build command: vazio, publish directory: `/`). Nenhuma configuração é necessária.

**Hospedagem comum (cPanel, S3, nginx)** — envie o conteúdo da pasta mantendo a estrutura:

```
index.html
styles.css
vendor/phaser.min.js
src/...
```

---

## 3. Controles

| Tecla | Ação |
|---|---|
| `W A S D` / setas | Mover |
| `Shift` | Correr (gasta mais energia e água) |
| `E` | Coletar / encher o cantil / acender e alimentar o fogo / descansar / dormir |
| `Clique esquerdo` | Golpear com a ferramenta equipada · posicionar construção |
| `Espaço` | Esquiva (invulnerabilidade curta, custa energia) |
| `1` – `6` | Selecionar item da barra rápida |
| `Tab` ou `I` | Inventário completo (clique duplo = usar) |
| `C` | Bancada de fabricação |
| `Esc` | Pausar / retomar, volume, música, controles de toque, ajuda |

**Celular / tablet:** o joystick virtual e os botões de ação aparecem automaticamente em
telas sensíveis ao toque (e podem ser forçados no menu de pausa). Eles são posicionados
nas bordas e nunca cobrem os indicadores de sobrevivência.

---

## 4. O que está implementado

**Sobrevivência** (`src/systems/sim.js`) — vida, fome, sede, energia, temperatura ambiente
e temperatura corporal. Roupa molhada, hora do dia e clima puxam a temperatura para baixo;
ficar perto da fogueira acesa ou abrigado aquece e recupera energia. Fome/sede zeradas e
hipotermia abaixo de 34 °C tiram vida. Um dia completo dura 12 minutos reais.

**Clima** — sol, nublado, chuva e tempestade, com transições encadeadas, chuva diagonal
desenhada pixel a pixel, respingos no chão, poças nas texturas do terreno, relâmpagos com
flash e trovão.

**Mundo aberto** — mapa de 2400 × 1800 px gerado por ruído com semente fixa por partida:
rio na parte de cima com as duas margens, açude, clareira do acampamento, árvores gigantes
com raízes expostas, palmeiras, samambaias, cipós, cogumelos, pedras, troncos, capim,
vitórias-d'água. O terreno é assado em *chunks* de 400 px conforme a câmera explora, com
detalhes de solo alinhados em grade global (sem emendas visíveis). Colisões com árvores,
pedras, construções e água funda.

**Fauna** — capivaras que pastam, fogem do jogador e podem ser caçadas com lança; tucanos
pousados que alçam voo em bandos na forma de "V"; borboletas de dia.

**Ferramentas e fabricação** (`src/data/recipes.js`) — 16 receitas em quatro abas
(Ferramentas, Construção, Fogueira, Materiais), com durabilidade, reparo, estação de
trabalho (`mão` ou `fogueira acesa por perto`) e progressão: machado de pedra, lança,
corda, cantil, machado de sílex, fogueira, abrigo, parede, cama, tocha, carne cozida,
água fervida, refogado de cogumelos.

**Construções** — posicione com um fantasma que mostra em verde/vermelho se o local é
válido. A fogueira consome lenha, apaga sozinha, ilumina a noite, cozinha e seca a roupa;
o abrigo protege da chuva e permite descansar; a cama permite dormir até o amanhecer;
a parede bloqueia animais.

**Iluminação dinâmica** — máscara em `CanvasTexture` com recortes radiais para a luz da
fogueira, da tocha equipada e do acampamento, mais uma passada aditiva quente; a noite
escurece a cena inteira e a tempestade reduz a claridade ambiente.

**Missões** — sequência de 8 objetivos em português com contador de progresso no painel
superior direito; concluídos, avançam sozinhos e terminam no modo livre.

**Áudio** — sintetizado com WebAudio: chuva, trovão, crepitar da fogueira, passos por
tipo de terreno (grama, lama, areia, madeira), golpe de machado, coleta, pássaros, UI e
uma trilha ambiente generativa, cada grupo com volume próprio e botão de mudo.

**Persistência** — `localStorage` com autosave a cada 25 s, salvamento ao pausar, ao
morrer e ao fechar a aba. "Continuar" no menu restaura posição, inventário, construções,
clima, relógio e missões.

---

## 5. Estrutura do código

```
index.html            ordem de carregamento dos scripts (sem módulos, roda em file://)
styles.css            tela de carregamento e moldura do canvas
vendor/phaser.min.js  Phaser 3.80.1 local
tools/serve.js        servidor estático opcional

src/core/utils.js     matemática, ruído value-noise/fbm, rng, paleta e cores
src/core/pixel.js     SV.P: buffer ImageData (pixel, linha, disco, blob, contorno)
src/core/art_props.js terreno em chunks, vegetação, pedras, troncos, construções
src/core/art_entities explorador (todas as animações), capivara, tucano, partículas
src/core/world.js     geração do mundo: rio, margens, açude, acampamento, props
src/core/audio.js     síntese WebAudio: efeitos, ambiência e música
src/core/save.js      serialização do estado em localStorage

src/data/items.js     definição de itens, pilhas, durabilidade, ícones
src/data/recipes.js   receitas + regras de desbloqueio

src/systems/inventory.js  slots, hotbar de 6, pilhas, reparo, serializar
src/systems/sim.js        relógio, clima, temperatura, fome/sede/energia/vida
src/systems/missions.js   cadeia de missões e progresso

src/scenes/BootScene.js   gera todas as texturas pixel a pixel
src/scenes/MenuScene.js   menu com fundo pintado com o mesmo motor do jogo
src/scenes/GameScene.js   mundo, jogador, câmera, colisões, Interações, clima, luz
src/scenes/UiScene.js     HUD, hotbar, inventário, fabricação, pausa, ajuda, morte
src/main.js               configuração do Phaser
```

A separação lógica × renderização é respeitada: `sim.js`, `inventory.js`, `missions.js`,
`world.js`, `items.js` e `recipes.js` não tocam em Phaser e podem ser testados isolados.
As cenas apenas leem o estado e desenham.

### Como estender
- **Novo recurso coletável:** adicione o tipo em `SV.World.TYPES` (`world.js`) e o item em
  `items.js`; a coleta, o prompt e a missão já funcionam por nome de item.
- **Nova receita:** um objeto em `SV.Recipes` (`recipes.js`) com `out`, `cost`, `station`
  e `unlock`. A aba, o ícone e a validação vêm sozinhos.
- **Nova construção:** item `buildable` com `build`, caso em `addStructure()` e texto em
  `updateStructurePrompt()`.
- **Nova missão:** entrada em `SV.Missions.list` com `goal` (chave usada por
  `missionEvent`) — a HUD se atualiza pela lista.
- **Ajuste de dificuldade:** as constantes de consumo estão em `Sim.prototype.update`.

---

## 6. Notas de desempenho e compatibilidade

- Renderização `Phaser.AUTO` (WebGL com fallback para Canvas), `pixelArt: true` e
  `roundPixels: true` para manter os pixels nítidos em qualquer resolução.
- `Scale.RESIZE` + zoom proporcional à altura: a mesma construção preenche do celular ao
  monitor grande; a escala da interface (`SV.Game.uiScale`) acompanha.
- Texturas de terreno são geradas sob demanda em uma fila (no máximo alguns chunks por
  quadro) para não travar a exploração.
- Testado em Chrome/Edge desktop e em viewport de celular (390 × 720) com controles de
  toque.
