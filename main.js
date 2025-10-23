const { app, BrowserWindow, session } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 800,
    title: "SimZilla",
    backgroundColor: "#111111",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      devTools: true,
      // Viktigt för webview
      webSecurity: false
    }
  });

  // Konfigurera session för webview
  app.on('web-contents-created', (event, contents) => {
    if (contents.getType() === 'webview') {
      // Tillåt navigation
      contents.on('will-navigate', (event, url) => {
        console.log('Navigating to:', url);
      });
      
      // Tillåt nya fönster
      contents.setWindowOpenHandler(({ url }) => {
        console.log('Opening new window:', url);
        return { action: 'allow' };
      });
    }
  });

  win.loadFile("index.html");

  // Avkommentera för att felsöka:
  // win.webContents.openDevTools();
}

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('disable-site-isolation-trials');

app.whenReady().then(() => {
  // Konfigurera session
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:;']
      }
    });
  });
  
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
