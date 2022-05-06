import fs from "fs";
import path from "path";

const evilKeys = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./imposter_letters.json"), "utf8")
);

export function replaceEvilLetters(inText: string) {
  const outTextArray = [];

  for (const char of inText) {
    const key = char.codePointAt(0);
    if (key && key in evilKeys) {
      const new_character = evilKeys[key];
      outTextArray.push(new_character);
    } else {
      outTextArray.push(char);
    }
  }
  const outText = String.fromCharCode.apply(null, outTextArray);
  return outText;
}
