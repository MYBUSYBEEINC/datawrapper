const { SQ } = require('@datawrapper/orm');
const { Op } = SQ;
const path = require('path');

module.exports = async ({ config, db, event, events }) => {
    const cfg = config.crons.screenshots;

    // prepare statement to compute seconds since last edit
    const nowMinus70Seconds = SQ.fn('DATE_ADD', SQ.fn('NOW'), SQ.literal('INTERVAL -70 SECOND'));

    // retreive charts
    const editedCharts = await db.models.chart.findAll({
        attributes: [
            'id',
            'author_id',
            'organization_id',
            [
                SQ.fn(
                    'MD5',
                    SQ.fn(
                        'CONCAT',
                        SQ.col('id'),
                        '--',
                        SQ.fn('UNIX_TIMESTAMP', SQ.col('created_at'))
                    )
                ),
                'hash'
            ]
        ],
        limit: 200,
        order: [['last_modified_at', 'DESC']],
        where: {
            [Op.and]: [
                // chart not deleted AND
                { deleted: false },
                // not a guest chart
                { guest_session: null },
                // chart edited within last N seconds
                SQ.where(SQ.col('last_modified_at'), Op.gt, nowMinus70Seconds)
            ]
        }
    });

    // create export jobs for the charts
    const newJobs = editedCharts.map(async chart => {
        const imagePath = `${chart.id}/${cfg.path || chart.get('hash')}`;

        await events.emit(event.CHART_EXPORT_PUBLISH, {
            chart,
            exports: [
                {
                    compress: true,
                    disableExif: true,
                    filename: 'plain.png',
                    format: 'png',
                    height: 360,
                    width: 480,
                    plain: true,
                    zoom: 2
                },
                {
                    compress: true,
                    disableExif: true,
                    filename: 'full.png',
                    format: 'png',
                    height: 'auto',
                    width: 540,
                    plain: false,
                    zoom: 2
                }
            ],
            key: 'edit-screenshot',
            priority: 0,
            save: {
                ...(!!cfg.s3 && {
                    s3: {
                        bucket: cfg.s3.bucket,
                        acl: cfg.s3.acl || 'public-read',
                        dirPath: `${cfg.s3.path ? cfg.s3.path + '/' : ''}${imagePath}`
                    }
                }),
                ...(!!cfg.file && {
                    file: {
                        outDir: path.join(cfg.file.path, imagePath)
                    }
                })
            },
            user: {
                id: chart.author_id
            }
        });
    });

    if (newJobs.length) {
        await Promise.all(newJobs);
        // logger.info(`queued ${newJobs.length} new edit-screenshot jobs`);
    }
};
