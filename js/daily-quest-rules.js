export const DAILY_QUEST_DEFINITIONS = Object.freeze([
  {
    id: 'play_online_2',
    event: 'online_match',
    title: 'Lute em 2 partidas online',
    target: 2,
    reward: { zeni: 200, dust: 0, gems: 0 }
  },
  {
    id: 'win_online_1',
    event: 'online_win',
    title: 'Venca 1 partida online',
    target: 1,
    reward: { zeni: 0, dust: 100, gems: 0 }
  },
  {
    id: 'complete_raid_1',
    event: 'raid_complete',
    title: 'Conclua 1 Raid',
    target: 1,
    reward: { zeni: 250, dust: 50, gems: 0 }
  },
  {
    id: 'open_pack_1',
    event: 'pack_open',
    title: 'Abra 1 Booster',
    target: 1,
    reward: { zeni: 0, dust: 0, gems: 1 }
  }
]);

export function dailyDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function ensureDailyQuestState(raw, dateKey = dailyDateKey()) {
  if (!raw || raw.date !== dateKey) {
    return { date: dateKey, progress: {}, claimed: [] };
  }

  return {
    date: dateKey,
    progress: raw.progress && typeof raw.progress === 'object' ? { ...raw.progress } : {},
    claimed: Array.isArray(raw.claimed) ? [...new Set(raw.claimed)] : []
  };
}

export function progressDailyQuestState(raw, event, amount = 1, dateKey = dailyDateKey()) {
  const state = ensureDailyQuestState(raw, dateKey);
  const delta = Math.max(0, Math.floor(Number(amount) || 0));

  for (const quest of DAILY_QUEST_DEFINITIONS) {
    if (quest.event !== event) continue;
    const current = Math.max(0, Math.floor(Number(state.progress[quest.id]) || 0));
    state.progress[quest.id] = Math.min(quest.target, current + delta);
  }

  return state;
}

export function questView(raw, dateKey = dailyDateKey()) {
  const state = ensureDailyQuestState(raw, dateKey);
  return DAILY_QUEST_DEFINITIONS.map(quest => {
    const progress = Math.min(quest.target, Math.max(0, Number(state.progress[quest.id]) || 0));
    const claimed = state.claimed.includes(quest.id);
    return {
      ...quest,
      progress,
      completed: progress >= quest.target,
      claimed
    };
  });
}

export function claimDailyQuestState(profile, raw, questId, dateKey = dailyDateKey()) {
  const state = ensureDailyQuestState(raw, dateKey);
  const quest = DAILY_QUEST_DEFINITIONS.find(item => item.id === questId);
  if (!quest) return { ok: false, code: 'QUEST_NOT_FOUND', state };

  const progress = Math.max(0, Number(state.progress[quest.id]) || 0);
  if (progress < quest.target) return { ok: false, code: 'QUEST_INCOMPLETE', state };
  if (state.claimed.includes(quest.id)) return { ok: false, code: 'QUEST_ALREADY_CLAIMED', state };

  state.claimed.push(quest.id);
  const reward = quest.reward;

  return {
    ok: true,
    state,
    reward: { ...reward },
    zeni: Math.max(0, Number(profile?.zeni) || 0) + (reward.zeni || 0),
    dust: Math.max(0, Number(profile?.dust) || 0) + (reward.dust || 0),
    gems: Math.max(0, Number(profile?.gems) || 0) + (reward.gems || 0)
  };
}

export function applyQuestEventToUser(user, event, amount = 1, dateKey = dailyDateKey()) {
  if (!user) return null;
  user.dailyQuests = progressDailyQuestState(user.dailyQuests, event, amount, dateKey);
  if (typeof user.markModified === 'function') user.markModified('dailyQuests');
  return user.dailyQuests;
}
