// Fallback local usado quando o endpoint NBA/Supabase ainda não estiver disponível.
// Rodada oficial de 22/10/2026, já convertida para America/Sao_Paulo.
window.MOCK_GAMES = [
  {
    id: "20261022-CLE-PHI",
    round_date: "2026-10-22",
    start_at: "2026-10-22T23:00:00Z",
    status: "scheduled",
    home: { code: "PHI", name: "76ers", color: "#006BB6", record: "1-0", form: ["V"] },
    away: { code: "CLE", name: "Cavaliers", color: "#860038", record: "0-0", form: [] }
  },
  {
    id: "20261022-DEN-OKC",
    round_date: "2026-10-22",
    start_at: "2026-10-23T01:30:00Z",
    status: "scheduled",
    home: { code: "OKC", name: "Thunder", color: "#007AC1", record: "1-0", form: ["V"] },
    away: { code: "DEN", name: "Nuggets", color: "#0E2240", record: "0-0", form: [] }
  }
];

window.MOCK_RANKING = [
  { name: "João", points: 37, initials: "JM", streak: true, avatarBg: "#F4D78A", avatarFg: "#5B4100" },
  { name: "Pedro", points: 34, initials: "PE", avatarBg: "#DCEBFF", avatarFg: "#174A8B" },
  { name: "Ana", points: 31, initials: "AN", avatarBg: "#F7DCEB", avatarFg: "#87335E" },
  { name: "Carlos", points: 28, initials: "CA", avatarBg: "#DDEFE7", avatarFg: "#245C45" }
];

window.MOCK_NEXT_ROUND = {
  label: "Sex, 23 de out",
  gamesCount: 12,
  firstGame: {
    time: "17:00",
    away: { code: "CHI", name: "Bulls" },
    home: { code: "MIL", name: "Bucks" }
  }
};
