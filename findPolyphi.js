// CUSTOM STANZAS, CHECK IF SELECT CORRECT TYPE SECURITY (getSelected() is now deprecated)

var blockDenotation;

var type;
var lineToFindPos;
var allPages;
var firstPageLines;
var selectedPageNum;

var blocksGap;
var roundTo = 2;
var stanzaGapTolerance = 0.01;
var gapType = "default";

var start;
var defaultStartLine;

// for highlighting
var prevFoundLine;
var highlightedLines = null;
var startHighlight = "#046404"; // emerald green
var foundHighlight = "#FFCC02"; // gold
var highlightRangeColors = ["#ffadad","#ffd6a5","#fdffb6","#caffbf","#9bf6ff","#a0c4ff","#bdb2ff","#ffc6ff"];
                            // pastel!! https://colorkit.co/palette/ffadad-ffd6a5-fdffb6-caffbf-9bf6ff-a0c4ff-bdb2ff-ffc6ff/

// custom stanza
var customBlockBorderStyle = "5px solid black";

// settings
var settings = {};

// setup menu
var menuContainer;
var menu;
var menuDisplaying = false;
var settingUpMenu = false;

// in case reloaded, remove remnants of old content script
resetAllHighlights();
removeMenu();

// port
chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(async (request, sender, sendResponse) => {
        if (!menuContainer) {
            settingUpMenu = true;
            await setupMenu();
            settingUpMenu = false;
        }
        if (!blockDenotation) {
            let tags = document.getElementsByClassName("a2WXhAh5MzuB6U2_rbaU");
            for (let i = 0; i < tags.length; i++) {
                let text = tags[i].innerText.toLowerCase();
                if (text === "poetry") {
                    blockDenotation = "S";
                    break;
                }
                else if (text === "fiction" || text === "creative nonfiction") {
                    blockDenotation = "P";
                    break;
                }
            }
            if (!blockDenotation) blockDenotation = "S";
        }

        allPages = document.getElementsByClassName("page"); 
        if (allPages.length > 0) firstPageLines = getPageLines(1);
        
        if (request.msg === "line break" || request.msg === "indent") {
            await playSound("/sounds/peck.mp3");

            type = request.msg;
            if (!setupFind()) {
                console.log("setting up find failed!");
                return;
            }

            let pos = findPos();
            if (pos) {
                alert(pos);
            }
            else {
                console.log("finding failed!");
            }
        }
        else if (request.msg.startsWith("custom ")){
            await playSound("/sounds/chirp-rise.mp3");

            if (!isSelectionHighlighted()) return;
            if (request.msg === "custom start") {
                unhighlightRange();
                setCustomStart();
            }
            else if (request.msg === "custom line break") {
                setCustomLineBreak();
            }
            else if (request.msg === "custom indent") {
                setCustomIndent();
            }
            else if (request.msg === "custom block") {
                setCustomBlock();
            }
        }
        else if (request.msg.startsWith("reset ")){
            await playSound("/sounds/chirp-fall.mp3");

            if (request.msg === "reset start") {
                unhighlightRange();
                setDefaultStart();
            }
            else if (request.msg === "reset all custom blocks") {
                resetAllCustomBlocks();
            }
            else if (request.msg === "reset all highlights") {
                resetAllHighlights();
            }
            else { // resetters that require selection
                if (!isSelectionHighlighted()) return;

                if (request.msg === "reset line break / indent") {
                    gapType = "default";
                }
                else if (request.msg === "reset custom block line(s)") {
                    resetCustomBlockLines();
                }
            }
        }
        else if (request.msg === "menu") {
            await playSound("/sounds/chirp-up-down.mp3");

            toggleMenu();
        }
    });
});

// funcs fun!

function setupMenu() {
    return new Promise(async (resolve) => {
        settings["ignorePageNumbers"] = await getFromStorage("ignorePageNumbers");
        settings["ignoreFirstLine"] = await getFromStorage("ignoreFirstLine");
        settings["soundOn"] = await getFromStorage("soundOn");
    
        menuContainer = document.createElement("div");
        menuContainer.setAttribute("id", "polyphi-menu-container");
    
        menu = document.createElement("div");
        menu.setAttribute("id", "polyphi-menu");
    
        const title = document.createElement("h1");
        title.setAttribute("id", "polyphi-menu-title");
        title.innerText = "menu";
    
        menu.appendChild(title);
    
        setupToggle("ignorePageNumbers", "ignore page numbers", settings["ignorePageNumbers"]);
        setupToggle("ignoreFirstLine", "ignore first line", settings["ignoreFirstLine"]);
        setupToggle("soundOn", "sound", settings["soundOn"]);
    
        menuContainer.appendChild(menu);
        document.body.appendChild(menuContainer);
    
        menuContainer.addEventListener('click', toggleMenu);
        resolve();
    })
}

