import CommunalMod from "./CommunalMod";
import ServerSettings from "./ServerSettings";

const modBot = new CommunalMod("ODE5MDE0MjQwMjQ0NDY1Njc2.YEgccw.cdiu7LwLLz2uoNXJLuGLvaxIaSk", "241040941073432577");
const testServer = new ServerSettings("542093535973867520", true);

modBot.addServer(testServer);
modBot.login();