-- Replaces vis type grid settings with overrides

-- Up
UPDATE theme SET data = JSON_SET(
	JSON_SET(
        data, '$.overrides', CAST('[
            {
                "type": "darkMode",
                "settings": {
                    "colors.gradients":[
                        ["#254b8c","#0a6aad","#2989bd","#4ba8c9","#75c8c5","#b6e3bb","#f0f9e8"],
                        ["#2c1160","#6b1f7b","#ac337b","#e45563","#fb8d67","#fcfcbe","#fdc78d"],
                        ["#0d0787","#6703a5","#ac2790","#d8586a","#f38a47","#fbbf2b","#f0f723"],
                        ["#007001","#f6f4a6"],
                        ["#42342d","#683c39","#8f3e55","#c73a78","#ff6bca","#ffcbff"],
                        ["#253494","#2c7fb8","#41b6c4","#7fcdbb","#c7e9b4","#ffffcc"]
                    ],
                        "colors.background":"#252525",
                        "vis.d3-maps-core.places.general.label.color.normal":"#000000",
                        "vis.d3-maps-core.places.general.symbol.fill.normal":"#000000",
                        "vis.d3-maps-core.places.general.label.color.inverted":"#e5e5e5",
                        "vis.d3-maps-core.places.general.symbol.fill.inverted":"#e5e5e5",
                        "vis.d3-maps-core.places.general.symbol.stroke.normal":"#bfbfbf",
                        "vis.d3-maps-core.places.general.label.buffer.color.normal":"#bfbfbf"
                    }
                },
                {
                    "condition": ["in", ["get", "type" ], ["column-chart", "grouped-column-chart", "stacked-column-chart"]],
                    "settings": {
                        "style.chart.grid.vertical.tickLabels.hideZero": true
                    }
                },
                {
                    "condition": ["==", ["get", "type"], "d3-scatter-plot"],
                    "settings": {
                        "style.chart.grid.horizontal.tickLabels.units": "last"
                    }
                },
                {
                    "condition": ["in", ["get", "type" ], ["d3-bars", "d3-arrow-plot", "d3-bars-bullet", "d3-bars-grouped", "d3-bars-stacked ", "d3-dot-plot", "d3-range-plot"]],
                    "settings": {
                        "style.chart.grid.horizontal.tickLabels.units": "all"
                    }
                },
                {   
                    "condition": ["==", ["get", "type"], "d3-bars-stacked"],
                    "settings": {
                        "style.chart.grid.horizontal.gridLines.aboveChart": true
                    }
                },
                {
                    "condition": ["in", ["get", "type"], ["d3-dot-plot", "d3-range-plot", "d3-arrow-plot"]],
                    "settings": {
                        "style.chart.grid.horizontal.baseLine.aboveChart": false,
                        "style.chart.grid.horizontal.baseLine.blendBaseColorWithBg": 0.6
                    }
                },
                {
                    "type": "darkMode",
                    "condition": ["in", ["get", "type"], ["d3-dot-plot", "d3-range-plot", "d3-arrow-plot"]],
                    "settings": {
                        "style.chart.grid.horizontal.baseLine.blendBaseColorWithBg": 0.85
                    }
                },
                {
                    "condition": ["in", [ "get", "type"], ["d3-range-plot", "d3-arrow-plot"]],
                    "settings": {
                        "style.chart.grid.vertical.gridLines.major.strokeDasharray": "dotted"
                    }
                }]' AS JSON)
    ),
    '$.vis',
    JSON_EXTRACT(
        JSON_REMOVE(
            data,
            '$.vis."d3-bars"',
            '$.vis."d3-bars-stacked"',
            '$.vis."d3-dot-plot"',
            '$.vis."d3-range-plot"',
            '$.vis."d3-arrow-plot"',
            '$.vis."d3-scatter-plot"',
            '$.vis."column-chart"'
        ),
        '$.vis'
    )
) WHERE id = 'default';