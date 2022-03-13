import postcss, { Declaration, Plugin, PluginCreator } from "postcss";
import safeParser from "postcss-safe-parser";

// The extension reduces the website body width to show annotations on the right side.
// But since CSS media queries work on the actual viewport width, responsive style doesn't take this reduced body width into account.
// So parse the website CSS here and return media queries with the correct width breakpoints.
export async function getCssOverride(
    cssUrl: string,
    cssText: string,
    conditionScale: number
): Promise<string> {
    const plugins = [
        scaleBreakpointsPlugin(conditionScale),
        urlRewritePlugin(cssUrl),
        hideFixedElementsPlugin,
        styleTweaksPlugin,
    ];

    const result = await postcss(plugins).process(cssText, {
        parser: safeParser,
    });

    return result.css;
}

/**
 * Create override media rules upscaled to the entire page.
 * Assuming scale factor 2 (page now takes up only 50% of the screen):
 *     max-width 1 -> max-width 2
 *     min-width 1 -> min-width 2
 *         since we remove the old style, no need to negate old [1, 2] range
 */
const scaleBreakpointsPlugin: PluginCreator<number> = (conditionScale) => ({
    postcssPlugin: "scale-media-breakpoints",
    AtRule(rule) {
        if (rule.name === "media") {
            // any change will re-trigger listeners
            if (rule["alreadyProcessed"]) {
                return;
            }

            let condition = rule.params;
            for (const match of rule.params.matchAll(/([0-9]+)/g)) {
                const oldCount = parseInt(match[1]);
                const newCount = Math.round(conditionScale * oldCount);

                condition = condition.replace(
                    oldCount.toString(),
                    newCount.toString()
                );
            }

            rule.params = condition;
            rule["alreadyProcessed"] = true;
        }
    },
});
scaleBreakpointsPlugin.postcss = true;

// use absolute paths for files referenced via url()
// those paths are relative to the stylesheet url, which we change
const urlRewritePlugin: PluginCreator<string> = (baseUrl) => ({
    postcssPlugin: "rewrite-relative-urls",
    AtRule(rule) {
        if (rule.name === "import") {
            const url = rule.params.match(/"?'?([^\)]*?)"?'?\)/g)?.[1];
            const absoluteUrl = new URL(url, baseUrl);
            rule.params = rule.params.replace(url, absoluteUrl.href);
        }
    },
    Declaration(decl) {
        if (decl.value.startsWith("url(")) {
            // any change will re-trigger listeners
            if (decl["alreadyProcessed"]) {
                return;
            }
            // short-circuit base64 urls for performance
            if (decl.value.startsWith("url(data:")) {
                return;
            }

            let newValue = decl.value;
            for (const match of decl.value.matchAll(
                /url\((?!"?'?(?:data:|#|https?:\/\/))"?'?([^\)]*?)"?'?\)/g
            )) {
                const url = match[1];
                const absoluteUrl = new URL(url, baseUrl);
                newValue = newValue.replace(url, absoluteUrl.href);
            }

            decl.value = newValue;
            decl["alreadyProcessed"] = true;
        }
    },
});
urlRewritePlugin.postcss = true;

// hide fixed and sticky positioned elements (highly unlikely to be part of the text)
const hideFixedElementsPlugin: Plugin = {
    postcssPlugin: "hide-fixed-elements",
    Rule(rule) {
        if (rule.selector === "body") {
            rule.each((node) => {
                if (node.type === "decl" && node.prop.startsWith("margin")) {
                    node.prop = node.prop.replace("margin", "padding");
                }
            });
        }
    },
    Declaration(decl) {
        if (
            decl.prop === "position" &&
            (decl.value === "fixed" || decl.value === "sticky")
        ) {
            decl.parent.append(
                new Declaration({
                    prop: "display",
                    value: "none",
                    important: true,
                })
            );
        }
    },
};

const styleTweaksPlugin: Plugin = {
    postcssPlugin: "style-tweaks",
    Rule(rule) {
        // rewrite body margin (which we overwrite) into padding
        if (rule.selector === "body") {
            rule.each((node) => {
                if (node.type === "decl" && node.prop.startsWith("margin")) {
                    // caveat: this uses either margin or padding if present, does not add them
                    node.prop = node.prop.replace("margin", "padding");
                }
            });
        }
    },
};
