-- Replaces vis type grid settings with overrides

-- Up
SELECT JSON_SET(
    JSON_ARRAY_APPEND(data, '$.overrides', CAST('[
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
        }
    ]' AS JSON)),
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
) FROM theme WHERE id = 'default';