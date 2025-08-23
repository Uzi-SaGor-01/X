module.exports = function ({ api, models }) {
    const fs = require("fs");
    const moment = require('moment-timezone');
    const axios = require("axios");

    const Users = require("./controllers/users")({ models, api });
    const Threads = require("./controllers/threads")({ models, api });
    const Currencies = require("./controllers/currencies")({ models });
    const logger = require("../utils/log.js");

    // ╔═══════════════════ Console Branding ═══════════════════╗
    console.log("╔══════════════════════════════════════╗");
    console.log("║                                      ║");
    console.log("║          Command Load Complete ✅     ║");
    console.log("║                                      ║");
    console.log("╚══════════════════════════════════════╝");

    console.log(`
███████╗ █████╗  ██████╗  ██████╗ ██████╗ 
██╔════╝██╔══██╗██╔════╝ ██╔═══██╗██╔══██╗
███████╗███████║██║  ███╗██║   ██║██████╔╝
╚════██║██╔══██║██║   ██║██║   ██║██╔═══╝ 
███████║██║  ██║╚██████╔╝╚██████╔╝██║     
╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝     
                SAGOR
`);

    let currentDay = moment.tz("Asia/Kolkata").day();
    const checkDataPath = __dirname + '/../models/commands/checktuongtac/';

    // Daily/Weekly interaction checker
    setInterval(async () => {
        const dayNow = moment.tz("Asia/Kolkata").day();
        const adminIDs = [...global.config.NDH, ...global.config.ADMINBOT];

        try {
            if (currentDay !== dayNow) {
                currentDay = dayNow;
                const checkFiles = fs.readdirSync(checkDataPath).filter(file => {
                    const id = file.replace('.json', '');
                    return adminIDs.includes(id) || global.data.allThreadID.includes(id);
                });

                for (const file of checkFiles) {
                    const data = JSON.parse(fs.readFileSync(checkDataPath + file));
                    const storage = [];

                    for (const item of data.day) {
                        const userName = await Users.getNameUser(item.id) || 'SAGOR ♥️';
                        storage.push({ ...item, name: userName });
                    }

                    storage.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

                    let messageBody = '==SAGOR ♥️ TOP INTERACTIONS==\n\n';
                    messageBody += storage.slice(0, 10)
                        .map((item, idx) => `${idx + 1}. ${item.name} with ${item.count} messages`)
                        .join('\n');

                    api.sendMessage(messageBody, file.replace('.json', ''), err => err && console.log(err));

                    data.day.forEach(e => e.count = 0);
                    data.time = dayNow;
                    fs.writeFileSync(checkDataPath + file, JSON.stringify(data, null, 4));

                    // Weekly reset on Monday
                    if (dayNow === 1) {
                        const weekStorage = [];
                        for (const item of data.week) {
                            const userName = await Users.getNameUser(item.id) || 'SAGOR ♥️';
                            weekStorage.push({ ...item, name: userName });
                        }

                        weekStorage.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

                        let weekBody = '==SAGOR ♥️ TOP WEEKLY==\n\n';
                        weekBody += weekStorage.slice(0, 10)
                            .map((item, idx) => `${idx + 1}. ${item.name} with ${item.count} messages`)
                            .join('\n');

                        api.sendMessage(weekBody, file.replace('.json', ''), err => err && console.log(err));

                        data.week.forEach(e => e.count = 0);
                        fs.writeFileSync(checkDataPath + file, JSON.stringify(data, null, 4));
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, 1000 * 10);

    // Load database into global variables
    (async () => {
        try {
            logger(global.getText('listen', 'startLoadEnvironment'), '[ SAGOR BOT ]');

            const threads = await Threads.getAll();
            const users = await Users.getAll(['userID', 'name', 'data']);
            const currencies = await Currencies.getAll(['userID']);

            for (const thread of threads) {
                const id = String(thread.threadID);
                global.data.allThreadID.push(id);
                global.data.threadData.set(id, thread.data || {});
                global.data.threadInfo.set(id, thread.threadInfo || {});

                if (thread.data?.banned) global.data.threadBanned.set(id, {
                    reason: thread.data.reason || '',
                    dateAdded: thread.data.dateAdded || ''
                });

                if (thread.data?.commandBanned?.length) global.data.commandBanned.set(id, thread.data.commandBanned);
                if (thread.data?.NSFW) global.data.threadAllowNSFW.push(id);
            }

            logger.loader(global.getText('listen', 'loadedEnvironmentThread'));

            for (const user of users) {
                const id = String(user.userID);
                global.data.allUserID.push(id);
                if (user.name?.length) global.data.userName.set(id, user.name);

                if (user.data?.banned) global.data.userBanned.set(id, {
                    reason: user.data.reason || '',
                    dateAdded: user.data.dateAdded || ''
                });

                if (user.data?.commandBanned?.length) global.data.commandBanned.set(id, user.data.commandBanned);
            }

            for (const currency of currencies) global.data.allCurrenciesID.push(String(currency.userID));

            logger.loader(global.getText('listen', 'loadedEnvironmentUser'));
            logger(global.getText('listen', 'successLoadEnvironment'), '[ SAGOR BOT ]');

        } catch (error) {
            logger.loader(global.getText('listen', 'failLoadEnvironment', error), 'error');
        }
    })();

    logger(`[ ${global.config.PREFIX} ] • ${global.config.BOTNAME || ""}`, "[ SAGOR BOT ]");

    // Load all handlers
    const handleCommand = require("./handle/handleCommand")({ api, models, Users, Threads, Currencies });
    const handleCommandEvent = require("./handle/handleCommandEvent")({ api, models, Users, Threads, Currencies });
    const handleReply = require("./handle/handleReply")({ api, models, Users, Threads, Currencies });
    const handleReaction = require("./handle/handleReaction")({ api, models, Users, Threads, Currencies });
    const handleEvent = require("./handle/handleEvent")({ api, models, Users, Threads, Currencies });
    const handleCreateDatabase = require("./handle/handleCreateDatabase")({ api, Threads, Users, Currencies, models });

    // Scheduled events path
    const schedulePath = __dirname + "/../models/commands/cache/datlich.json";
    const tenMinutes = 10 * 60 * 1000;

    // Event executor function
    const executeScheduledEvents = async () => {
        if (!fs.existsSync(schedulePath)) fs.writeFileSync(schedulePath, JSON.stringify({}, null, 4));
        const data = JSON.parse(fs.readFileSync(schedulePath));

        const nowVN = moment().tz('Asia/Kolkata').format('DD/MM/YYYY_HH:mm:ss').split(/\/|_|:/).map(Number);
        const nowMs = await checkTime(nowVN);

        const temp = [];

        const compareTime = async (timeStr, boxID) => {
            const eventMs = await checkTime(timeStr.split("_"));
            if (eventMs < nowMs) {
                if (nowMs - eventMs < tenMinutes) {
                    data[boxID][timeStr]["TID"] = boxID;
                    temp.push(data[boxID][timeStr]);
                }
                delete data[boxID][timeStr];
                fs.writeFileSync(schedulePath, JSON.stringify(data, null, 4));
            }
        };

        for (const boxID of Object.keys(data)) {
            for (const timeStr of Object.keys(data[boxID])) await compareTime(timeStr, boxID);
        }

        for (const el of temp) {
            try {
                const all = (await Threads.getInfo(el.TID)).participantIDs.filter(id => id !== api.getCurrentUserID());
                const mentions = all.map((id, i) => ({ tag: el.REASON[i] || "🥰", id, fromIndex: i }));

                const out = { body: el.REASON || "🥰🥰🥰", mentions };

                if (el.ATTACHMENT) {
                    out.attachment = [];
                    for (const a of el.ATTACHMENT) {
                        const file = await axios.get(encodeURI(a.url), { responseType: "arraybuffer" });
                        const filePath = __dirname + `/../models/commands/cache/${a.fileName}`;
                        fs.writeFileSync(filePath, Buffer.from(file.data, 'utf-8'));
                        out.attachment.push(fs.createReadStream(filePath));
                    }
                }

                console.log(out);
                if (el.BOX) await api.setTitle(el.BOX, el.TID);
                api.sendMessage(out, el.TID, () => {
                    if (el.ATTACHMENT) el.ATTACHMENT.forEach(a => fs.unlinkSync(__dirname + `/../models/commands/cache/${a.fileName}`));
                });

            } catch (err) { console.log(err); }
        }
    };

    setInterval(executeScheduledEvents, tenMinutes / 10);

    // Event dispatcher
    return (event) => {
        switch (event.type) {
            case "message":
            case "message_reply":
            case "message_unsend":
                handleCreateDatabase({ event });
                handleCommand({ event });
                handleReply({ event });
                handleCommandEvent({ event });
                break;
            case "event":
                handleEvent({ event });
                break;
            case "message_reaction":
                handleReaction({ event });
                break;
        }
    };
};}
    };
};
