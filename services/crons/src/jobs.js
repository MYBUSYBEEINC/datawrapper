const { JobsHelper } = require('@datawrapper/service-utils');
const { Queue, QueueEvents } = require('bullmq');

exports.createJobsHelper = ({ config, db, logger }) =>
    new JobsHelper(config, Queue, QueueEvents, db, e =>
        logger.warn(`An error occured while trying to set up bullmq: ${e}`)
    );
