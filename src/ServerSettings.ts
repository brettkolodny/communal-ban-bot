interface ServerOptions {
    whitelisted?: boolean;
    blacklist?: string[];
    whitelist?: string[];
    allowedChannel?: string;
    acceptAllBans?: boolean;
}

export class ServerSettings {
    public serverId: string;
    public whitelisted: boolean = false;
    public blacklist: string[] = [];
    public whitelist: string[] = [];
    public allowedChannel: string | null = null;
    public acceptAllBans: boolean = false;

    constructor(id: string, options?: ServerOptions) {
        this.serverId = id;

        if (options) {
            this.whitelisted = options.whitelisted ? true : false;
            this.blacklist = options.blacklist ? options.blacklist : [];
            this.whitelist = options.whitelist ? options.whitelist : [];
            this.allowedChannel = options.allowedChannel ? options.allowedChannel : null;
            this.acceptAllBans = options.acceptAllBans ? options.acceptAllBans : false;
        }
    }
}