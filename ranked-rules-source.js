export const RANKED_WIN_RP = 25;
export const RANKED_LOSS_RP = 15;
export const RANKED_WIN_XP = 150;
export const RANKED_LOSS_XP = 50;
export const XP_PER_LEVEL = 500;
export const RECONNECT_GRACE_MS = 30000;

export function divisionForRp(value) {
  const rp = Math.max(0, Math.floor(Number(value) || 0));
  if (rp < 1200) return 'Bronze I';
  if (rp < 1500) return 'Prata III';
  if (rp < 1800) return 'Ouro II';
  if (rp < 2200) return 'Platina I';
  if (rp < 2700) return 'Diamante Supreme';
  if (rp < 3300) return 'Mestre Z';
  return 'Grandmaster Kami';
}

export function levelForXp(value) {
  const xp = Math.max(0, Math.floor(Number(value) || 0));
  return 1 + Math.floor(xp / XP_PER_LEVEL);
}

export function applyRankedResult(profile, isWin) {
  const currentRp = Math.max(0, Math.floor(Number(profile?.rankPoints) || 0));
  const currentXp = Math.max(0, Math.floor(Number(profile?.xp) || 0));

  const rankPoints = isWin
    ? currentRp + RANKED_WIN_RP
    : Math.max(0, currentRp - RANKED_LOSS_RP);

  const xp = currentXp + (isWin ? RANKED_WIN_XP : RANKED_LOSS_XP);

  return {
    rankPoints,
    xp,
    level: levelForXp(xp),
    division: divisionForRp(rankPoints),
    victories: Math.max(0, Math.floor(Number(profile?.victories) || 0)) + (isWin ? 1 : 0),
    losses: Math.max(0, Math.floor(Number(profile?.losses) || 0)) + (isWin ? 0 : 1)
  };
}
