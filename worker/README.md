# Worker NBA

O Worker funciona como a camada entre o navegador e o calendário da NBA.

## Rota

`GET /api/nba/games?date=YYYY-MM-DD`

A data é interpretada como a **data da rodada em America/Sao_Paulo**. Isso é importante porque vários jogos noturnos da NBA já caem no dia seguinte em UTC.

## Fonte

O Worker tenta os arquivos públicos de calendário usados pelo ecossistema NBA CDN e normaliza os jogos para o formato do bolão. O frontend nunca precisa saber como o payload original da NBA está estruturado.

## Por que não chamar a NBA direto do navegador?

- centraliza tratamento de CORS e headers;
- evita baixar um calendário grande em cada celular/PC;
- permite cache no Cloudflare;
- deixa simples trocar a fonte se a NBA alterar o endpoint;
- mantém o filtro por fuso horário em um único lugar.
