require('v8-compile-cache');
const { ipcRenderer } = require('electron');
const store = require('electron-store');
const log = require('electron-log');
const path = require('path');
const tools = require('../util/tools');

const osType = process.platform;
const config = new store();

const langPack = require(config.get('lang') === 'ja_JP' ? '../../lang/ja_JP' : '../../lang/en_US');

log.info('Script Loaded: js/preload/preload.js');


const isEnabledTimer = config.get('enableTimer', true);
const devMode = config.get('devmode');

window.prompt = (message, defaultValue) => {
    return ipcRenderer.sendSync('showPrompt', message, defaultValue);
};
window.OffCliV = true;

const injectWaterMark = () => {
    const gameUIEl = document.getElementById('gameUI');
    ipcRenderer.invoke('getAppVersion').then((v) => {
        gameUIEl.insertAdjacentHTML('beforeend', `
        <div id='LaFWaterMark' style='position:absolute;font-size:15px;bottom:5px;right:5px;color:rgba(255, 255, 255, .75);'>LaF v${v}</div>
        `);
    });
};

const initMenuTimer = () => {
    const instructions = document.getElementById('instructions');
    const menuTimerText = `
    <div id='menuTimer' style='position:absolute;top:55%;left:50%;margin-right:50%;transform:translate(-50%,-50%);font-size:50px;color:rgba(255, 255, 255, 0.8);'>00:00</div>
    `;
    instructions.insertAdjacentHTML('afterend', menuTimerText);

    const getActivity = () => {
        let gameActivity;
        try {
            gameActivity = window.getGameActivity();
        }
        catch (e) {
            // 何もしなくていい
        }
        const time = Math.floor(gameActivity.time);
        const timerS = time % 60;
        const timerM = time < 60 ? '0' : (time - timerS) / 60;
        document.getElementById('menuTimer').innerText = (`${('0' + timerM).slice(-2)}:${('0' + timerS).slice(-2)}`);
    };
    setInterval(getActivity, 500);
};

// イベントハンドラ
ipcRenderer.on('ESC', () => {
    document.exitPointerLock();
});

document.addEventListener('DOMContentLoaded', () => {
    window.gt = new tools.gameTools();
    const winObserver = new MutationObserver(() => {
        winObserver.disconnect();
        if (isEnabledTimer) initMenuTimer();
        window.closeClient = () => {
            ipcRenderer.send('exitClient');
        };
    });
    winObserver.observe(document.getElementById('instructions'), { childList: true });
});

ipcRenderer.on('didFinishLoad', () => {
    injectWaterMark();

});