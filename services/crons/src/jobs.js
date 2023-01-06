const { requireConfig } = require('@datawrapper/backend-utils');
const { ExportJob } = require('@datawrapper/orm/db');
const { JobsHelper } = require('@datawrapper/service-utils');
const { Queue, QueueEvents } = require('bullmq');
const config = requireConfig();
const logger = require('./logger');

exports.createJobsHelper = () =>
    new JobsHelper(config, Queue, QueueEvents, ExportJob, e =>
        logger.warn(`An error occured while trying to set up bullmq: ${e}`)
    );
