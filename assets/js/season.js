(function(){
  const PHASES=[{id:"christmas-2026",name:"Christmas Run",label:"Rumo ao Natal",start:"2026-10-22",end:"2026-12-25",active:true}];
  const aliases={NY:"NYK",WSH:"WAS",SA:"SAS",NO:"NOP",GS:"GSW",UTAH:"UTA"};
  const code=v=>aliases[String(v||"").toUpperCase()]||String(v||"").toUpperCase();
  const valid=g=>!["cancelled","postponed"].includes(String(g?.status||"").toLowerCase());
  const isFinal=g=>String(g?.status||"").toLowerCase()==="final";
  function winner(g){if(!isFinal(g))return null;const a=Number(g.away_score),h=Number(g.home_score);if(!Number.isFinite(a)||!Number.isFinite(h)||a===h)return null;return code(a>h?g.away_team_code:g.home_team_code)}
  function activePhase(){return PHASES.find(p=>p.active)||PHASES[0]}
  function countdown(now=new Date(),tz="America/Sao_Paulo"){const p=activePhase(),today=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:tz}).format(now),a=new Date(today+"T12:00:00Z"),b=new Date(p.end+"T12:00:00Z");return{phase:p,days:Math.max(0,Math.ceil((b-a)/86400000)),finished:a>b}}
  function build({games=[],predictions=[],profiles=[],phase=activePhase()}={}){
    const ids=profiles.map(p=>p.id).filter(Boolean),names=Object.fromEntries(profiles.map(p=>[p.id,p.display_name||"Jogador"])),byGame=new Map();
    for(const p of predictions){const k=String(p.game_id);if(!byGame.has(k))byGame.set(k,[]);byGame.get(k).push({...p,picked_team_code:code(p.picked_team_code)})}
    const scoped=games.filter(g=>String(g.round_date)>=phase.start&&String(g.round_date)<=phase.end),groups=new Map();
    for(const g of scoped){if(!groups.has(g.round_date))groups.set(g.round_date,[]);groups.get(g.round_date).push(g)}
    const rounds=[...groups.entries()].map(([date,gs])=>({date,games:gs.filter(valid)})).filter(r=>r.games.length&&r.games.every(isFinal)).sort((a,b)=>a.date.localeCompare(b.date));
    const state=Object.fromEntries(ids.map(id=>[id,{points:0,wins:0,decided:0,maxStreak:0,currentStreak:0,recentCorrect:0,recentTotal:0,accuracy:0,movement:0}]));
    const pos=Object.fromEntries(ids.map(id=>[id,[]])),results=[];
    const order=()=>ids.slice().sort((a,b)=>(state[b].points-state[a].points)||(state[b].wins-state[a].wins)||String(names[a]).localeCompare(String(names[b]),"pt-BR"));
    for(const r of rounds){
      const scores=ids.map(userId=>{let correct=0,submitted=0;for(const g of r.games){const p=(byGame.get(String(g.id))||[]).find(x=>x.user_id===userId);if(!p)continue;submitted++;if(winner(g)===code(p.picked_team_code))correct++}state[userId].points+=correct;return{userId,correct,submitted,total:r.games.length}});
      const best=Math.max(0,...scores.map(s=>s.correct)),leaders=scores.filter(s=>s.correct===best),winId=best>0&&leaders.length===1?leaders[0].userId:null;if(winId)state[winId].wins++;
      order().forEach((id,i)=>pos[id].push(i+1));
      results.push({round_date:r.date,games:r.games,scores,best,winner_id:winId,winner_name:winId?names[winId]:null,tied:best>0&&leaders.length>1,leaders:leaders.map(x=>x.userId)});
    }
    for(const id of ids){
      const decided=[];
      for(const g of scoped.filter(isFinal).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at))){const p=(byGame.get(String(g.id))||[]).find(x=>x.user_id===id);if(!p)continue;decided.push(winner(g)===code(p.picked_team_code))}
      let run=0,max=0;for(const ok of decided){run=ok?run+1:0;max=Math.max(max,run)}let cur=0;for(let i=decided.length-1;i>=0&&decided[i];i--)cur++;
      const ph=pos[id],current=ph.at(-1)||null,previous=ph.length>1?ph.at(-2):current,recent=decided.slice(-10);
      Object.assign(state[id],{decided:decided.length,maxStreak:max,currentStreak:cur,recentCorrect:recent.filter(Boolean).length,recentTotal:recent.length,accuracy:decided.length?Math.round(state[id].points/decided.length*100):0,movement:current&&previous?previous-current:0});
    }
    const records=[];
    const mw=Math.max(0,...ids.map(id=>state[id].wins));if(mw)records.push({emoji:"🏆",label:"Mais vitórias de rodada",value:String(mw),holders:ids.filter(id=>state[id].wins===mw).map(id=>names[id])});
    const ms=Math.max(0,...ids.map(id=>state[id].maxStreak));if(ms)records.push({emoji:"🔥",label:"Maior sequência",value:ms+" acertos",holders:ids.filter(id=>state[id].maxStreak===ms).map(id=>names[id])});
    const br=Math.max(0,...results.flatMap(r=>r.scores.map(s=>s.correct)));if(br)records.push({emoji:"🎯",label:"Melhor rodada",value:br+" acertos",holders:[...new Set(results.flatMap(r=>r.scores.filter(s=>s.correct===br).map(s=>names[s.userId])))]});
    return{phase,names,byUser:state,roundResults:results,latestRound:results.at(-1)||null,records,finalOrder:order()};
  }
  function hash(t){let h=2166136261;for(const ch of String(t)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function weekStart(now=new Date(),tz="America/Sao_Paulo"){const k=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:tz}).format(now),d=new Date(k+"T12:00:00Z"),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);return d.toISOString().slice(0,10)}
  function weeklyMission({userId,profiles=[],games=[],predictions=[],timeZone="America/Sao_Paulo",now=new Date()}={}){
    const others=profiles.filter(p=>p.id&&p.id!==userId).sort((a,b)=>String(a.id).localeCompare(String(b.id)));if(!userId||!others.length)return null;
    const ws=weekStart(now,timeZone),opp=others[hash(userId+"|"+ws)%others.length],start=new Date(ws+"T00:00:00Z"),end=new Date(start);end.setUTCDate(end.getUTCDate()+7);let you=0,them=0;
    for(const g of games){const d=new Date(String(g.round_date)+"T12:00:00Z");if(d<start||d>=end||!isFinal(g))continue;const w=winner(g);for(const p of predictions.filter(x=>String(x.game_id)===String(g.id))){if(code(p.picked_team_code)!==w)continue;if(p.user_id===userId)you++;if(p.user_id===opp.id)them++}}
    return{opponent_name:opp.display_name||"adversário",text:"Termine a semana com mais acertos que "+(opp.display_name||"seu rival")+".",your_score:you,opponent_score:them};
  }
  window.BolaoSeason={PHASES,activePhase,countdown,build,weeklyMission,code,winner};
})();