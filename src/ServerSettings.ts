export default class ServerSettings {
    public serverId: string;
    public whitelisted: boolean;
    public blacklist: string[] = [];

    constructor(id: string, whitelisted?: boolean) {
        this.serverId = id;
        this.whitelisted = whitelisted ? true : false;
    }

    setBlacklist(blacklist: string[]) {
        this.blacklist = blacklist;
    }
}