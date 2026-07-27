import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "..", "data");
const LEVELS_PATH = join(DATA_PATH, "levels.json");

const XP_PER_LEVEL = 100;
const COOLDOWN = 30000;
const XP_PER_MSG_RANGE = [5, 15];

if (!existsSync(DATA_PATH)) mkdirSync(DATA_PATH, { recursive: true });
if (!existsSync(LEVELS_PATH)) writeFileSync(LEVELS_PATH, "{}");

function readData() {
  if (!existsSync(LEVELS_PATH)) return {};
  return JSON.parse(readFileSync(LEVELS_PATH, "utf-8"));
}

function writeData(data) {
  writeFileSync(LEVELS_PATH, JSON.stringify(data, null, 2));
}

export function getLevelConfig(level) {
  return {
    level,
    xpNeeded: (level + 1) * XP_PER_LEVEL,
    totalXp: (level * (level + 1) / 2) * XP_PER_LEVEL,
  };
}

export function addXp(userId) {
  const data = readData();
  if (!data[userId]) {
    data[userId] = { xp: 0, level: 1, lastMsg: 0 };
  }

  const now = Date.now();
  if (now - data[userId].lastMsg < COOLDOWN) return null;

  const xpGain = Math.floor(Math.random() * (XP_PER_MSG_RANGE[1] - XP_PER_MSG_RANGE[0] + 1)) + XP_PER_MSG_RANGE[0];
  data[userId].xp += xpGain;
  data[userId].lastMsg = now;

  const needed = data[userId].level * XP_PER_LEVEL;
  let leveledUp = false;

  while (data[userId].xp >= needed) {
    data[userId].xp -= needed;
    data[userId].level++;
    leveledUp = true;
  }

  writeData(data);
  return leveledUp ? data[userId].level : null;
}

export function getUserLevel(userId) {
  const data = readData();
  if (!data[userId]) return { xp: 0, level: 1 };
  return data[userId];
}

export function getLeaderboard() {
  const data = readData();
  return Object.entries(data)
    .map(([id, d]) => ({ id, level: d.level, xp: d.xp }))
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
    .slice(0, 20);
}
