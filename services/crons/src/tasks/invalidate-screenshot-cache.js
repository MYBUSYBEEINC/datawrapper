const { SQ } = require('@datawrapper/orm');
const { Op } = SQ;

module.exports = async ({ config, db, jobsHelper, logger }) => {
    const cfg = config.crons.screenshots || {};
    if (!cfg.cloudflare) return;

    // prepare statement to compute seconds since job completion
    const nowMinus70Seconds = SQ.fn('DATE_ADD', SQ.fn('NOW'), SQ.literal('INTERVAL -70 SECOND'));

    const jobs = await db.models.export_job.findAll({
        where: {
            [Op.and]: [
                // job was edit-screenshot
                { key: 'edit-screenshot' },
                // job was successful
                { status: 'done' },
                // job has been completed within last 70 seconds
                SQ.where(SQ.col('done_at'), Op.gt, nowMinus70Seconds)
            ]
        }
    });

    const urls = jobs.flatMap(job =>
        job.tasks
            .filter(task => task.action === 's3')
            .map(task => `https://${cfg.cloudflare.url_prefix}/${task.params.path}`)
    );

    logger.info(`found ${urls.length} screenshot urls to invalidate on cloudflare`);

    // cloudflare only allows to invalidate 30 urls at a time, so
    // we want to split them up into batches
    const batches = [];
    while (urls.length) {
        batches.push(urls.splice(0, 30));
    }

    if (batches.length) {
        await jobsHelper.scheduleInvalidateCloudflareJobs(
            batches.map(urls => ({ urls })),
            {
                key: 'invalidate-screenshot-cache',
                priority: 0
            }
        );
    }
};
