# Bolão NBA

Bolão privado de palpites da NBA, em HTML/CSS/JS puro, hospedado no Vercel e conectado ao Supabase.

## Produção

- Site: `https://nbadabet.vercel.app/`
- Frontend: Vercel via GitHub `main`
- Auth + Banco + sincronização: Supabase `Nba_da_bet`
- Fuso oficial do bolão: `America/Sao_Paulo`
- Virada operacional da rodada: 06:00 BRT

## Entrada

Na primeira entrada o participante informa:
- nome;
- e-mail;
- código da sala.

A sessão fica persistida no navegador. O e-mail permite recuperar o mesmo jogador em outro aparelho/navegador.

## Regra da rodada

A rodada fecha no início do **primeiro jogo válido do dia**. Depois desse horário nenhum palpite daquela rodada pode ser criado ou alterado.

## Automação NBA

A função `nba-sync` no Supabase consulta as fontes oficiais da NBA e grava/atualiza `public.games`.

### Calendário
- sincroniza uma janela de ontem até +8 dias;
- roda a cada 6 horas;
- adiciona jogos novos e atualiza mudanças de horário/adiamentos.

### Ao vivo / resultados
- consulta o scoreboard da NBA;
- roda a cada 10 minutos;
- atualiza `scheduled → live → final`, records e placares.

Quando um jogo vira `final`, a view `standings` já recalcula a pontuação automaticamente.

O estado da última execução fica em `public.nba_sync_state`.

## Banco

- `profiles`: jogadores.
- `games`: calendário e resultados oficiais.
- `predictions`: palpites.
- `daily_rounds`: horário de fechamento por rodada.
- `standings`: ranking calculado.
- `nba_sync_state`: monitoramento da integração NBA.

## Segurança

- somente publishable key no frontend;
- RLS ativo nas tabelas de usuário;
- escrita em `games` acontece apenas no backend;
- o sincronizador só aceita modos fixos e só grava dados obtidos diretamente das fontes NBA.
