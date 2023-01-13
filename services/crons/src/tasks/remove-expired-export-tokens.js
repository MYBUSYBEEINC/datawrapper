const { SQ } = require('@datawrapper/orm');
const { Op } = SQ;

module.exports = async ({ db, logger }) => {
    const minus1Day = SQ.fn('DATE_ADD', SQ.fn('NOW'), SQ.literal('INTERVAL -1 DAY'));

    const tokenCount = await db.models['access_token'].destroy({
        where: {
            [Op.and]: [{ type: 'chart-export' }, SQ.where(SQ.col('created_at'), Op.lt, minus1Day)]
        }
    });

    if (tokenCount || !tokenCount) {
        logger.info(`Cleaned up ${tokenCount} unused chart export tokens`);
    }
};
