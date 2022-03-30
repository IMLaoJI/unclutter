import tinycolor from "tinycolor2";
import { minFontSizePx } from "../../common/defaultStorage";
import { createStylesheetText } from "./common";
import {
    activeColorThemeVariable,
    backgroundColorThemeVariable,
    fontSizeThemeVariable,
    getThemeValue,
    originalBackgroundThemeVariable,
    setCssThemeVariable,
} from "./theme";

const globalParagraphSelector = "p, font, pre";

/*
Find and iterate upon text elements and their parent containers in the article DOM.

This is done so that we can:
 - Remove x margin from elements that contain the article text. We then apply a standardized margin on the <body> tag itself.
 - Remove horizontal layouts in elements that contain the article text, and side margin left over from horizontal partitioning.
 - Remove borders, shadows, and background colors from elements that contain article text.
 - Get the current font size of the main text elements.
*/
export default function iterateDOM() {
    let paragraphs = document.body.querySelectorAll(globalParagraphSelector);
    if (!paragraphs) {
        paragraphs = document.body.querySelectorAll("div, span");
    }

    // Collect elements that contain text nodes
    const containerSelectors = [];
    // Collect overrides for specific container elements (insert as stylesheet for easy unpatching)
    let overrideCssDeclarations = [];
    // Remember background colors on text containers
    const backgroundColors = [];

    const seenNodes = new Set();
    function iterateParents(elem) {
        // Select paragraph children
        if (!seenNodes.has(elem)) {
            const currentSelector = _getNodeSelector(elem);
            containerSelectors.push(`${currentSelector} > p`);
        }

        // Iterate upwards in DOM tree from paragraph node
        let currentElem = elem;
        while (currentElem !== document.body) {
            if (seenNodes.has(currentElem)) {
                break;
            }
            seenNodes.add(currentElem);

            // only iterate main text containers here
            if (_isAsideEquivalent(currentElem)) {
                break;
            }

            const currentSelector = _getNodeSelector(currentElem); // this adds a unique additional classname
            containerSelectors.push(currentSelector);

            // Perform other style changes based on applied runtime style and DOM structure
            const activeStyle = window.getComputedStyle(currentElem);
            overrideCssDeclarations = overrideCssDeclarations.concat(
                _getNodeOverrideStyles(
                    currentElem,
                    currentSelector,
                    activeStyle
                )
            );

            // Remember background colors on text containers
            if (!activeStyle.backgroundColor.includes("rgba(0, 0, 0, 0)")) {
                console.log(currentElem);
                backgroundColors.push(activeStyle.backgroundColor);
            }

            currentElem = currentElem.parentElement;
        }
    }

    paragraphs.forEach((elem) => {
        // Ignore invisible nodes
        // Note: iterateDOM is called before content block, so may not catch all hidden nodes (e.g. in footer)
        if (elem.offsetHeight === 0) {
            return;
        }

        iterateParents(elem.parentElement);
    });

    function fadeOut() {
        _processBackgroundColors(backgroundColors);
    }

    function pageViewTransition() {
        // Adjust font according to theme
        // _setTextFontOverride(largestElem);

        // Removing margin and cleaning up background, shadows etc
        createStylesheetText(
            _getTextElementChainOverrideStyle(containerSelectors),
            "lindy-text-chain-override"
        );

        // Display fixes with visible layout shift (e.g. removing horizontal partitioning)
        createStylesheetText(
            overrideCssDeclarations.join("\n"),
            "lindy-node-overrides"
        );
    }

    return [fadeOut, pageViewTransition];
}

// undo pageViewTransition()
export function unPatchDomTransform() {
    document
        .querySelectorAll(
            ".lindy-font-size, .lindy-text-chain-override, .lindy-node-overrides"
        )
        .forEach((e) => e.remove());
}

const asideWordBlocklist = [
    "header",
    "footer",
    "aside",
    "sidebar",
    "comment",
    "language",
];
function _isAsideEquivalent(node) {
    return (
        node.tagName === "HEADER" ||
        node.tagName === "FOOTER" ||
        node.tagName === "ASIDE" ||
        node.tagName === "CODE" ||
        asideWordBlocklist.some(
            (word) =>
                node.className.toLowerCase().includes(word) ||
                node.id.toLowerCase().includes(word)
        ) ||
        node.hasAttribute("data-language")
    );
}

