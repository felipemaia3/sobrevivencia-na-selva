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
| `E` | Coletar · encher o cantil · lançar e recolher a linha de pesca · acender e alimentar o fogo · descansar · dormir |
| `Clique esquerdo` | Golpear com a ferramenta equipada · posicionar construção |
| `Espaço` | Esquiva (invulnerabilidade curta, custa energia) |
| `1` – `6` | Selecionar item da barra rápida |
| `Tab` ou `I` | Inventário completo (clique duplo = usar) |
| `C` | Bancada de fabricação |
| `Esc` | Pausar / retomar, volume, música, controles de toque, ajuda |

**Celular / tablet:** o joystick virtual e os botões de ação aparecem automaticamente em
telas sensíveis ao toque (e podem ser forçados no menu de pausa). Nesse modo a barra rápida
se acomoda na faixa que sobra à esquerda e o joystick sobe, para nada cobrir — nem ficar
embaixo — dos indicadores de sobrevivência.

---

## 4. O que está implementado

**Sobrevivência** (`src/systems/sim.js`) — vida, fome, sede, energia, temperatura ambiente
e temperatura corporal. Roupa molhada, hora do dia e clima puxam a temperatura para baixo;
ficar perto da fogueira acesa ou abrigado aquece e recupera energia. Fome/sede zeradas e
hipotermia abaixo de 34 °C tiram vida. Um dia completo dura 12 minutos reais.

**Um ano na floresta** — a partida começa no **dia 1 e vai até o dia 365**, contado no painel
do relógio (`Dia 47 / 365`). Cada dia aumenta um pouco o consumo de fome, sede e frio
(curva de 0 a +22 %), e o ano é dividido em **quatro estações de ~92 dias** — Estação
Chuvosa, Calor de Verão, Estação Seca e Noites Frias — que inclinam a temperatura média e a
probabilidade de chuva, sol, tempestade e tempo seco. Ao raiar o dia 365 aparece a tela
"Você sobreviveu — 365 dias na floresta", com botão para continuar em modo livre.

**Clima** — sol, nublado, chuva e tempestade, com transições encadeadas, chuva diagonal
desenhada pixel a pixel, respingos no chão, poças nas texturas do terreno, relâmpagos com
flash e trovão. A chuva **encharca a lenha**: uma fogueira descoberta queima muito mais
rápido em dia de chuva e apaga se o combustível cair abaixo de 10 %. O **Telhado da
Fogueira** (aba Construção) elimina esse efeito e reduz o consumo de lenha a 0,85/s; a fumaça
vira vapor denso quando o fogo está molhado.

**Mundo aberto** — mapa de 2400 × 1800 px gerado por ruído com semente fixa por partida:
rio na parte de cima com as duas margens, açude, clareira do acampamento, árvores gigantes
com raízes expostas, palmeiras, samambaias, cipós, cogumelos, pedras, troncos, capim,
vitórias-d'água. O terreno é assado em *chunks* de 400 px conforme a câmera explora, com
detalhes de solo alinhados em grade global (sem emendas visíveis). Colisões com árvores,
pedras, construções e água funda.

**Fauna brasileira** (`src/data/fauna.js`) — dez espécies descritas por dados (comportamento
+ receita de desenho), todas geradas pixel a pixel:

| Espécie | Dieta | Comportamento |
|---|---|---|
| Capivara | herbívora | pastam em grupo, fogem do jogador, nadam |
| Anta | herbívora | maior terrestre, tromba curta, repousa de dia |
| Veado-campeiro | herbívoro | arisco (foge de longe), galha desenhada na cabeça |
| Queixada | onívoro | anda em grupo de 4, faixa clara nos ombros |
| Tatu-galinha | insetívoro | couraça em faixas, cava, é o menor do mapa |
| Quati | onívoro | curioso, se aproxima do jogador, cauda anelada |
| Onça-pintada | **carnívora** | predador noturno: ronda, observa, persegue e morde; teme fogueira acesa e foge quando ferida |
| Jacaré-do-pantanal | **carnívoro** | fica na água, ataque-relâmpago na margem |
| Tucano-toco | ave | pousa nas copas, canta e levanta voo quando você chega perto |
| Arara-azul | ave | voa em alturas maiores, mais rara |

Presas descansam à noite (exceto as noturnas), predadores enxergam mais longe no escuro, e
cada espécie tem som próprio sintetizado. Abater um animal rende `raw_meat`/`leather` e fica
registrado no save; dois dias depois um novo exemplar da mesma espécie nasce no mapa.

**Ferramentas e fabricação** (`src/data/recipes.js`) — 24 receitas em cinco abas
(Ferramentas, Construção, Fogueira, Materiais, Reparo), com durabilidade, estação de
trabalho (`mão` ou `fogueira acesa por perto`) e progressão por dia/construção: machado de
pedra, machado de sílex, lança de pedra, lança de caça, lança farpada, vara de pesca, corda,
cantil, sílex, fogueira, telhado da fogueira, abrigo, parede, cama, tocha, carne assada,
peixe assado, água fervida, refogado de cogumelos — e a aba **Reparo** restaura 40 % da
durabilidade de cada ferramenta.

**Caça com lança** — três níveis de lança, todos com sprite próprio na mão do personagem:
a lança de pedra (dano 1,5 / alcance 52), a **lança de caça** de sílex (dano 2,6 / alcance
60, desbloqueia ao construir a fogueira) e a **lança farpada** (dano 3,6 / alcance 68, a
partir do dia 12). A farpa faz a presa **sangrar**: ela perde vida enquanto foge e deixa
rastro de partículas de sangue.

