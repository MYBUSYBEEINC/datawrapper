const { ServiceEventEmitter: CronsEventEmitter } = require('@datawrapper/backend-utils');

const eventList = {
    CHART_EXPORT_PUBLISH: 'CHART_EXPORT_PUBLISH'
};

module.exports = { CronsEventEmitter, eventList };
