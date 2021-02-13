require("v8-compile-cache");
const { app, BrowserWindow, clipboard, ipcMain, shell } = require("electron");
const localShortcut = require("electron-localshortcut");
const prompt = require("electron-prompt");
const log = require("electron-log");
const path = require("path");
const tools = require("./tools");
const { ftruncate } = require("fs");

Object.assign(console, log.functions);

let gameWindow = null,
    editorWindow = null,
    hubWindow = null,
    splashWindow = null,
    promptWindow = null;

let lafTools = new tools();

console.log(`LaF v${app.getVersion()}\n- electron@${process.versions.electron}\n- nodejs@${process.versions.node}\n- Chromium@${process.versions.chrome}`);

const initFlags = () => {
    flagsInfo = `Chromium Switch Status:`
    chromiumFlags = [
        // ["オプション", null("オプション2"), 有効[bool]]
        ["disable-frame-rate-limit", null, true],
        ["disable-gpu-vsync", null, true],
        ["enable-zero-copy", null, true],
        ["use-angle", "gl", false],
        ["enable-webgl2-compute-context", null, false]
    ];
    chromiumFlags.forEach((f) => {
        isEnable = f[2] ? "Enable" : "Disable";
        flagsInfo += `\n- ${f[0]}, ${f[1]}: ${isEnable}`;
        if (f[2]) {
            if (f[1] === null) {
                app.commandLine.appendSwitch(f[0]);
            } else {
                app.commandLine.appendSwitch(f[0], f[1]);
            };
        }
    });
    console.log(flagsInfo);
};
initFlags();

const initGameWindow = () => {
    gameWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: false,
            webSecurity: false,
            enableRemoteModule: true
        }
    });
    gameWindow.removeMenu();

    initShortcutKeys();

    gameWindow.loadURL("https://krunker.io");

    gameWindow.on("closed", () => {
        gameWindow = null;
    });

    gameWindow.once("ready-to-show", () => {
        splashWindow.destroy();
        gameWindow.setTitle("LaF");
        gameWindow.show();
    });

    gameWindow.webContents.on("new-window", (event, url) => {
        event.preventDefault();
        switch (lafTools.urlType(url)) {
            case "hub":
                if (!hubWindow) {
                    initHubWindow(url)
                } else {
                    hubWindow.loadURL(url);
                }
                break;
            case "editor":
                if (!editorWindow) {
                    initEditorWindow(url);
                } else {
                    editorWindow.loadURL(url);
                }
                break;
            default:
                shell.openExternal(url);
        };
    });
};

const initHubWindow = (url) => {
    hubWindow = new BrowserWindow({
        width: 900,
        height: 600,
        show: false,
        parent: gameWindow
    });
    hubWindow.removeMenu();
    hubWindow.loadURL(url);

    hubWindow.on("closed", () => {
        hubWindow = null;
    });

    hubWindow.once("ready-to-show", () => {
        hubWindow.setTitle("LaF: Krunker Hub");
        hubWindow.show();
    });

    hubWindow.webContents.on("new-window", (event, url) => {
        event.preventDefault();
        switch (lafTools.urlType(url)) {
            case "game":
                hubWindow.destroy();
                gameWindow.loadURL(url);
                break;
            case "editor":
                if (!editorWindow) {
                    initEditorWindow(url);
                } else {
                    editorWindow.loadURL(url);
                };
                break;
            default:
                shell.openExternal(url);
        };
    });
};

const initEditorWindow = (url) => {
    editorWindow = new BrowserWindow({
        width: 900,
        height: 600,
        show: false,
        parent: gameWindow
    });
    editorWindow.removeMenu();
    editorWindow.loadURL(url);

    editorWindow.on("closed", () => {
        editorWindow = null;
    });

    editorWindow.once("ready-to-show", () => {
        editorWindow.setTitle("LaF: Krunker Editor");
        editorWindow.show();
    });

    editorWindow.webContents.on("new-window", (event, url) => {
        event.preventDefault();
        switch (lafTools.urlType(url)) {
            case "hub":
                if (!hubWindow) {
                    initHubWindow(url);
                } else {
                    hubWindow.loadURL(url);
                };
                break;
            case "game":
                editorWindow.destroy();
                gameWindow.loadURL(url);
                break;
            default:
                shell.openExternal(url);
        };
    });
};

const initSplashWindow = () => {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false,
        resizable: false,
        movable: false,
        center: true,
        show: false,
        webPreferences: {
            nodeIntegration: true
        }
    });
    splashWindow.removeMenu();
    splashWindow.loadURL(path.join(__dirname, "splash.html"))
    splashWindow.webContents.once("did-finish-load", () => {
        splashWindow.show();
        initAutoUpdater();
    });
};

