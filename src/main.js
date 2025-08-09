const { app, BrowserWindow, Menu, ipcMain } = require("electron")
const path = require("path")

let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
        //icon: path.join(__dirname, "assets/icon.png"),
        icon: path.join(__dirname, 'assets', 'icons', 'simbolo.png'),
        show: false,
    })

    mainWindow.loadFile("src/renderer/index.html")

    const isDev = process.argv.includes('--dev');
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Mostrar janela quando estiver pronta
    mainWindow.once("ready-to-show", () => {
        mainWindow.show()
    })

    // Menu da aplicação
    const template = [
        {
            label: "Arquivo",
            submenu: [
                {
                    label: "Sair",
                    accelerator: "CmdOrCtrl+Q",
                    click: () => {
                        app.quit()
                    },
                },
            ],
        },
        {
            label: "Visualizar",
            submenu: [
                {
                    label: "Recarregar",
                    accelerator: "CmdOrCtrl+R",
                    click: () => {
                        mainWindow.reload()
                    },
                },
                {
                    label: "Ferramentas do Desenvolvedor",
                    accelerator: "F12",
                    click: () => {
                        mainWindow.webContents.toggleDevTools()
                    },
                },
            ],
        },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)

    mainWindow.on("closed", () => {
        mainWindow = null
    })
}

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
})

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
