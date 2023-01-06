const { JobsHelper } = require('@datawrapper/service-utils');
const { Queue, QueueEvents } = require('bullmq');

exports.createJobsHelper = ({ ExportJob, config, logger }) =>
    new JobsHelper(config, Queue, QueueEvents, ExportJob, e =>
        logger.warn(`An error occured while trying to set up bullmq: ${e}`)
    );
