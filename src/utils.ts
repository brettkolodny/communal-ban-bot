import fs from "fs";

const evilKeys = JSON.parse(fs.readFileSync("./imposter_letters.json", "utf8"));

export function replaceEvilLetters(inText: string) {
  inText = inText.toLowerCase();
  //build array to populate
  const outTextArray = [];

  for (let i = 0; i < inText.length; i++) {
    //get letter at current index
    const currCharCode = inText.charCodeAt(i);

    //replace it if it's an evil char. keep if not
    const key = String(currCharCode);
    if (key in evilKeys) {
      const newCharacter = evilKeys[key];
      outTextArray.push(newCharacter);
    } else {
      outTextArray.push(currCharCode);
    }
  }
  const outText = String.fromCharCode.apply(null, outTextArray);
  return outText;
}
