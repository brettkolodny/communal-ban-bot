type ServerSettings = {
  blackList?: string[];
  banOnLeave: boolean;
}

export const whitelist: Map<string, ServerSettings> = new Map();

// Polkadot
whitelist.set("722223075629727774", {
  blackList: ["help", "support", "desk", "tech", "giveaway", "admin", "minaprotocol", "dev", "community", "mod", "assist"],
  banOnLeave: true
});

// Kusama
whitelist.set("771178421522268191", {
  blackList: ["help", "support", "desk", "tech", "giveaway", "admin", "minaprotocol", "dev", "community", "mod", "assist"],
  banOnLeave: true
});

// Acala
whitelist.set("709208197549785148", { banOnLeave: false });
