require("v8-compile-cache");
const { ipcRenderer } = require("electron");
const log = require("electron-log");
const store = require("electron-store")
const utils = require("./utils")
const tools = require("./tools")
const langRes = require("./lang")
// const path = require("path");

const lafUtils = new utils();
const lafTools = new tools();

const config = new store();

window.lafUtils = new utils();

if (config.get("lang") === "ja_JP") {
    langPack = new langRes.ja_JP();
} else {
    langPack = new langRes.en_US();
}

Object.assign(console, log.functions);

Object.assign(window.lafUtils, {
    searchMatches: (id, name, cat) => {
        let settingsWindow = window.windows[0];
        let query = settingsWindow.settingSearch.toLowerCase() || "";
        return (id.toLowerCase() || "").includes(query) || (name.toLowerCase() || "").includes(query) || (cat.toLowerCase() || "").includes(query);
    }
})

window.prompt = (message, defaultValue) => {
    return ipcRenderer.sendSync("PROMPT", message, defaultValue);
};

const initIpc = () => {
    ipcRenderer.on("ESC", () => {
        document.exitPointerLock();
    });
};
initIpc();

const isEnabledTimer = config.get("enableTimer", true);

const insertMenuTimer = () => {
    let instructions = document.getElementById("instructions");
    let menuTimerText = `
    <div id="menuTimer" style="position:absolute;top:calc(50% + 50px);left:50%;margin-right:50%;transform:translate(-50%,-50%);font-size:40px;color:rgba(255, 255, 255, 0.8);"></div>;
    `;
    instructions.insertAdjacentHTML("afterend", menuTimerText)
}

const initMenuTimer = () => {
    const getActivity = () => {
        let gameActivity;
        try  {
            gameActivity = window.getGameActivity();
        } catch (e) {
            // 何もしなくていい
        }
        let timerSec = gameActivity.time % 60;
        let timerMin = gameActivity.time < 60 ? "0" : (gameActivity.time - timerSec) / 60;
        document.getElementById("menuTimer").innerText = (`${("0" + timerMin).slice(-2)}:${("0" + timerSec).slice(-2)}`)
    }
    let menuTimerInterval = setInterval(getActivity, 500);
}

if (isEnabledTimer) initMenuTimer();

const isEnabledRPC = config.get("enableRPC", true)
let rpcActivity = null;
let rpcInterval = null;

const initDiscordRPC = () => {
    let sendDiscordRPC = () => {
        try {
            let gameActivity = window.getGameActivity();
            rpcActivity = {
                state: gameActivity.map,
                details: gameActivity.mode,
                largeImageKey: "laf_icon",
                largeImageText: "LaF CLient"
            }
            if (gameActivity.time) {
                rpcActivity.endTimestamp = Date.now() + gameActivity.time * 1e3;
            }
            ipcRenderer.invoke("RPC_SEND", rpcActivity)
        } catch (error) {
            rpcActivity = {
                state: "Playing Krunker",
                largeImageKey: "laf_icon",
                largeImageText: "LaF CLient"
            }
            ipcRenderer.invoke("RPC_SEND", rpcActivity)
        }
    }
    if (isEnabledRPC) {
        rpcActivity = {
            startTimestamp: Math.floor(Date.now() / 1e3)
        }
        ipcRenderer.invoke("RPC_SEND", rpcActivity);
        rpcInterval = setInterval(sendDiscordRPC, 500);
    }
}

ipcRenderer.on("RPC_STOP", () => {
    if (rpcInterval) {
        clearInterval(rpcInterval)
    }
})

initDiscordRPC();

window.OffCliV = true;

document.addEventListener("DOMContentLoaded", () => {
    window.utils = new utils();
    let observer = new MutationObserver(() => {
        // console.log("Debug: DOMLoaded")
        observer.disconnect();
        insertMenuTimer();
        window.closeClient = () => {
            ipcRenderer.send("CLOSE");
            console.log("CLOSE BTN")
        };
        lafUtils.setupGameWindow();
    });
    observer.observe(document.getElementById("instructions"), { childList: true });
});

ipcRenderer.on("DID-FINISH-LOAD", () => {
    menuContainer = document.getElementById("menuItemContainer")
    quitBTN = document.getElementById("clientExit");
    switch (config.get("showExitBtn", "bottom")) {
        case "top":
            menuContainer.removeChild(menuContainer.children[7])
            menuContainer.insertAdjacentHTML("afterbegin", `
            <div class="menuItem" onmouseenter="playTick()" onclick="clientExitPopup()" id="clientExit">
            <div class="menuItemIcon iconExit"></div>
            <div class="menuItemTitle" id="menuBtnExit">Exit</div>
            </div>
            `)
            quitBTN = document.getElementById("clientExit");
            quitBTN.style.display = "inherit";
            break;
        case "bottom":
            quitBTN.style.display = "inherit";
            break;
        case "disable":
            break;
    }
})