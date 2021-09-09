interface ServerOptions {
    whitelisted?: boolean;
    blacklist?: string[];
    whitelist?: string[];
    allowedChannel?: string;
}

export class ServerSettings {
    public serverId: string;
    public whitelisted: boolean;
    public blacklist: string[];
    public whitelist: string[];
    public allowedChannel: string | null;

    constructor(id: string, options?: ServerOptions) {
        this.serverId = id;

        if (options) {
            this.whitelisted = options.whitelisted ? true : false;
            this.blacklist = options.blacklist ? options.blacklist : [];
            this.whitelist = options.whitelist ? options.whitelist : [];
            this.allowedChannel = options.allowedChannel ? options.allowedChannel : null;
        } else {
            this.whitelisted = false;
            this.blacklist = [];
            this.whitelist = [];
            this.allowedChannel = null;
        }
    }
}