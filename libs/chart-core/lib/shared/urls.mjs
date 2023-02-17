const EMBED_PATH_REGEX = /([a-zA-Z0-9]{5})(?:\/\d+)?\/?$/;

/**
 * Extract a chart ID from an embed URL
 * @param {string} url
 * @return {string|null}
 */
export function getChartIdFromUrl(url) {
    const isAbsolute =
        url.startsWith('https://') || url.startsWith('http://') || url.startsWith('//');
    const match = isAbsolute
        ? new URL(url).pathname.match(EMBED_PATH_REGEX)
        : url.match(EMBED_PATH_REGEX);
    if (match) {
        return match[1];
    }
    return null;
}

/**
 * Construct a the embed.json url from a script src
 * @param {string} scriptSrc
 * @param {string} chartId
 * @returns {string}
 */
export function getEmbedJsonUrl(scriptSrc, chartId) {
    const scriptUrl = new URL(scriptSrc);
    const pathParts = scriptUrl.pathname.split('/').filter(d => d);
    const hasVersionInPath = /\d+/.test(pathParts[pathParts.length - 3]);
    let pathPrefix = pathParts.slice(0, pathParts.length - (hasVersionInPath ? 3 : 2)).join('/');
    if (pathPrefix.length > 0) pathPrefix = `${pathPrefix}/`;
    return {
        pathPrefix,
        url: `${scriptUrl.protocol}//${scriptUrl.host}/${pathPrefix}${chartId}/embed.json`
    };
}
