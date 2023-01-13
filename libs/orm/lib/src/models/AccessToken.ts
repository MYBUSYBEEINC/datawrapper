import { createExports, setInitializer } from '../utils/wrap';
const exported = createExports('access_token')<typeof AccessToken>();
export default exported;
export type AccessTokenModel = InstanceType<typeof AccessToken>;

import SQ, {
    CreationOptional,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    Model
} from 'sequelize';
import generate from 'nanoid/generate';
import User from './User';
import type { ChartModel } from './Chart';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

class AccessToken extends Model<
    InferAttributes<AccessToken>,
    InferCreationAttributes<AccessToken>
> {
    declare id: CreationOptional<number>;
    declare type: string;
    declare token: string;
    declare last_used_at: CreationOptional<Date>;
    declare data: Record<string, unknown>;
    declare user_id: ForeignKey<number>;

    static async newToken({
        user_id,
        type,
        data
    }: {
        user_id: number;
        type: string;
        data?: Record<string, unknown>;
    }) {
        return AccessToken.create({
            user_id,
            type,
            data: data || {},
            token: generate(alphabet, 64)
        });
    }

    static async createChartExportToken(chart: ChartModel) {
        if (!chart.author_id) {
            throw new Error('Charts created by guests are not supported');
        }

        return this.newToken({
            user_id: chart.author_id,
            type: 'chart-export',
            data: {
                chartId: chart.id
            }
        });
    }

    static async getExportedChartId(token: string) {
        const model = await this.findOne({
            where: {
                token,
                type: 'chart-export'
            }
        });
        if (!model) {
            return undefined;
        }

        return model.data['chartId'] as string;
    }
}

setInitializer(exported, ({ initOptions }) => {
    AccessToken.init(
        {
            id: {
                type: SQ.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },

            type: SQ.STRING(64),
            token: SQ.STRING(128),
            last_used_at: SQ.DATE,
            data: SQ.JSON
        },
        {
            tableName: 'access_token',
            ...initOptions
        }
    );

    AccessToken.belongsTo(User, { foreignKey: 'user_id' });

    return AccessToken;
});
