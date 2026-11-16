# Experiência e desempenho do Bolão NBA

Revisão de 16/11/2026, sobre o checkout existente de `joaomachado13/Nba_Da_Bet-`, base `3dcd360cab6a1d0d521e408d14a694fa2167b2bf`. Skill aplicada: `auditar-produtos-digitais`, modo corrigir. Identidade âmbar, regras de pontuação, fechamento de rodada e autenticação preservados.

## Cobertura e limites

Inspeção visual antes/depois de entrada, palpites e ranking em Chromium; desktop de 1440 × 1000 e celular de 390 × 844, com verificação adicional em 320 × 844. Estatísticas, histórico e conta receberam os componentes compartilhados e teste de renderização/ausência de overflow em celular. Não se trata de auditoria visual completa de todas as rotas.

A sessão e todas as respostas Supabase foram simuladas no navegador. Nenhuma conta, palpite ou confirmação foi criada em produção. Não foram validados login real, dados reais, Safari/iOS ou Firefox. Não houve deploy ou alteração na configuração do ambiente publicado.

## Achados e correções

| Achado | Regras | Prioridade | Evidência inicial | Correção e revalidação |
| --- | --- | --- | --- | --- |
| A-01 | V2-19, V2-20, C-01 | P2 | A seleção recriava toda a lista; o botão desabilitado já estava fora do documento, permitindo novos envios e perdendo foco. | Atualização apenas do card, estado de envio por partida, bloqueio de reenvio, progresso após confirmação e mensagem persistente em falha. Testados teclado, cliques repetidos, falha e nova tentativa. |
| A-02 | V2-19, C-02 | P2 | Jogos aguardavam perfil e consultas sequenciais; ranking e experiência repetiam três consultas. | Paralelização das leituras independentes e compartilhamento da leitura de temporada por usuário, somente na memória do documento. Ranking: sete consultas antes, quatro depois. |
| A-03 | V2-19, V2-09 | P2 | Falha de busca podia aparecer como dia sem jogos; carregamento não tinha estrutura reservada. | Skeletons, `aria-busy`, erro separado de vazio e botão para tentar novamente. Testados atraso, erro, vazio e recuperação. |
| A-04 | V1-05, V1-19, V2-07, V2-13 | P3 | Marcas d'água e fundos de dois times competiam com a escolha; contagem de Natal aparecia antes da rodada no celular. | Cards neutros, marcas decorativas removidas e contagem sazonal depois do conteúdo operacional. Capturas desktop/mobile conferidas. |
| A-05 | V2-10, V2-12, V2-15, C-01 | P2 | Ícones Unicode inconsistentes, erro de entrada apenas em toast e perfil do ranking acessível somente por clique. | SVGs consistentes, erro junto ao código, mostrar/ocultar senha, botão de perfil acessível, foco visível e link para pular ao conteúdo. Conferidos Enter, Escape, foco restaurado e redução de movimento. |
| A-06 | V2-20, C-03 | P2 | Transições nativas entre documentos produziam erro de ViewTransition em navegação/recarregamento. | Removido o opt-in instável; entradas e feedback usam CSS/WAAPI, sem biblioteca adicional. Teste final sem erros JavaScript não tratados. |
| A-07 | V2-05, C-02 | P3 | Navegação antecipava todas as rotas; scripts sem defer; marca dependia de imagem remota. | Prefetch só por intenção e respeitando economia de dados/2G; scripts defer mantendo ordem; versão local da marca e cache PWA atualizado. |

## Verificações

- `node --test tests/*.test.js`: dois testes existentes aprovados com Node 22.
- Sintaxe de todos os JavaScripts e service worker; `git diff --check`.
- `tests/ux.browser.py`: regressão de entrada, skeleton animado, escolha, envio único, foco, falha, retry, confirmação incompleta/completa, diálogos, navegação, perfil, redução de movimento, vazio/erro e renderização das demais páginas.
- Sem overflow horizontal em 320/390 px no fluxo principal. Movimento reduzido: nenhuma animação ativa no cenário testado.
- Contrastes calculados de pares sólidos usados nos componentes alterados: texto secundário `#525966`/branco; acento `#785300`/branco; sucesso `#087a4d`/branco; erro `#a12620`/branco; texto do CTA `#211803`/âmbar `#e8a900`. Todos acima de 4,5:1. Isso não equivale a conferência de todos os textos, fundos e estados do site.

Para repetir o teste opcional, disponibilize Python com Playwright e Chromium, inicie `python3 -m http.server 8000 --bind 127.0.0.1` na raiz e execute `python3 tests/ux.browser.py`. `CHROMIUM_PATH` permite selecionar o executável e `NBA_UX_OUTPUT` o diretório de capturas. O teste preserva verificação TLS. No ambiente da nuvem, o Chromium precisa de acesso ao banco de certificados NSS já configurado; use execução autorizada quando o contexto restrito impedir esse acesso.

Evidências desta execução: `/workspace/scratch/nba-ux/before-*.png`, `/workspace/scratch/nba-ux/final/*.png` e `/workspace/scratch/nba-ux/benchmark.json`. São artefatos locais, não arquivos publicados no site.

## Medição de laboratório

Três execuções por versão, Chromium desktop, servidor local, API simulada com 120 ms de latência, mesmo SDK e recursos externos controlados. Mediu-se o intervalo entre início da navegação e disponibilidade do primeiro botão de palpite. O comparativo usa uma cópia da revisão-base, sem alterar o checkout ativo.

