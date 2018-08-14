import { remote, BrowserWindow, ipcRenderer } from 'electron'
import { join } from 'path'

let id = ipcRenderer.sendSync('mainWindowId')

let win: BrowserWindow | null = new remote.BrowserWindow({ width: 346, height: 346, show: false, parent: remote.BrowserWindow.fromId(id) })

win.loadURL(`data:text/html,
<html><script type="text/javascript">

(function () {
  const Module = require('module');
  const NODE_MODULES_PATH = ${JSON.stringify(join(__dirname, '../node_modules'))};
  const NODE_MODULES_ASAR_PATH = NODE_MODULES_PATH + '.asar';

  const originalResolveLookupPaths = Module._resolveLookupPaths;
  Module._resolveLookupPaths = function (request, parent, newReturn) {
    const result = originalResolveLookupPaths(request, parent, newReturn);

    const paths = newReturn ? result : result[1];
    for (let i = 0; i < paths.length; i++) {
      if (paths[i] === NODE_MODULES_PATH) {
        paths.splice(i, 0, NODE_MODULES_ASAR_PATH);
        break;
      }
    }

    return result;
  };
})();

const ipcRenderer = require('electron').ipcRenderer;
const BrowserWindow = require('electron').remote.BrowserWindow;
const { util } = require('mishiro-core');
const { removeSync } = require('fs-extra');

ipcRenderer.on('texture2d', (event, assetbundle, randomId, fromWindowId) => {
  const fromWindow = BrowserWindow.fromId(fromWindowId);
  util.unpackTexture2D(assetbundle).then(result => {
    removeSync(assetbundle);
    fromWindow.webContents.send(randomId, null, result);
  }).catch(e => {
    fromWindow.webContents.send(randomId, e, []);
  });
});

</script></html>
`)

window.addEventListener('beforeunload', () => {
  if (win) win.close()
  win = null
})

export function unpackTexture2D (assetbundle: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let randomId = (Math.round(Math.random() * 346346) + new Date().getTime()).toString()
    ipcRenderer.once(randomId, (_event: Event, err: Error | null, pngs: string[]) => {
      if (err) return reject(err)
      resolve(pngs)
    });

    (win as BrowserWindow).webContents.send('texture2d', assetbundle, randomId, id)
  })
}