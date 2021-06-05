"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ServerSettings {
    constructor(id, whitelisted) {
        this.blacklist = [];
        this.serverId = id;
        this.whitelisted = whitelisted ? true : false;
    }
    setBlacklist(blacklist) {
        this.blacklist = blacklist;
    }
}
exports.default = ServerSettings;
