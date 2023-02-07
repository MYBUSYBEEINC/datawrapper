-- Removes old plugins from database

-- Up
DELETE FROM product_plugin WHERE plugin_id IN ('analytics-piwik', 'signin', 'signin-github', 'signin-twitter', 'signin-microsoft', 'visualization', 'onetime-access', 'chart-locale-select', 'visualization-raphael-chart');
DELETE FROM plugin_organization WHERE plugin_id IN ('analytics-piwik', 'signin', 'signin-github', 'signin-twitter', 'signin-microsoft', 'visualization', 'onetime-access', 'chart-locale-select', 'visualization-raphael-chart');
DELETE FROM plugin_data WHERE plugin_id IN ('analytics-piwik', 'signin', 'signin-github', 'signin-twitter', 'signin-microsoft', 'visualization', 'onetime-access', 'chart-locale-select', 'visualization-raphael-chart');
DELETE FROM plugin WHERE id IN ('analytics-piwik', 'signin', 'signin-github', 'signin-twitter', 'signin-microsoft', 'visualization', 'onetime-access', 'chart-locale-select', 'visualization-raphael-chart');

-- Down
DROP TABLE `chart_access_token`;
