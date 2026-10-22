# Bolão NBA

Bolão privado de palpites da NBA em HTML/CSS/JS puro, hospedado no Vercel e conectado ao Supabase.

## Produção

- Site: `https://nbadabet.vercel.app/`
- Frontend: Vercel via GitHub `main`
- Auth + Banco + automação: Supabase `Nba_da_bet`
- Fuso oficial: `America/Sao_Paulo`
- Virada operacional da rodada: 06:00 BRT

## Entrada

Na primeira entrada o participante informa nome, e-mail e código da sala. A sessão fica salva no navegador. O e-mail permite recuperar o mesmo jogador em outro aparelho.

## Regra da rodada

A rodada fecha no início do **primeiro jogo válido do dia**. Depois desse horário nenhum palpite daquela rodada pode ser criado ou alterado.

## Automação NBA

A Edge Function `nba-sync` consulta as fontes oficiais da NBA e faz upsert em `public.games`.

### Fast sync
- cron: a cada 5 minutos;
- fonte principal: NBA live scoreboard;
- atualiza `scheduled → live → final`, records e placares;
- se o scoreboard falhar, usa o calendário como fallback.

### Full sync
- cron: a cada 6 horas;
- fonte: calendário oficial NBA;
- mantém uma janela de ontem até +10 dias;
- adiciona jogos novos e corrige mudanças de horário, adiamentos e dados de arena/transmissão.

Quando um jogo vira `final`, a view `standings` recalcula a pontuação automaticamente.

O histórico técnico das execuções fica em `public.nba_sync_runs`, sem acesso para `anon` ou `authenticated`.

## Banco

- `profiles`: jogadores.
- `games`: calendário e resultados oficiais.
- `predictions`: palpites.
- `daily_rounds`: horário de fechamento por rodada.
- `standings`: ranking calculado.
- `nba_sync_runs`: histórico da integração NBA.

## Segurança

- somente publishable key no frontend;
- RLS nas tabelas de usuário;
- escrita em `games` somente pelo backend;
- sincronizador aceita apenas os modos internos `fast/full` e grava somente dados obtidos diretamente das fontes NBA.
