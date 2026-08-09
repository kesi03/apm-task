"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profiles = void 0;
exports.getProfile = getProfile;
const azure_devops_1 = __importDefault(require("./azure-devops"));
const docker_1 = __importDefault(require("./docker"));
const github_action_1 = __importDefault(require("./github-action"));
const jenkins_1 = __importDefault(require("./jenkins"));
const k8s_1 = __importDefault(require("./k8s"));
const task_1 = __importDefault(require("./task"));
const team_city_1 = __importDefault(require("./team-city"));
exports.profiles = {
    [github_action_1.default.name]: github_action_1.default,
    [azure_devops_1.default.name]: azure_devops_1.default,
    [team_city_1.default.name]: team_city_1.default,
    [jenkins_1.default.name]: jenkins_1.default,
    [docker_1.default.name]: docker_1.default,
    [k8s_1.default.name]: k8s_1.default,
    [task_1.default.name]: task_1.default,
};
function getProfile(platform) {
    if (platform && exports.profiles[platform]) {
        return exports.profiles[platform];
    }
    return task_1.default;
}
//# sourceMappingURL=index.js.map