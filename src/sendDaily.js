import fs from "node:fs";
import path from "node:path";
import TelegramBot from "node-telegram-bot-api";
import { DateTime } from "luxon";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Важно: отправка по Москве
const TZ = "Europe/Moscow";
const SEND_POLL = (process.env.SEND_POLL || "true").toLowerCase() === "true";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHAT_ID) throw new Error("CHAT_ID is required");

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const dbPath = path.resolve(process.cwd(), "src/data/holidays.json");
const holidaysDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

const now = DateTime.now().setZone(TZ);
const key = now.toFormat("MM-dd");
const today = now.toFormat("dd.LL.yyyy");

const holidayList = holidaysDb[key] || [];

if (!holidayList.length) {
  await bot.sendMessage(CHAT_ID, `Сегодня (${today}) в базе нет праздников 🤷‍♂️`);
  process.exit(0);
}

const text =
  `🎉 Праздники на ${today}\n\n` +
  holidayList.map((h, i) => `${i + 1}) ${h}`).join("\n");

await bot.sendMessage(CHAT_ID, text);

if (SEND_POLL) {
  // Poll: максимум 10 вариантов
  const options = holidayList.slice(0, 9);
  options.push("❌ Ничего не отмечаю");

  await bot.sendPoll(CHAT_ID, "Что отмечаем сегодня?", options, {
    is_anonymous: false,
    allows_multiple_answers: true,
  });
}