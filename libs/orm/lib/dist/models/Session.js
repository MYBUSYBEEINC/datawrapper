"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const wrap_1 = require("../utils/wrap");
const exported = (0, wrap_1.createExports)('session')();
exports.default = exported;
const sequelize_1 = __importStar(require("sequelize"));
const unserializeSession_1 = __importDefault(require("../utils/unserializeSession"));
class Session extends sequelize_1.Model {
}
(0, wrap_1.setInitializer)(exported, ({ initOptions }) => {
    Session.init({
        id: {
            type: sequelize_1.default.STRING(32),
            primaryKey: true,
            autoIncrement: false,
            field: 'session_id'
        },
        user_id: {
            type: sequelize_1.default.INTEGER,
            allowNull: true
        },
        persistent: sequelize_1.default.BOOLEAN,
        data: {
            type: sequelize_1.default.TEXT,
            allowNull: false,
            field: 'session_data',
            get() {
                const d = this.getDataValue('data');
                if (d) {
                    // TODO: for now we still want to take session data that was serialized
                    //  using PHP into account. As soon as no more PHP-serialized session data
                    //  exists, we can replace this call with `JSON.parse(d as any)` and delete
                    //  the function `unserializeSession`.
                    // Sequelize v6 types do not support model field and DB field having different types https://github.com/sequelize/sequelize/issues/13522
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (0, unserializeSession_1.default)(d);
                }
                return {};
            },
            set(data) {
                // WARNING, this will destroy parts of our sessions
                // Sequelize v6 types do not support model field and DB field having different types https://github.com/sequelize/sequelize/issues/13522
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.setDataValue('data', JSON.stringify(data));
            }
        }
    }, {
        createdAt: 'date_created',
        updatedAt: 'last_updated',
        tableName: 'session',
        ...initOptions
    });
    return Session;
});