**Pesca** — fabrique a vara de pesca, equipe-a (`1`–`6`) e pressione `E` na beira do rio ou
do açude: a bóia é lançada na direção em que você olha. Quando ela afunda, pressione `E`
de novo dentro de 1,25 s para fisgar (88 % de chance; fora da fisgada, 18 %). Rende
**peixe cru**, que assa na fogueira. Andar para longe da linha, golpear ou o tempo estourado
recolhem a linha sem nada; cada arremesso gasta 2 de energia e um ponto de durabilidade.

**Fogueira-cozinha** — `carne crua → carne assada`, `peixe cru → peixe assado`, `água suja →
água potável` e `3 cogumelos → refogado`. Os alimentos assados restauram mais fome, dão
energia e têm risco zero de intoxicação, ao contrário dos crus.

**Construções** — posicione com um fantasma que mostra em verde/vermelho se o local é
válido. A fogueira consome lenha, apaga sozinha, ilumina a noite, cozinha e seca a roupa;
o **telhado da fogueira** só pode ser montado sobre uma fogueira existente e barata a chuva;
o abrigo protege da chuva e permite descansar; a cama permite dormir até o amanhecer;
a parede bloqueia animais.

**Iluminação dinâmica** — máscara em `CanvasTexture` com recortes radiais para a luz da
fogueira, da tocha equipada e do acampamento, mais uma passada aditiva quente; a noite
escurece a cena inteira e a tempestade reduz a claridade ambiente.

**Missões** — sequência de 9 objetivos em português com contador de progresso no painel
superior direito (coleta → fogo → água → refeição cozida → noite → abrigo → caça → pesca →
modo livre); concluídos, avançam sozinhos.

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
tools/sprites-fauna.html  folha de revisão: desenha os sprites da fauna em escala grande
tools/responsive-test.html  mede o layout do jogo em qualquer viewport (?w=&h=&touch=&panels=);
                            varre inventário, as 5 abas de fabricação, pausa, ajuda e vitória

src/core/utils.js     matemática, ruído value-noise/fbm, rng, paleta e cores
src/core/pixel.js     SV.P: buffer ImageData (pixel, linha, disco, blob, contorno)
src/core/art_props.js terreno em chunks, vegetação, pedras, troncos, construções
src/core/art_entities explorador (todas as animações), quadrúpedes, aves, partículas
src/core/world.js     geração do mundo: rio, margens, açude, acampamento, props
src/core/audio.js     síntese WebAudio: efeitos, ambiência e música
src/core/save.js      serialização do estado em localStorage

src/data/items.js     definição de itens, pilhas, durabilidade, ícones
src/data/fauna.js     as 10 espécies: comportamento, população, drops e receita visual
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
- **Novo animal:** um objeto em `SV.Fauna` (`src/data/fauna.js`) com `game` (dieta, habitat,
  velocidades, `sight`/`stalk`/`bite`, `fearFire`, `drops`, `sound`) e `draw` (dimensões e
  cores do corpo, orelha, cauda, padrão de pelagem). `SV.Art.quadruped`/`SV.Art.bird` desenham
  a partir disso e a quantidade no mapa vem de `SV.Fauna.population` — nenhuma linha de IA
  precisa ser escrita.
- **Ajuste de dificuldade:** as constantes de consumo estão em `Sim.prototype.update`; o
  teto de dias e o ritmo das estações, em `MAX_DAY`/`SEASONS` (`sim.js`); o dano e o ritmo
  das mordidas, em `SV.Fauna.<espécie>.game.dmg` e no `hitCd` de `GameScene.bite`.
- **Nova carne/peixe cozido:** item `consumable` em `items.js` + receita com `station: 'fire'`
  na aba `Fogueira`; a estação de cozimento e a aba já aparecem sozinhas.

### Ferramentas de desenvolvimento
Ambas ficam em `tools/` e só carregam os módulos de arte — não fazem parte do jogo:

```bash
# folha de sprites ampliada (todas as espécies, um quadro por linha)
abra tools/sprites-fauna.html?only=capy,tapir&scale=4

# matriz de responsividade: estoura o layout se algo sair da tela ou cobrir a hotbar
abra "tools/responsive-test.html?w=390&h=720&touch=1&panels=1"
```

---

## 6. Notas de desempenho e compatibilidade

- Renderização `Phaser.AUTO` (WebGL com fallback para Canvas), `pixelArt: true` e
  `roundPixels: true` para manter os pixels nítidos em qualquer resolução.
- `Scale.RESIZE` + zoom proporcional à altura: a mesma construção preenche do celular ao
  monitor grande. A escala da interface (`SV.Game.uiScale`) é limitada também pela
  **largura**, para que um celular em retrato não receba um HUD de desktop.
- Texturas de terreno são geradas sob demanda em uma fila (no máximo alguns chunks por
  quadro) para não travar a exploração.
- 43 animais ativos (10 espécies + borboletas) mantêm 60 fps em desktop.

### Matriz testada
`tools/responsive-test.html` abre o jogo dentro de um iframe do tamanho pedido e reclama se
qualquer objeto de HUD sai da tela ou se um botão de toque cobre a barra rápida:

| Viewport | Toque | Resultado |
|---|---|---|
| 320 × 568 | ligado | sem estouro, sem sobreposição, painéis cabendo |
| 390 × 720 | ligado | idem |
| 844 × 390 (celular deitado) | ligado | idem |
| 768 × 1024 (tablet) | ligado | idem |
| 1440 × 900 | desligado | hotbar centralizada, idem |
