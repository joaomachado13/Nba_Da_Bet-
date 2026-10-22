# Bolão NBA · v0.8

Frontend em HTML/CSS/JS puro conectado ao projeto Supabase `Nba_da_bet`.

## Funcionamento real
- Autenticação: Supabase Auth por magic link.
- Jogos: tabela `games` no Supabase.
- Palpites: tabela `predictions` com RLS.
- Trava: primeiro jogo válido da rodada (`round_date`).
- Revelação: outros palpites só ficam visíveis após a trava.
- Ranking: view `standings`, 1 ponto por vencedor correto.
- Perfil: tabela `profiles`, criada automaticamente no primeiro cadastro.
- Fuso exibido: `America/Sao_Paulo`.

## Dados iniciais
O banco foi populado com a rodada de 22/10/2026 (2 jogos) e 23/10/2026 (12 jogos).

## Rodar localmente
Use um servidor HTTP, não abra por `file://`:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`.

### Magic link
No Supabase Auth, o endereço usado pelo app precisa estar na lista de Redirect URLs. Durante desenvolvimento, adicione `http://localhost:8080/**`. Quando o Cloudflare for publicado, adicione também o domínio final.

## Segurança
- Publishable key no navegador.
- Nenhuma secret/service-role key no frontend.
- RLS ativo em `profiles`, `games` e `predictions`.
- Advisor de segurança do Supabase sem alertas após a configuração.