const initAutoUpdater = () => {
    const { autoUpdater } = require("electron-updater");

    let updateCheck = null;

    autoUpdater.on("checking-for-update", (info) => {
        splashWindow.webContents.send("checking-for-update")
        updateCheck = setTimeout(() => {
            splashWindow.webContents.send("update-not-available")
            setTimeout(() => {
                initGameWindow()
            }, 1000)
        }, 15000)
    })
    autoUpdater.on("update-available", (info) => {
        console.log(info)
        if (updateCheck) clearTimeout(updateCheck)
        splashWindow.webContents.send("update-available", info)
    })
    autoUpdater.on("update-not-available", (info) => {
        console.log(info)
        if (updateCheck) clearTimeout(updateCheck)
        splashWindow.webContents.send("update-not-available")
        setTimeout(() => {
            initGameWindow()
        }, 1000)
    })
    autoUpdater.on("error", (err) => {
        console.log(err)
        if (updateCheck) clearTimeout(updateCheck)
        splashWindow.webContents.send("update-error")
        setTimeout(() => {
            initGameWindow()
        }, 1000)
    })
    autoUpdater.on("download-progress", (info) => {
        if (updateCheck) clearTimeout(updateCheck)
        splashWindow.webContents.send("download-progress", info)
    })
    autoUpdater.on("update-downloaded", (info) => {
        if (updateCheck) clearTimeout(updateCheck)
        splashWindow.webContents.send("update-downloaded", info)
        setTimeout(() => {
            autoUpdater.quitAndInstall(true, true)
        }, 3000)
    });
    autoUpdater.autoDownload = "download";
    // autoUpdater.allowDowngrade = true;
    autoUpdater.checkForUpdates();
}

const initShortcutKeys = () => {
    const sKeys = [
        ["Esc", () => {             // ゲーム内でのESCキーの有効化
            gameWindow.webContents.send("ESC")
        }],
        ["F5", () => {              // リ↓ロ↑ードする
            gameWindow.reload()
        }],
        ["F6", () => {              // 別のマッチへ
            gameWindow.loadURL("https://krunker.io")
        }],
        ["F7", () => {              // クリップボードへURLをコピー(実質Inviteボタン)
            clipboard.writeText(gameWindow.webContents.getURL())
        }],
        ["F8", () => {              // クリップボードのURLへアクセス(実質Joinボタン)
            let copiedText = clipboard.readText()
            if (lafTools.urlType(copiedText) === "game") gameWindow.loadURL(copiedText)
        }],
        ["Shift+F8", () => {        // URLを入力するフォームの表示
            prompt({
                title: "Input a Game Link",
                label: "URL:",
                value: "",
                inputAttrs: {
                    type: "url"
                },
                type: "input",
                alwaysOnTop: true,
                icon: path.join(__dirname, "img/icon.ico"),
                skipTaskbar: true,
                buttonLabels: {
                    ok: "SUBMIT",
                    cancel: "CANCEL"
                },
                width: 400,
                height: 200,
                customStylesheet: path.join(__dirname, "css/prompt.css")
            })
            .then((r) => {
                if(r === null) {
                    console.log("user cancelled");
                } else {
                    if (lafTools.urlType(r) === "game") gameWindow.loadURL(r);
                }
            })
            .catch(console.error);
        }],
        ["F11", () => {
            isFullScreen = !gameWindow.isFullScreen();
            gameWindow.setFullScreen(isFullScreen);
        }],
        ["Ctrl+Shift+F1", () => {   // クライアントの再起動
            app.relaunch();
            app.quit();
        }],
        ["Ctrl+F1", () => {         // 開発者ツールの起動
            gameWindow.webContents.openDevTools()
        }]
    ];

    sKeys.forEach((k) => {
        localShortcut.register(gameWindow, k[0], k[1])
    });
};


ipcMain.on("OPEN_LINK", (event, arg) => {
    gameWindow.loadURL(arg);
});


ipcMain.on("PROMPT", (e, message, defaultValue) => {
    prompt({
        title: "LaF",
        label: message,
        value: defaultValue,
        inputAttrs: {
            type: "text"
        },
        type: "input",
        alwaysOnTop: true,
        icon: path.join(__dirname, "img/icon.ico"),
        skipTaskbar: true,
        buttonLabels: {
            ok: "SUBMIT",
            cancel: "CANCEL"
        },
        width: 400,
        height: 200,
        customStylesheet: path.join(__dirname, "css/prompt.css")
    })
    .then((r) => {
        if(r === null) {
            console.log("user cancelled");
            e.returnValue = null;
        } else {
            console.log(r)
            e.returnValue = r;
        }
    })
    .catch(console.error);
})

/*
ipcMain.on("PROMPT", (event, message, defaultValue) => {
    prompt({
        title: "LaF",
        label: message,
        value: defaultValue,
        inputAttrs: {
            type: "text"
        },
        type: "input",
        alwaysOnTop: true,
        icon: path.join(__dirname, "img/icon.ico"),
        skipTaskbar: true,
        buttonLabels: {
            ok: "SUBMIT",
            cancel: "CANCEL"
        },
        parent: gameWindow,
        width: 400,
        height: 200,
        customStylesheet: path.join(__dirname, "css/prompt.css")
    })
    .then((r) => {
        if(r === null) {
            console.log("user cancelled");
        } else {
            event.returnValue = r;
        }
    })
    .catch(console.error);
})
*/

ipcMain.on("GET_VERSION", (e) => {
    e.reply("GET_VERSION", app.getVersion())
});

app.on("ready", () => {
    initSplashWindow();
});