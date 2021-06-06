"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CommunalMod_1 = __importDefault(require("./CommunalMod"));
const ServerSettings_1 = __importDefault(require("./ServerSettings"));
const modBot = new CommunalMod_1.default("ODE5MDE0MjQwMjQ0NDY1Njc2.YEgccw.cdiu7LwLLz2uoNXJLuGLvaxIaSk", "241040941073432577");
const testServer = new ServerSettings_1.default("542093535973867520", true);
modBot.addServer(testServer);
modBot.login();
