import type { Config } from '@datawrapper/backend-utils';
import type { ChartModel, DB, SessionModel, TeamModel, UserModel } from '@datawrapper/orm';
import type { Server } from './serverTypes';
declare type HelperWrapper<THelperParams extends unknown[], TFuncParams extends unknown[]> = {
    <T>(...params: [...THelperParams, (...funcParams: TFuncParams) => Promise<T>]): Promise<T>;
};
declare type SetupOptions = {
    usePlugins?: boolean;
    useOpenAPI?: boolean;
    testsConfigPatcher?: (config: Config) => Config;
    db?: DB;
};
declare type CreateChartProps = {
    author_id: number;
    organization_id?: string;
};
declare type CreateTeamProps = {
    settings?: Partial<TeamModel['settings']>;
};
declare type CreateUserProps = {
    role?: 'admin';
};
declare type UserObj = {
    session: SessionModel;
    user: UserModel;
    token: string;
};
export declare type TestHelpers = {
    setup<TServer extends Server = Server>(options?: SetupOptions): Promise<TServer & ServerHelpers>;
    addUserToTeam(user: UserModel, team: TeamModel): Promise<void>;
    createChart(props: CreateChartProps): Promise<ChartModel>;
    createTeam(props: CreateTeamProps): Promise<TeamModel>;
    createUser(server: Server, props?: CreateUserProps): Promise<UserObj>;
    destroy(...objects: unknown[]): Promise<void>;
    withChart: HelperWrapper<[CreateChartProps], [ChartModel]>;
    withUser: HelperWrapper<[Server, CreateUserProps], [UserObj]>;
};
declare type ServerHelpers = {
    injectWithSession(options: Parameters<Server['inject']>[0] & {
        session: SessionModel;
    }): ReturnType<Server['inject']>;
};
export declare type TestServer = Server & ServerHelpers;
export {};