| Versão | Execuções | Mediana |
| --- | --- | --- |
| Base | 1071 / 946 / 976 ms | 976 ms |
| Alterada | 479 / 443 / 453 ms | 453 ms |

A redução observada é de aproximadamente 54% nesse cenário. Não é medição de produção, Lighthouse, Core Web Vitals ou garantia para aparelhos/redes reais. O ranking passou de sete para quatro chamadas de API no cenário controlado.

## Matriz dos 40 critérios

Status se refere ao recorte visual descrito acima. “Conforme” não certifica o produto inteiro. IDs mantidos conforme a skill.

| ID | Status | Evidência ou justificativa |
| --- | --- | --- |
| V1-01 | Exceção justificada | Estados aberta/fechada e contagens informam a operação. Não foram adicionados selos decorativos. |
| V1-02 | Exceção justificada | Itálico existente no banner editorial do ranking, sem espalhá-lo nos controles. |
| V1-03 | Conforme | Inter existente preservada; nenhuma fonte de assinatura genérica adicionada. |
| V1-04 | Conforme | Títulos principais alterados com tracking moderado e leitura conferida em 320/390 px. |
| V1-05 | Conforme | A-04: escolha destacada, decoração reduzida. |
| V1-06 | Conforme | Separação por espaçamento nos cards; divisórias operacionais mantidas. |
| V1-07 | Conforme | Reutilização dos tokens de marca; cores de feedback com função definida. |
| V1-08 | Exceção justificada | Contêiner por partida agrupa escolha/horário/feedback; resumo separa fechamento. |
| V1-09 | Não aplicável | Sem diagramas no recorte. |
| V1-10 | Conforme | Entrada concisa e estados de erro com ação concreta. |
| V1-11 | Não aplicável | Sem breadcrumbs de código no produto. |
| V1-12 | Exceção justificada | Numeração de ranking e passos das regras têm função real. |
| V1-13 | Exceção justificada | Temporada e rodada contextualizam conteúdo; identidade existente mantida. |
| V1-14 | Não aplicável | Sem dithering. |
| V1-15 | Não aplicável | Sem ilustrações ASCII. |
| V1-16 | Conforme | Geometria de cards e controles existente preservada. |
| V1-17 | Conforme | Sem fonte monoespaçada decorativa. |
| V1-18 | Exceção justificada | Caixa alta preservada em rótulos curtos da marca, não nas novas mensagens longas. |
| V1-19 | Conforme | Gradientes removidos dos cards de escolha; shimmer somente durante carregamento. |
| V1-20 | Conforme | Títulos alterados sem pontuação ornamental. |
| V2-01 | Conforme | Nenhum selo ou prova social inventada. |
| V2-02 | Conforme | Labels acessíveis de entrada preservados; mensagens junto ao campo. |
| V2-03 | Conforme | Sem novo itálico aleatório. |
| V2-04 | Conforme | Tipografia proporcional existente preservada. |
| V2-05 | Conforme | Tokens compartilhados de tempo/foco, folha e módulo comuns às seis rotas. |
| V2-06 | Exceção justificada | Produto usa dados existentes; teste autenticado usa fixtures identificadas neste relatório. |
| V2-07 | Conforme | Jogos ganham hierarquia; conteúdo sazonal deslocado no celular. |
| V2-08 | Conforme | Grupos legíveis por espaçamento e informação consistente. |
| V2-09 | Conforme | Falha de busca distingue indisponibilidade de ausência de jogos. |
| V2-10 | Conforme | Seleção e confirmação com estados de espera/sucesso/erro. |
| V2-11 | Conforme | Âmbar existente mantido para ação e foco, sem nova cor ornamental. |
| V2-12 | Conforme | Navegação e compartilhamento usam SVG com traço consistente. |
| V2-13 | Conforme | Marcas d'água removidas; animações curtas com função. |
| V2-14 | Não aplicável | Os componentes alterados não usam molduras equidistantes aninhadas. |
| V2-15 | Não verificado | Pares novos medidos e galeria melhorada; contraste de todos os estados do site não auditado integralmente. |
| V2-16 | Conforme | Títulos/CTA e datas conferidos nos tamanhos indicados, sem quebra fixa nova. |
| V2-17 | Conforme | Marca local enquadrada sem margem branca excessiva; ícones e botões conferidos visualmente. |
| V2-18 | Conforme | Dígitos tabulares no resumo, placares, métricas e pontos. |
| V2-19 | Conforme | A-01/A-03 e regressão de rede lenta, erro, vazio, repetição e retry. |
| V2-20 | Conforme | Entrada de cards, salvamento, seleção e diálogos; redução de movimento testada. |

Auditoria parcial com correções verificadas no escopo. Pendências: teste com participante autorizado e dados reais, navegadores além de Chromium e métricas de campo. Publicação não executada.

## Complemento: skeleton da página inicial

O carregamento agora reserva o formato dos confrontos (horário, times, botões e mensagem), além dos dados do perfil, resumo da rodada, mini ranking, prévia e contagem sazonal. Os blocos são liberados de forma independente, sem atraso artificial. Dados ainda desconhecidos não aparecem como zero ou rodada aberta. Regras e navegação continuam disponíveis.

Conferidos desktop de 1440 px e celulares de 390/320 px, com respostas de API retidas até a captura. Verificadas seis condições: sucesso, falha geral, falha no ranking, falha na prévia, falha na busca de jogos e redução de movimento. Em todas, os estados de carregamento e placeholders terminaram após a resposta ou mensagem de erro. Evidências: `/workspace/scratch/nba-ux/skeleton/desktop-loading.png` e `mobile-390-loading.png`.
