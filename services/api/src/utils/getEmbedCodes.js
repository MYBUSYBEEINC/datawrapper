const { translate } = require('@datawrapper/service-utils');
const get = require('lodash/get');
const sanitizeHtml = require('sanitize-html');
const fs = require('fs-extra');
const path = require('path');
const chartCore = require('@datawrapper/chart-core');
const { UserData } = require('@datawrapper/orm/db');

let embedJS;

module.exports = async function getEmbedCodes({
    visualizations,
    chart,
    user,
    publicUrl,
    publicVersion
}) {
    const __ = key => translate(key, { scope: 'core', language: user.language });

    if (!embedJS) {
        embedJS = await fs.readFile(path.join(chartCore.path.dist, 'embed.js'), 'utf-8');
    }

    let ariaLabel = translate('visualization', { scope: 'core', language: chart.language });

    if (visualizations.has(chart.type)) {
        const vis = visualizations.get(chart.type);

        ariaLabel = vis.ariaLabel
            ? // preferably, use the defined aria-label eg "Interactive line chart"
              translate(vis.ariaLabel, { scope: vis.__plugin, language: chart.language })
            : vis.title
            ? // otherwise fall back to the visualization title
              translate(vis.title, { scope: vis.__plugin, language: chart.language })
            : // as last resort just use chart|map|table
              translate(vis.namespace || 'chart', {
                  scope: 'core',
                  language: chart.language
              });
    }

    const team = await chart.getTeam();
    const preferred = user.id
        ? team && get(team, 'settings.embed.preferred_embed')
            ? get(team, 'settings.embed.preferred_embed')
            : await UserData.getUserData(user.id, 'embed_type', 'responsive')
        : 'responsive';

    const templates = [
        // responsive iframe
        {
            id: 'responsive',
            preferred: preferred === 'responsive',
            title: __('publish / embed / responsive'),
            ...getTemplate(
                `<iframe title="%chart_title%" aria-label="%chart_type%" id="datawrapper-chart-%chart_id%" src="%chart_url%" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="%chart_height%" data-external="1"></iframe><script type="text/javascript">%embed_js%</script>`
            )
        },
        // standard iframe
        {
            id: 'iframe',
            preferred: preferred === 'iframe',
            title: __('publish / embed / iframe'),
            ...getTemplate(
                `<iframe title="%chart_title%" aria-label="%chart_type%" id="datawrapper-chart-%chart_id%" src="%chart_url%" scrolling="no" frameborder="0" style="border: none;" width="%chart_width%" height="%chart_height%" data-external="1"></iframe>`
            )
        }
    ];

    if (team && preferred === 'custom') {
        const customEmbed = get(team, 'settings.embed.custom_embed');
        templates.push({
            id: 'custom',
            preferred: true,
            title: customEmbed.title,
            text: customEmbed.text || '',
            ...getTemplate(customEmbed.template)
        });
    }
    return templates;

    function clean(s) {
        return sanitizeHtml(s, { allowedTags: [] })
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getTemplate(template) {
        const chartUrl = publicUrl || chart.public_url;
        const urlRegex = new RegExp(`(.*/${chart.id}/)\\d+/?`);
        const chartUrlUnversioned = urlRegex.test(chartUrl)
            ? chartUrl.match(urlRegex)[1]
            : chartUrl;
        return {
            template,
            code: template
                .replace(/%chart_id%/g, chart.id)
                .replace(/%chart_public_version%/g, publicVersion || chart.public_version)
                .replace(/%chart_url%/g, chartUrl)
                .replace(/%chart_url_without_version%/g, chartUrlUnversioned)
                .replace(
                    /%chart_url_without_protocol%/g,
                    chart.public_url ? (publicUrl || chart.public_url).replace('https:', '') : ''
                )
                .replace(/%chart_type%/g, ariaLabel)
                .replace(/%chart_title%/g, clean(chart.title))
                .replace(/%chart_intro%/g, clean(get(chart, 'metadata.describe.intro')))
                .replace(/%embed_js%/g, embedJS)
                .replace(/%chart_width%/g, clean(get(chart, 'metadata.publish.embed-width')))
                .replace(/%chart_height%/g, clean(get(chart, 'metadata.publish.embed-height')))
                .replace(/%custom_(.*?)%/g, (match, key) => {
                    return clean(get(chart, `metadata.custom.${key}`, ''));
                })
                .replace(
                    /%aria_description%/,
                    clean(get(chart, 'metadata.describe.aria-description', ''))
                )
        };
    }
};