function removeMenu() {
    let menu = document.getElementById("polyphi-menu-container");
    if (menu) {
        document.body.removeChild(menu);
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

function setupToggle(settingVar, settingDesc, initVal) {
    const container = document.createElement("div");

    const label = document.createElement("label");
    label.classList.add("switch");

    const input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    input.checked = initVal;

    const span = document.createElement("span");
    span.classList.add("slider", "round");

    label.addEventListener('change', async function(event) {
        settings[settingVar] = event.target.checked;
        
        chrome.storage.sync.set ( { [settingVar]: settings[settingVar] } ); 
            /*
                since chrome.storage.sync.set ({ settingVar : settings[settingVar] });
                doesn't work, thinks that settingVar is a key
            */
    });
    label.appendChild(input);
    label.appendChild(span);

    const setting = document.createElement("span");
    setting.innerText = settingDesc;

    container.appendChild(setting);
    container.appendChild(label);

    menu.appendChild(container);

    return label;
}

async function toggleMenu() {
    menuDisplaying = !menuDisplaying;
    if (!menuContainer) {
        menuContainer = document.getElementById("polyphi-menu-container");
        menu = document.getElementById("polyphi-menu");
        if (!menuContainer) {
            setupMenu();
        }
    }
    if (menuDisplaying) {
        menuContainer.style.display = "flex";
    }
    else {
        menuContainer.style.display = "none";
    }
}

function isSelectionHighlighted() {
    let selection = document.getSelection();
    return !selection.isCollapsed;
}

function setupFind() {
    lineToFindPos = getSingleLine();
    if (!lineToFindPos) {
        return false;
    }

    selectedPageNum = findPageNum(lineToFindPos.parentElement.parentElement);

    if (!start || start.type === "default") {
        setDefaultStart(); // if ignoreFirstLine has been changed and is default start, need to update start
    }

    // remove old highlights, add new ones
    unhighlightRange();
    if (prevFoundLine) {
        prevFoundLine.style.background = "";
    }

    start.htmlEl.style.background = startHighlight;
    
    highlightedLines = [];
    highlightedLines.push([]);

    if (gapType === "default") {
        if (type === "line break") {
            blocksGap = findStanzasGap();
        }
        else if (type === "indent") {
            blocksGap = findIndentGap();
        }
    }

    return true;
}

function getSelectedLines() {
    let selectedElements = [];
    let range = document.getSelection().getRangeAt(0);
    let curPg = null;
    
    if (range) {
        let child = range.startContainer.parentElement;
        let endChild = range.endContainer.parentElement;

        while (child != endChild) {
            if (child.tagName.toLowerCase() === "span") {
                selectedElements.push(child);
            }
            child = child.nextElementSibling;

            if (isEndOfPage(child)) { // if end of page, go to next page
                curPg = child.parentElement.parentElement.nextElementSibling;
                if (curPg) { 
                    child = curPg.lastElementChild.firstElementChild; // textlayer > first line
                }
                else {
                    break;
                }
            }
        }

        if (endChild.tagName.toLowerCase() === "span") selectedElements.push(endChild);
    }
  
    return selectedElements;
}

function isEndOfPage(el) {
    return el.tagName.toLowerCase() === "div" && el.classList.contains("endOfContent")
}

function setCustomLineBreak() {
    let range = document.getSelection().getRangeAt(0);

    if (isMultipleLines(range)) {
        let dif = roundDif(
            calcTopVal(range.endContainer.parentElement.outerHTML) -
            calcTopVal(range.startContainer.parentElement.outerHTML)
        );
        if (dif > 0) {
            blocksGap = dif;
            gapType = "custom";
        } 
    }
}

function setCustomIndent() {
    let selectedLine = getSingleLine();
    if (selectedLine) {
        let indent = calcLeftVal(selectedLine.outerHTML);
        if (indent > 0) {
            blocksGap = indent;
            gapType = "custom";
        }
    }
}

function setCustomBlock() {
    let selectedLines = getSelectedLinesLogic();
    if (!selectedLines) return;

    setCustomBlockLines(selectedLines);
}

function getSelectedLinesLogic() {
    if (!isSelectionHighlighted()) {
        return null;
    }
    let range = document.getSelection().getRangeAt(0);
    let selectedLines = null;
    if (range) {
        if (isMultipleLines(range) || isSingleLine(range)) {
            selectedLines = getSelectedLines();
        }
    }

    return selectedLines;
}

function isMultipleLines(range) {
    let res = false;

    let start = range.startContainer.parentElement;
    let end = range.endContainer.parentElement;

    if (start && end) {
        if (start.tagName.toLowerCase() == "span" && end.tagName.toLowerCase() == "span") {
            res = true;
        }
    }

    return res;
}

function isSingleLine(range) {
    return  range.commonAncestorContainer &&
            range.commonAncestorContainer.parentElement &&
            range.commonAncestorContainer.parentElement.tagName.toLowerCase() === "span";
}

function getSingleLine() { // lenient. if selected multiple lines, then returns first line selected
    let singleLine = getSelectedLinesLogic();

    if (singleLine && singleLine[0]) {
        singleLine = singleLine[0];
        return singleLine;
    }
    else {
        return null;
    }
}

function setCustomBlockLines(lines) {
    let id = this.crypto.randomUUID();
    let borderStyle = customBlockBorderStyle;
    if (Array.isArray(lines)) {
        lines.forEach((line) => {
            line.setAttribute("custom-block", id);
            line.style.borderTop = ""; // reset border (if override previously made custom stanza)
            line.style.borderBottom = "";
        });
        lines[0].style.borderTop = borderStyle;
        lines[lines.length - 1].style.borderBottom = borderStyle;
    }
}

function resetCustomBlockLines() {
    let selectedLines = getSelectedLinesLogic();
    if (!selectedLines) {
        alert("Need to select line(s) to reset!");
        return;
    }

    // erase old borders 
    selectedLines.forEach((line) => {
        line.setAttribute("custom-block", "");
        line.style.borderTop = "";
        line.style.borderBottom = "";
    })

    // draw new borders:

    // top border
    let lineBefore = selectedLines[0].previousElementSibling;
    while (lineBefore && lineBefore.tagName.toLowerCase() !== "span") { // find prev line on current page
        lineBefore = lineBefore.previousElementSibling;
    }
    if (!lineBefore) { // find prev line on page before
        let prevPg = selectedLines[0].parentElement.parentElement.previousElementSibling;
        if (prevPg) {
            lineBefore = prevPg.lastElementChild.lastElementChild; // textLayer > last line
            while (lineBefore && lineBefore.tagName.toLowerCase() !== "span") {
                lineBefore = lineBefore.previousElementSibling;
            }
        }
    }

    if (lineBefore && lineBefore.getAttribute("custom-block")) {
        lineBefore.style.borderBottom = customBlockBorderStyle;
    }

    // bottom border (technically could make top/bottom border one singular func, but i don't think it's necessary)
    let lineAfter = selectedLines[selectedLines.length - 1].nextElementSibling;
    while (lineAfter && lineAfter.tagName.toLowerCase() !== "span") { // find prev line on current page
        lineAfter = lineAfter.nextElementSibling;
    }
    if (!lineAfter) { // find prev line on page before
        let nextPg = selectedLines[selectedLines.length - 1].parentElement.parentElement.nextElementSibling;
        if (nextPg) {
            lineAfter = nextPg.lastElementChild.firstElementChild; // textLayer > first line
            while (lineAfter && lineAfter.tagName.toLowerCase() !== "span") {
                lineAfter = lineAfter.nextElementSibling;
            }
        }
    }

    if (lineAfter && lineAfter.getAttribute("custom-block")) {
        lineAfter.style.borderTop = customBlockBorderStyle;
    }
} 

function resetAllCustomBlocks() {
    if (allPages) {
        for (let i = 1; i <= allPages.length; i++) {
            let lines = getPageLines(i);
            lines.forEach((line) => {
                line.setAttribute("custom-block", "");
                line.style.borderTop = "";
                line.style.borderBottom = "";
            });
        }
    }
}

function setDefaultStart() {
    if (start && start.htmlEl) { // remove previous start's highlight 
        start.htmlEl.style.background = "";
    } 

    if (!allPages || !firstPageLines || !firstPageLines[0]) {
        alert("select a line first");
        return;
    }

    if (settings["ignoreFirstLine"] && firstPageLines[1]) {
        defaultStartLine = firstPageLines[1];
    }
    else {
        defaultStartLine = firstPageLines[0];
    }

    start = new Object();
    start.htmlEl = defaultStartLine; // set start to second non-blank line
    start.pageNum = 1;
    start.type = "default";
    start.htmlEl.style.background = startHighlight;
}

function setCustomStart() {
    if (start && start.htmlEl) start.htmlEl.style.background = ""; // remove previous start's highlight 
    let selectedLine = getSingleLine();
    if (selectedLine) {
        start = new Object();
        start.htmlEl = selectedLine;
        start.pageNum = findPageNum(start.htmlEl.parentElement.parentElement);
        start.type = "custom";
        start.htmlEl.style.background = startHighlight;
    }
}

function findPos() {
    let pageNum = start.pageNum;
    let blockNum = 1;
    let lineNum = 0;
    let prevCustomBlockId = null; 

    let curLine = null;
    let foundStart = false;

    if (start.type === "default" && settings["ignoreFirstLine"] && lineToFindPos === firstPageLines[0]) {
        return `${blockDenotation}0, L1`;
    }
    else if (start.htmlEl === lineToFindPos) { // if choosing start, then already found 
        return `${blockDenotation}1, L1`;
    }

    while (pageNum <= selectedPageNum) {
        let lines = getPageLines(pageNum);
        lines = Array.from(lines);

        for (let i = 0; i < lines.length; i++) {
            curLine = lines[i];

            // SKIP UNTIL REACH THE START
            if (!foundStart) {
                if (curLine === start.htmlEl) foundStart = true;
                else continue;
            }

            // FIND POSITION
            let isNewBlock = false;

            // custom stanza part, evals no matter what (no setting rn)
            let curCustomBlockId = curLine.getAttribute("custom-block");
            if (!curCustomBlockId) curCustomBlockId = ""; // no custom-block id is same as custom-block id that is empty
            
            if (prevCustomBlockId !== null) {
                if (prevCustomBlockId !== curCustomBlockId) {
                    isNewBlock = true;
                }
                else if (curCustomBlockId === "") { // otherwise, is in custom block (don't check for line break/indent)
                    if (type === "line break" && i > 0 && curLine !== start.htmlEl) {
                        let lineGap = calcTopDif(lines, i - 1, i);
                        if (Math.abs(lineGap - blocksGap) <= stanzaGapTolerance) {
                            isNewBlock = true;
                        }
                    }
                    else if (type === "indent" && curLine !== start.htmlEl) {
                        let indentGap = calcLeftVal(lines[i].outerHTML);
                        if (indentGap === blocksGap) isNewBlock = true;
                    }
                }
            }

            prevCustomBlockId = curCustomBlockId;

            // new stanza/paragraph?
            if (isNewBlock) { 
                blockNum++;
                lineNum = 1;
                highlightedLines.push([]);
            }
            else { // same stanza/paragraph, new line
                lineNum++;
            }

            if (curLine === lineToFindPos) {
                // highlight traversed lines
                highlightedLines[0].shift(); // first line removed (highlighted instead as the start)
                highlightRange(highlightedLines);

                // highlight selected line
                curLine.style.background = foundHighlight;
                prevFoundLine = curLine;

                let resultPosition = `${blockDenotation}${blockNum}, L${lineNum}`;
                navigator.clipboard.writeText(resultPosition);

                return resultPosition;
            }

            // track highlightable elements (everything traversed from start to selected line)
            highlightedLines[blockNum - 1].push(curLine);
        }

        pageNum++;
    }

    alert("Whoops! Something weird happened... Did you accidentally select something before the starting line?");
    return null;
}

function unhighlightRange() {
    if (highlightedLines && Array.isArray(highlightedLines) && Array.isArray(highlightedLines[0])) {
        highlightedLines.forEach((block) => {
            block.forEach((line) => {
                line.style.background = "";
            })
        });
        highlightedLines = null;
    }
}

function highlightRange(lines) {
    let c = 0;
    let len = highlightRangeColors.length;

    lines.forEach((block) => {
        block.forEach((line) => {
            line.style.background = highlightRangeColors[c % len];
        })
        c++;
    });
}

function resetAllHighlights() {
    if (!allPages) allPages = document.getElementsByClassName("page");
    for (let i = 1; i <= allPages.length; i++) {
        if (!allPages[i - 1].children || allPages[i - 1].children[0].classList.contains("loadingIcon")) {
            break; // pages at and after this point haven't loaded
        }
        let lines = getPageLines(i);
        lines.forEach((line) => {
            line.style.background = "";
        })
    }
}

function findStanzasGap() {
    if (typeof firstPageLines === "undefined") console.error("firstPageLines not initialized! please do so...");
    return calcTopDif(firstPageLines, 0, 1);
}

function findIndentGap() {
    if (typeof firstPageLines === "undefined") {
        console.log("firstPageLines not initialized! please do so...");
        return;
    }
    else if (!defaultStartLine) {
        console.log("defaultStartLine not initialized! please do so...");
        return;
    }
    return calcLeftVal(defaultStartLine.outerHTML); // get indent gap (first line after title is assumed to be a paragraph and therefore indented)
}

function getPageLines(n) { // gets page textLayer. page count starts at 1!!
    if (typeof allPages === "undefined") console.error("allPages not initialized! please do so...");
    if (n <= 0) console.error("getPageLines error... page num can't be 0 or less than 0!");
    let page = allPages[n - 1].children[1]; // pages > page > textLayer
    let lines = cleanPageLines(page);
    if (!lines) alert("error... lines not found");
    return lines;
}

function cleanPageLines(page) {
    if (!page) {
        console.error("no page");
        return;
    }
    if (!page.classList.contains("textLayer")) {
        console.error("input is not a textLayer!!");
        return;
    }
    let lines = page.querySelectorAll("span"); // removes all br elements
    return cleanLines(lines);
}

function cleanLines(lines) {
    let isNumber = (val) => /^\d+$/.test(val);

    let cleanedLines = Array.from(lines).filter(function(line) { // turn lines from nodelist to array, remove empty lines (or indicate page number, if ignorePageNumbers setting is on)
        let valid = line.innerText !== "";
        if (valid && settings["ignorePageNumbers"]) valid = !isNumber(line.innerText);
        return valid;
    });

    return cleanedLines;
}

function findPageNum(page) {
    if (!page.classList.contains("page")) {
        console.error("input is not a page!!");
        console.log(page);
    }
    return page.getAttribute("data-page-number");
}

/* line vals */
function calcTopVal(el) { // top value shall distinguish where in selectedPage the line is located in
    if (typeof el === "string") { // for string representation of html
        var regex = /top:\s*([\d.]+)px;/;
        return regex.exec(el)[1];
    }
    else if (el instanceof HTMLElement) { // for html element, currently UNUSED because it returns slightly different value from actual value in html
        return window
        .getComputedStyle(el, null)
        .getPropertyValue('top')
        .match(/\d+(\.\d+)?/)[0]; // just find the float part, don't include 'px' // match returns array, just need to get captured part (which is first element of returned array)
    } 
    else return null;
}

function calcTopDif(lines, n1, n2) {
    const dif = roundDif(
        calcTopVal(lines[n2].outerHTML) -
        calcTopVal(lines[n1].outerHTML)
    );
    return dif; // round to x decimal places
}

function roundDif(val) {
    return val.toFixed(roundTo);
}

function calcLeftVal(el) { // basically same as top val func lol i'm lazy
    if (typeof el === "string") { // for string representation of html
        var regex = /left:\s*([\d.]+)px;/;
        return regex.exec(el)[1];
    }
    else if (el instanceof HTMLElement) { // for html element, currently UNUSED because it returns slightly different value from actual value in html
        return window
        .getComputedStyle(el, null)
        .getPropertyValue('left')
        .match(/\d+(\.\d+)?/)[0];
    } 
    else return null;
}

function playSound(path) {
    return new Promise((resolve) => {
        if (!settings["soundOn"]) {
            resolve();
        }
        else {
            let sound = new Audio(chrome.runtime.getURL(path));
            // sound.preload = "auto";
            sound.onloadeddata = function() {
                sound.play();
                resolve();
            };
        }
    })
}

/*

submittable pdf hierarchy:

page elements.
- page > canvasWrapper, textLayer.
- textLayer > span, br, span, br .... (span contains the actual line) 


technicalities with output:

- title is s0, l1.

features:

- sound.
-- wanted to include woodpecker chirping noises, but they sound so annoying... https://www.youtube.com/watch?v=FJUISQbKz0Q

limits:
- Reloading uses the method chrome.runtime.reload()
-- This method is not supported in kiosk mode. For kiosk mode, need to use chrome.runtime.restart() method.

bugs:
- reload the tab if anything weird happens... (ex: function repeats itself, highlights not unhighlighting, multiple sounds playing)

additional notes:

- i'm lazy, so i'll keep the playSound as a promise even when i don't use it as a promise lmao

- not sure why top value changes when refresh tab. doesn't seem to change based on page zoom... hmhm...

- alternate way to access top value:

var regex = /top:\s*([\d.]+)px;/;
var res = regex.exec(parentEl.outerHTML)[1];

- alternate way to access page number: 
use style attribute "data-page-number" from element "page"

*/