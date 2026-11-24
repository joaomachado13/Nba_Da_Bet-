(async function(){
  const supabase=window.APP_SUPABASE;if(!supabase||!window.BolaoSeason)return;
  const {data:{session}}=await supabase.auth.getSession();const user=session?.user;if(!user)return;
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const countdown=document.getElementById("phaseCountdown");
  if(countdown){const c=window.BolaoSeason.countdown(new Date(),window.APP_CONFIG?.TIME_ZONE||"America/Sao_Paulo");countdown.innerHTML=c.finished?'<strong>Christmas Run encerrada</strong><span>Confira o campeão da fase.</span>':`<strong>${c.days} ${c.days===1?"dia":"dias"} para a rodada de Natal</strong><span>Rumo ao Natal · final em 25/12</span>`;window.BolaoUI?.finishLoading(countdown)}

  const all = await window.loadBolaoSeasonData(user.id);
  const season = window.BolaoSeason.build(all);


  const mission=document.getElementById("weeklyMission");
  if(mission){const m=window.BolaoSeason.weeklyMission({userId:user.id,...all,timeZone:window.APP_CONFIG?.TIME_ZONE||"America/Sao_Paulo"});if(m)mission.innerHTML=`<div class="mission-icon">🎯</div><div><span class="section-kicker">MISSÃO SECRETA DA SEMANA</span><h3>Você × ${esc(m.opponent_name)}</h3><p>${esc(m.text)}</p><div class="mission-score"><strong>${m.your_score}</strong><span>×</span><strong>${m.opponent_score}</strong></div><small>Não vale pontos extras. É só a sua missão da semana.</small></div>`}

  const records=document.getElementById("seasonRecords");
  if(records)records.innerHTML=season.records.length?season.records.map(r=>`<div class="season-record"><span>${r.emoji}</span><div><strong>${esc(r.label)}</strong><small>${esc(r.holders.join(", "))}</small></div><b>${esc(r.value)}</b></div>`).join(""):'<div class="community-empty">Os recordes aparecem conforme as rodadas terminam.</div>';

  const recaps=document.getElementById("roundRecaps");
  if(recaps)recaps.innerHTML=season.roundResults.slice().reverse().slice(0,8).map(r=>{
    const tiedNames=r.leaders.map(id=>season.names[id]||"Jogador").join(" e ");
    const outcome=r.winner_id?`🏆 ${esc(r.winner_name)} · ${r.best}/${r.games.length}`:r.tied?`🤝 ${esc(tiedNames)} · empate · ${r.best}/${r.games.length}`:r.best===0?"Sem vencedor · 0 acertos":"Finalizada";
    return `<div class="recap-row"><span><strong>${new Date(r.round_date+"T12:00:00Z").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}</strong><small>${r.games.length} jogos</small></span><span>${outcome}</span></div>`;
  }).join("")||'<div class="community-empty">Nenhuma rodada finalizada ainda.</div>';

  const gallery=document.getElementById("achievementGallery");
  if(gallery&&window.BolaoAchievements){const comp=window.BolaoAchievements.compute(all),own=new Map((comp.byUser[user.id]||[]).map(x=>[x.key,x]));gallery.innerHTML=Object.entries(comp.definitions).map(([key,d])=>{const got=own.get(key);return `<div class="gallery-achievement ${got?"unlocked":"locked"}"><span>${got?d.emoji:"?"}</span><div><strong>${got?esc(d.label):"Conquista bloqueada"}${got?.count>1?` ×${got.count}`:""}</strong><small>${got?esc(d.description):"Continue jogando para descobrir."}</small></div></div>`}).join("")}

  const profileDialog=document.getElementById("playerProfileDialog"),profileTitle=document.getElementById("playerProfileTitle"),profileBody=document.getElementById("playerProfileBody");
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-profile-user]");
    if (!button || !profileDialog) return;
    const id = button.dataset.profileUser, stats = season.byUser[id];
    if (!stats) return;
    profileTitle.textContent = season.names[id] || "Jogador";
    profileBody.innerHTML = `<div class="player-profile-grid"><div><span>Pontos na fase</span><strong>${stats.points}</strong></div><div><span>Vitórias</span><strong>${stats.wins}</strong></div><div><span>Aproveitamento</span><strong>${stats.accuracy}%</strong></div><div><span>Maior sequência</span><strong>${stats.maxStreak}</strong></div></div>`;
    profileDialog.showModal();
  });
  profileDialog?.querySelector(".dialog-close")?.addEventListener("click",()=>profileDialog.close());

  const recapDialog=document.getElementById("roundRecapDialog"),recapTitle=document.getElementById("roundRecapTitle"),recapBody=document.getElementById("roundRecapBody");
  if(recapDialog&&season.latestRound){
    const r=season.latestRound,key=`bolao-recap:${user.id}:${r.round_date}`;
    if(!localStorage.getItem(key)){
      const tiedNames=r.leaders.map(id=>season.names[id]||"Jogador").join(" e ");
      const title=r.winner_id?esc(r.winner_name)+" venceu a rodada":r.tied?`Empate entre ${esc(tiedNames)}`:"Rodada sem vencedor";
      recapTitle.textContent="Rodada encerrada · "+new Date(r.round_date+"T12:00:00Z").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
      recapBody.innerHTML=`<div class="recap-winner"><span>${r.winner_id?"🏆":r.tied?"🤝":"—"}</span><strong>${title}</strong><small>${r.best}/${r.games.length} acertos</small></div>`;
      recapDialog.showModal();localStorage.setItem(key,"1")
    }
    recapDialog.querySelector(".dialog-close")?.addEventListener("click",()=>recapDialog.close());
  }
})().catch(error => {
  console.warn("[Bolão] Conteúdo da temporada indisponível:", error);
  const countdown = document.getElementById("phaseCountdown");
  if (countdown?.classList.contains("is-loading")) countdown.innerHTML = '<strong>Temporada 26/27</strong><span>Resumo indisponível no momento.</span>';
  window.BolaoUI?.finishLoading(countdown);
});
