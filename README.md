# Cidade Livre

Jogo 3D estilo GTA que roda direto no navegador: cidade com trânsito e pedestres, aeroporto com
4 aviões para pilotar (comercial, Boeing 747, jato executivo e caça), fazenda com animais,
dia, pôr do sol e noite.

## ▶ [Clique aqui para jogar](https://tws-x.github.io/cidade-livre/)

Não precisa instalar nada. Funciona melhor no Chrome ou no Edge, em computador.

## Controles

| Tecla | Ação |
|---|---|
| W A S D | Andar / dirigir |
| Shift | Correr |
| Espaço | Pular / freio |
| Mouse | Girar a câmera |
| F | Entrar e sair de carros e aviões |
| W / S (avião) | Mais / menos motor |
| ↑ ↓ (avião) | Levantar / baixar o nariz |
| ← → (avião) | Inclinar e fazer curva |
| G | Qualidade dos gráficos: Mínimo, Baixo, Médio, Alto, Ultra (aperte se ficar lento) |
| H | Dia / pôr do sol / noite |

### Na TV (controle remoto)

Abra o jogo no navegador da TV (Android TV / Google TV / Fire TV com Chrome funcionam melhor) e
aperte **OK** na tela inicial: o jogo entra no **modo TV**, com letras maiores e o gráfico **Mínimo** (sem sombras, vendo menos longe).
O controle remoto só tem setas e OK, então o jogo ajuda:

| Botão | A pé | Carro | Avião |
|---|---|---|---|
| ↑ | andar / correr | acelerar | no chão: motor e decolar · no ar: levantar o nariz |
| ↓ | devagar / parar | frear / ré | no chão: frear · no ar: baixar o nariz / pousar |
| ← → | virar | virar | guiar no chão · fazer curva no ar |
| OK | entrar | sair (devagar) | sair (parado no chão) |
| 1 ou vermelho | dia / noite | | |
| 2 ou verde | qualidade dos gráficos | | |

No carro o piloto automático mantém a velocidade. No avião o motor fica no máximo e o jogo não
deixa o nariz subir ou descer demais; perto do chão ele segura a descida para o pouso não virar acidente.

### Controle de videogame (Bluetooth ou USB)

Qualquer controle que o navegador reconheça (Xbox, PlayStation, 8BitDo…). Aperte **Start** ou **A (✕)** na tela inicial.

| Botão | A pé | Carro | Avião |
|---|---|---|---|
| Stick esquerdo | andar | virar | ↑ ↓ nariz · ← → inclinar |
| Stick direito | câmera | olhar em volta | |
| RT / LT (R2 / L2) | correr (RT) | acelerar / frear e ré | mais / menos motor |
| A (✕) | pular | acelerar | freio no chão |
| B (○) | correr | freio de mão | freio no chão |
| X (□) | | frear / ré | |
| LB / RB (L1 / R1) | | RB freio de mão | leme |
| Y (△) | entrar | sair | sair (parado no chão) |
| Select ou cruz ↑ | dia / noite | | |
| Cruz ↓ | qualidade dos gráficos | | |

O aeroporto fica a leste da cidade (✈ no minimapa) e a fazenda ao lado dele.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org). Na pasta do projeto:

```
npm install
npm run dev
```

Feito com [Three.js](https://threejs.org) e [Vite](https://vite.dev).
Créditos dos modelos, céus e texturas em [CREDITS.md](CREDITS.md).
