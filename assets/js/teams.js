(function () {
  const TEAM_CONFIG = {
    ATL:{id:"1610612737",name:"Hawks",color:"#E03A3E",soft:"rgba(224,58,62,.16)",watermarkOpacity:.08},
    BOS:{id:"1610612738",name:"Celtics",color:"#007A33",soft:"rgba(0,122,51,.15)",watermarkOpacity:.08},
    BKN:{id:"1610612751",name:"Nets",color:"#000000",soft:"rgba(0,0,0,.09)",watermarkOpacity:.065},
    CHA:{id:"1610612766",name:"Hornets",color:"#1D1160",soft:"rgba(29,17,96,.14)",watermarkOpacity:.075},
    CHI:{id:"1610612741",name:"Bulls",color:"#CE1141",soft:"rgba(206,17,65,.15)",watermarkOpacity:.08},
    CLE:{id:"1610612739",name:"Cavaliers",color:"#860038",soft:"rgba(134,0,56,.14)",watermarkOpacity:.07},
    DAL:{id:"1610612742",name:"Mavericks",color:"#00538C",soft:"rgba(0,83,140,.14)",watermarkOpacity:.08},
    DEN:{id:"1610612743",name:"Nuggets",color:"#0E2240",soft:"rgba(14,34,64,.12)",watermarkOpacity:.07},
    DET:{id:"1610612765",name:"Pistons",color:"#C8102E",soft:"rgba(200,16,46,.15)",watermarkOpacity:.08},
    GSW:{id:"1610612744",name:"Warriors",color:"#1D428A",soft:"rgba(29,66,138,.14)",watermarkOpacity:.08},
    HOU:{id:"1610612745",name:"Rockets",color:"#CE1141",soft:"rgba(206,17,65,.15)",watermarkOpacity:.08},
    IND:{id:"1610612754",name:"Pacers",color:"#002D62",soft:"rgba(0,45,98,.12)",watermarkOpacity:.07},
    LAC:{id:"1610612746",name:"Clippers",color:"#C8102E",soft:"rgba(200,16,46,.14)",watermarkOpacity:.08},
    LAL:{id:"1610612747",name:"Lakers",color:"#552583",soft:"rgba(85,37,131,.14)",watermarkOpacity:.08},
    MEM:{id:"1610612763",name:"Grizzlies",color:"#5D76A9",soft:"rgba(93,118,169,.14)",watermarkOpacity:.08},
    MIA:{id:"1610612748",name:"Heat",color:"#98002E",soft:"rgba(152,0,46,.14)",watermarkOpacity:.075},
    MIL:{id:"1610612749",name:"Bucks",color:"#00471B",soft:"rgba(0,71,27,.12)",watermarkOpacity:.07},
    MIN:{id:"1610612750",name:"Timberwolves",color:"#0C2340",soft:"rgba(12,35,64,.12)",watermarkOpacity:.07},
    NOP:{id:"1610612740",name:"Pelicans",color:"#0C2340",soft:"rgba(12,35,64,.12)",watermarkOpacity:.07},
    NYK:{id:"1610612752",name:"Knicks",color:"#006BB6",soft:"rgba(0,107,182,.15)",watermarkOpacity:.08},
    OKC:{id:"1610612760",name:"Thunder",color:"#007AC1",soft:"rgba(0,122,193,.16)",watermarkOpacity:.085},
    ORL:{id:"1610612753",name:"Magic",color:"#0077C0",soft:"rgba(0,119,192,.15)",watermarkOpacity:.08},
    PHI:{id:"1610612755",name:"76ers",color:"#006BB6",soft:"rgba(0,107,182,.15)",watermarkOpacity:.08},
    PHX:{id:"1610612756",name:"Suns",color:"#1D1160",soft:"rgba(29,17,96,.14)",watermarkOpacity:.075},
    POR:{id:"1610612757",name:"Trail Blazers",color:"#E03A3E",soft:"rgba(224,58,62,.15)",watermarkOpacity:.08},
    SAC:{id:"1610612758",name:"Kings",color:"#5A2D81",soft:"rgba(90,45,129,.14)",watermarkOpacity:.08},
    SAS:{id:"1610612759",name:"Spurs",color:"#8A8D8F",soft:"rgba(138,141,143,.14)",watermarkOpacity:.08},
    TOR:{id:"1610612761",name:"Raptors",color:"#CE1141",soft:"rgba(206,17,65,.15)",watermarkOpacity:.08},
    UTA:{id:"1610612762",name:"Jazz",color:"#002B5C",soft:"rgba(0,43,92,.12)",watermarkOpacity:.07},
    WAS:{id:"1610612764",name:"Wizards",color:"#002B5C",soft:"rgba(0,43,92,.12)",watermarkOpacity:.07}
  };

  const FALLBACK = {
    id:null,
    name:"Time NBA",
    color:"#E8A800",
    soft:"rgba(232,168,0,.12)",
    watermarkOpacity:.07
  };

  function get(code) {
    return TEAM_CONFIG[String(code || "").toUpperCase()] || FALLBACK;
  }

  function nbaTeamId(code) {
    return get(code).id;
  }

  function logoUrl(code, explicitId) {
    const id = explicitId || nbaTeamId(code);
    return id ? `https://cdn.nba.com/logos/nba/${id}/primary/L/logo.svg` : "";
  }

  window.NBA_TEAMS = {
    config: TEAM_CONFIG,
    fallback: FALLBACK,
    get,
    nbaTeamId,
    logoUrl
  };
})();
