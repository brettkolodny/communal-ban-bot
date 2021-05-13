type ServerSettings = {
  blackList: string[];
  banOnLeave: boolean;
}

export const whitelist: Map<string, ServerSettings> = new Map();

// Polkadot
whitelist.set("722223075629727774", {
  blackList: ["team", "discord", "help", "support", "desk", "tech", "giveaway", "admin", "minaprotocol", "dev", "community", "mod", "assist", "wallet", "sync", "troubleshoot","assistance",],
  banOnLeave: true
});

// Kusama
whitelist.set("771178421522268191", {
  blackList: ["team", "discord", "help", "support", "desk", "tech", "giveaway", "admin", "minaprotocol", "dev", "community", "mod", "assist", "wallet", "sync", "troubleshoot","assistance",],
  banOnLeave: true
});

// Acala
whitelist.set("709208197549785148", {
  blackList: [],
  banOnLeave: false 
});
