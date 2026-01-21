import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import { DateTime } from "luxon";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TZ = process.env.TZ || "Europe/Amsterdam";
const SEND_POLL = (process.env.SEND_POLL || "true").toLowerCase() === "true";
const CRON_EXPR = process.env.CRON || "0 9 * * *";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHAT_ID) throw new Error("CHAT_ID is required");

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const dbPath = path.resolve(process.cwd(), "src/data/holidays.json");
const holidaysDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

function getTodayKey() {
    return DateTime.now().setZone(TZ).toFormat("MM-dd");
}

function buildMessage(holidayList) {
    const today = DateTime.now().setZone(TZ).toFormat("dd.LL.yyyy");
    const lines = holidayList.map((h, i) => `${i + 1}) ${h}`);
    return `🎉 Праздники на ${today}\n\n${lines.join("\n")}`;
}

async function sendDaily() {
    const key = getTodayKey();
    const holidayList = holidaysDb[key] || [];

    if (!holidayList.length) {
        await bot.sendMessage(CHAT_ID, `Сегодня (${key}) в базе нет праздников 🤷‍♂️`);
        return;
    }

    // 1) отправляем текст
    await bot.sendMessage(CHAT_ID, buildMessage(holidayList));

    // 2) (опционально) отправляем опрос
    if (SEND_POLL) {
        // Telegram Poll: максимум 10 вариантов
        const options = holidayList.slice(0, 9); // оставим место под "ничего"
        options.push("❌ Ничего не отмечаю");

        await bot.sendPoll(
            CHAT_ID,
            "Что отмечаем сегодня?",
            options,
            {
                is_anonymous: false,
                allows_multiple_answers: false,
            }
        );
    }
}

// Команда чтобы узнать chat_id
bot.onText(/\/chatid/, async (msg) => {
    await bot.sendMessage(msg.chat.id, `chat_id: ${msg.chat.id}`);
});

// Команда теста руками
bot.onText(/\/sendtoday/, async (msg) => {
    await bot.sendMessage(msg.chat.id, "Ок, отправляю за сегодня…");
    // важно: в тесте отправим именно в этот чат
    const originalChat = process.env.CHAT_ID;
    process.env.CHAT_ID = String(msg.chat.id);
    try {
        await sendDaily();
    } finally {
        process.env.CHAT_ID = originalChat;
    }
});

// Планировщик
cron.schedule(CRON_EXPR, () => {
    sendDaily().catch((e) => console.error("sendDaily error:", e));
}, { timezone: TZ });

console.log(`✅ Bot started. TZ=${TZ}, CRON="${CRON_EXPR}", SEND_POLL=${SEND_POLL}`);