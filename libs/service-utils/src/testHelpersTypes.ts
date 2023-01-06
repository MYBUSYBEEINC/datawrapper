import type { Config } from '@datawrapper/backend-utils';
import type { ChartModel, DB, SessionModel, TeamModel, UserModel } from '@datawrapper/orm';
import type { Server } from './serverTypes';

type HelperWrapper<THelperParams extends unknown[], TFuncParams extends unknown[]> = {
    <T>(...params: [...THelperParams, (...funcParams: TFuncParams) => Promise<T>]): Promise<T>;
};

type SetupOptions = {
    usePlugins?: boolean;
    useOpenAPI?: boolean;
    testsConfigPatcher?: (config: Config) => Config;
    db?: DB;
};

type CreateChartProps = {
    author_id: number;
    organization_id?: string;
};

type CreateTeamProps = {
    settings?: Partial<TeamModel['settings']>;
};

type CreateUserProps = {
    role?: 'admin';
};

type UserObj = {
    session: SessionModel;
    user: UserModel;
    token: string;
};

// TODO: Remove this once test helpers are migrated to TS
export type TestHelpers = {
    setup<TServer extends Server = Server>(
        options?: SetupOptions
    ): Promise<TServer & ServerHelpers>;
    addUserToTeam(user: UserModel, team: TeamModel): Promise<void>;
    createChart(props: CreateChartProps): Promise<ChartModel>;
    createTeam(props: CreateTeamProps): Promise<TeamModel>;
    createUser(server: Server, props?: CreateUserProps): Promise<UserObj>;
    destroy(...objects: unknown[]): Promise<void>;
    withChart: HelperWrapper<[CreateChartProps], [ChartModel]>;
    withUser: HelperWrapper<[Server, CreateUserProps], [UserObj]>;
};

type ServerHelpers = {
    injectWithSession(
        options: Parameters<Server['inject']>[0] & { session: SessionModel }
    ): ReturnType<Server['inject']>;
};

export type TestServer = Server & ServerHelpers;