// Get a CSS selector for the passed node with a high specifity
function _getNodeSelector(node) {
    // Create new unique class
    const containerId = `container_${Math.random().toString().slice(2)}`;
    node.classList.add(containerId); // will only be applied in next loop

    // construct selector in "tag.class[id='id']" format
    const classNames = [containerId].map((className) => `.${className}`);
    const completeSelector = `${node.tagName.toLowerCase()}${classNames.join(
        ""
    )}${node.id ? `[id='${node.id}']` : ""}`;
    return completeSelector;
}

// Get a CSS selector that uses all classes of this element
// Used to select sibling text containers that use the same style
function _getSiblingSelector(node) {
    // only allow valid CSS classnames, e.g. not starting with number
    return [...node.classList]
        .filter((classname) => /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(classname))
        .map((className) => `.${className}`)
        .join("");
}

function _getNodeOverrideStyles(node, currentSelector, activeStyle) {
    const overrideCssDeclarations = [];
    // Remove horizontal flex partitioning
    // e.g. https://www.nationalgeographic.com/science/article/the-controversial-quest-to-make-a-contagious-vaccine
    if (activeStyle.display === "flex" && activeStyle.flexDirection === "row") {
        overrideCssDeclarations.push(`${currentSelector} { display: block; }`);
        // TODO hide siblings instead
    }

    // Remove grids
    // e.g. https://www.washingtonpost.com/business/2022/02/27/bp-russia-rosneft-ukraine
    // https://www.trickster.dev/post/decrypting-your-own-https-traffic-with-wireshark/
    if (activeStyle.display === "grid") {
        overrideCssDeclarations.push(`${currentSelector} {
            display: block;
            grid-template-columns: 1fr;
            grid-template-areas: none;
            column-gap: 0;
        }`);
    }

    return overrideCssDeclarations;
}

function _getTextElementChainOverrideStyle(containerSelectors) {
    // Remove margin from matched paragraphs and all their parent DOM nodes
    const matchedTextSelector = containerSelectors.join(", ");
    return `${matchedTextSelector} {
        width: 100% !important;
        min-width: 0 !important;
        max-width: calc(var(--lindy-pagewidth) - 2 * 40px) !important;
        margin-left: auto !important;
        margin-right: auto !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        background: none !important;
        border: none !important;
        box-shadow: none !important;
        transition: all 0.2s;
    }`;
}

function _setTextFontOverride(largestElem) {
    // Base on size of largest text element
    const activeStyle = window.getComputedStyle(largestElem);

    // Set font size to use as CSS variable
    const activeFontSizePx = Math.max(
        parseFloat(activeStyle.fontSize),
        minFontSizePx
    );
    setCssThemeVariable(fontSizeThemeVariable, `${activeFontSizePx}px`);

    // Convert line-height to relative and specify override, in case it was set as px
    // results in NaN if line-height: normal -- which is fine.
    const relativeLineHeight = (
        parseFloat(activeStyle.lineHeight.replace("px", "")) /
        parseFloat(activeStyle.fontSize.replace("px", ""))
    ).toFixed(1);

    const fontSizeStyle = `${globalParagraphSelector} {
        font-size: var(${fontSizeThemeVariable}) !important;
        line-height: ${relativeLineHeight} !important;
    }`;

    // setCssThemeVariable("--lindy-original-font-size", activeStyle.fontSize);
    createStylesheetText(fontSizeStyle, "lindy-font-size");
}

function _processBackgroundColors(textBackgroundColors) {
    // Colors are in reverse-hierarchical order, with ones closest to the text first
    // console.log("Found background colors:", textBackgroundColors);

    // <body> background color was already saved in ${originalBackgroundThemeVariable} in background.js
    const bodyColor = getThemeValue(originalBackgroundThemeVariable);
    console.log(textBackgroundColors, bodyColor);

    // Pick original color from text stack if set, otherwise use body color
    let pickedColor;
    if (textBackgroundColors.length > 0) {
        pickedColor = textBackgroundColors[0];
    } else {
        pickedColor = bodyColor;
    }

    const brightness = tinycolor(pickedColor).getBrightness();
    if (brightness > 230) {
        // too light colors conflict with white background
        pickedColor = "white";
    }

    setCssThemeVariable(originalBackgroundThemeVariable, pickedColor, true);

    const themeName = getThemeValue(activeColorThemeVariable);
    if (!themeName || themeName === "auto") {
        setCssThemeVariable(backgroundColorThemeVariable, pickedColor, true);
    }
}
