// https://stackoverflow.com/questions/27241281/what-is-anchornode-basenode-extentnode-and-focusnode-in-the-object-returned
// https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection

let ports = {};

setupSettings();

chrome.contextMenus.onClicked.addListener(async function(info, tab){
    if (info.menuItemId === "reload") {
        chrome.runtime.reload();
        return;
    }

    if (tab.id < 0) return; // if tab id is -1, means that it isn't available (i think?? anyway chrome extension no likey so i'll check for it here.)

    // inject content script if haven't already
    if (!ports[tab.id]) {
        chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["polyphi.css"]
        });
        await injectContentScript(tab);
    }

    // ctrls
    ports[tab.id].postMessage({msg: info.menuItemId});
});


// funcs fun !
async function setupSettings() {
    let initializedSettings = await getFromStorage("initializedSettings");

    if (!initializedSettings) {
        chrome.storage.sync.set ({ ignorePageNumbers: true});
        chrome.storage.sync.set ( { ignoreFirstLine: true } ); 
        chrome.storage.sync.set ({ soundOn: false });

        chrome.storage.sync.set ({ initializedSettings: true });

        // chrome.storage.sync.get(console.log); to print contents of storage
    }
}

async function getFromStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(key, resolve);
    })
        .then(result => {
            if (key == null) return result;
            else return result[key];
        });
}

function injectContentScript(tab) {
    return new Promise ( (resolve, reject) => {
        chrome.scripting.executeScript({
            target : {tabId : tab.id},
            files : [ "findPolyphi.js" ],
        })
        .then( async () => {
            // const response = await chrome.tabs.sendMessage(tab.id, {msg: "create content script port", tabId: tab.id});
            // console.log(response);

            const port = chrome.tabs.connect(tab.id, { name: `cs${tab.id}` });
            ports[tab.id] = port;
            
            port.onDisconnect.addListener(() => {
                delete ports[tab.id];
            });

            console.log("findPolyphi.js script injected");
            resolve("done!");
        });
        
    })
}

// menus

chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
        id: "main",
        title: "polyphi, i choose you!",
        contexts:["all"],
        documentUrlPatterns: ["https://*.submittable.com/submissions/*"]
    });
    chrome.contextMenus.create({
        parentId: "main",
        id: "menu",
        title: "menu",
        contexts:["all"],
        documentUrlPatterns: ["https://*.submittable.com/submissions/*"]
    });
    // find tools
    chrome.contextMenus.create({
        parentId: "main",
        id: "line break",
        title: "line break",
        contexts:["selection"],
    }); 
    chrome.contextMenus.create({
        parentId: "main",
        id: "indent",
        title: "indent",
        contexts:["selection"],
    }); 

    // customizer tools
    chrome.contextMenus.create({
        parentId: "main",
        id: "custom",
        title: "custom",
        contexts:["selection"]
    }); 
    chrome.contextMenus.create({
        parentId: "custom",
        id: "custom start",
        title: "start",
        contexts:["selection"]
    }); 
    chrome.contextMenus.create({
        parentId: "custom",
        id: "custom line break",
        title: "line break",
        contexts:["selection"]
    }); 
    chrome.contextMenus.create({
        parentId: "custom",
        id: "custom indent",
        title: "indent",
        contexts:["selection"]
    }); 
    chrome.contextMenus.create({
        parentId: "custom",
        id: "custom block",
        title: "block",
        contexts:["selection"]
    }); 

    // reset tools
    chrome.contextMenus.create({
        parentId: "main",
        id: "reset",
        title: "reset",
        contexts:["all"]
    }); 
    chrome.contextMenus.create({
        parentId: "reset",
        id: "reset start",
        title: "start",
        contexts:["all"]
    }); 
    chrome.contextMenus.create({
        parentId: "reset",
        id: "reset line break / indent",
        title: "line break / indent",
        contexts:["all"]
    }); 
    chrome.contextMenus.create({
        parentId: "reset",
        id: "reset custom block line(s)",
        title: "custom block line(s)",
        contexts:["all"]
    }); 
    chrome.contextMenus.create({
        parentId: "reset",
        id: "reset all custom blocks",
        title: "all custom blocks",
        contexts:["all"]
    }); 
    chrome.contextMenus.create({
        parentId: "reset",
        id: "reset all highlights",
        title: "all highlights",
        contexts:["all"]
    });
    chrome.contextMenus.create({
        parentId: "main",
        id: "reload",
        title: "reload",
        contexts:["all"]
    });
});

// chrome.contextMenus.onClicked.addListener(findPolyphi);