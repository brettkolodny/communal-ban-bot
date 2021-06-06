export default class ServerSettings {
    public serverId: string;
    public whitelisted: boolean;
    public blacklist: string[];

    constructor(id: string, whitelisted?: boolean, blacklist?: string[]) {
        this.serverId = id;
        this.whitelisted = whitelisted ? true : false;
        this.blacklist = blacklist ? blacklist : [];
    }

    setBlacklist(blacklist: string[]) {
        this.blacklist = blacklist;
    }
}