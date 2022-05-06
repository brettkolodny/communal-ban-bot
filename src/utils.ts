import evilKeys from "./imposter_letters";

export function replaceEvilLetters(inText: string) {
  const outTextArray = [];

  for (const char of inText) {
    const key = char.codePointAt(0);
    if (key && key in evilKeys) {
      const new_character = (evilKeys as any)[key];
      outTextArray.push(new_character);
    } else {
      outTextArray.push(char);
    }
  }
  const outText = String.fromCharCode.apply(null, outTextArray);
  return outText;
}
