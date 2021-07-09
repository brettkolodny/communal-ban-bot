export class ServerSettings {
    public serverId: string;
    public whitelisted: boolean;
    public blacklist: string[];
    public whitelist: string[];

    constructor(id: string, whitelisted?: boolean, blacklist?: string[], whitelist?: string[]) {
        this.serverId = id;
        this.whitelisted = whitelisted ? true : false;
        this.blacklist = blacklist ? blacklist : [];
        this.whitelist = whitelist ? whitelist : [];
    }

    setBlacklist(blacklist: string[]) {
        this.blacklist = blacklist;
    }

    setWhitelist(whitelist: string[]) {
        this.whitelist = whitelist;
    }
}