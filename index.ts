import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { isDeepStrictEqual } from "util";

// rules:
// - a multiline value which have a line starting with "#" shouldn't be considered as comment
// - a comment can be multiline but an empty line break it
// - an inline comment have low priority over an "above" comment and should therefore be ignored
// - the "export" keyword should still work to declare an env
// - a multiline env can have an inline comment only at its last line
// - a multiline value can have a line starting with "#" without beeing considered as comment
// - the comment can have multiple "#" in it without breaking it
// - a comment should only have its first space after each "#" to be trimmed
// - a comment can also start without this first space
// - orphan comment are separated by empty new lines and should be ignored
// - the first "#" in a comment should be stripped and the following mandatory space should be trimmed
// - multiple "#" in a comment line should have only the first one stripped, the rest is part of the comment
// - multiple lines starting with "#" in a comment should be considered as one multiline comment with each first "#" stripped
// - the output should be an array of objects, each object having key, value, and comment properties
// - the output should be formatted as a JSON array of objects with key, value, and comment properties
// - the output should match the given output example.

interface DotEnvComment {
  comment: string;
  key: string;
  value: string;
}

const DEBUG = false;

const RAND_NEW_LINE = randomBytes(5).toString("utf-8");

void (async () => {
  const input = await readFile("./input.env", "utf-8");
  const output = JSON.parse(await readFile("./output.json", "utf-8")) as DotEnvComment[];

  const az = parseEnvFile(input);

  console.log(isDeepStrictEqual(output, az));
})();

function parseEnvFile(fileContent: string) {
  // Split the file into an array of lines
  const lines = fileContent.split("\n");

  // Initialize variables to keep track of the current comment and value
  let currentComment = "";
  let currentValue = "";
  let currentKey = "";

  let isMultilineValue = false;

  // Initialize an array to store the final output
  const output: DotEnvComment[] = [];

  function saveEntry() {
    if (currentValue.startsWith(RAND_NEW_LINE)) {
      currentValue = currentValue.replace(RAND_NEW_LINE, "");
    }
    if (currentComment.startsWith(RAND_NEW_LINE)) {
      currentComment = currentComment.replace(RAND_NEW_LINE, "");
    }
    output.push({
      key: currentKey,
      value: currentValue.replaceAll(RAND_NEW_LINE, "\n"),
      comment: currentComment.replaceAll(RAND_NEW_LINE, "\n"),
    });
    currentKey = "";
    currentValue = "";
    currentComment = "";
    isMultilineValue = false;
  }

  function handleMultineValueEnd(line?: string) {
    const [endValue, ...possibleInlineComment] = (line ?? currentValue).split('"');
    if (line) {
      currentValue += RAND_NEW_LINE + endValue;
    } else {
      currentValue = endValue;
    }

    const joinedPossibleInlineComment = possibleInlineComment.join('"').trim();
    if (joinedPossibleInlineComment.startsWith("#") && !currentComment) {
      currentComment = extractLineComment(joinedPossibleInlineComment);
    }

    saveEntry();
  }

  // Iterate through each line in the file
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    if (!isMultilineValue) {
      // compute only line not part of a multine value
      if (line.startsWith("#")) {
        if (nextLine) {
          currentComment += RAND_NEW_LINE + extractLineComment(line);
        } else {
          currentComment = "";
        }
        DEBUG && console.log({ line, currentKey, currentValue, currentComment, isMultilineValue });
        continue;
      }

      if (line.includes("=")) {
        const [possibleKey, ...possibleValueArray] = line.split("=");
        currentKey = possibleKey.toUpperCase();
        currentValue = possibleValueArray.join("=").trim();

        if (currentKey.startsWith("EXPORT ")) {
          currentKey = currentKey.substring(6).trim();
        }

        if (currentValue.startsWith('"')) {
          isMultilineValue = true;
          currentValue = currentValue.substring(1);

          if (currentValue.includes('"')) {
            DEBUG && console.log({ line, currentKey, currentValue, currentComment, isMultilineValue, end: "1" });
            handleMultineValueEnd();
            continue;
          }
        } else {
          // not a multiline value
          const [trimmedValue, inlineComment] = currentValue.split("#");
          currentValue = trimmedValue.trim();
          if (inlineComment && !currentComment) {
            currentComment = extractLineComment(`#${inlineComment}`);
          }

          DEBUG && console.log({ line, currentKey, currentValue, currentComment, isMultilineValue, end: "2" });
          saveEntry();
          continue;
        }
      }
    } else {
      if (line.includes('"')) {
        DEBUG && console.log({ line, currentKey, currentValue, currentComment, isMultilineValue, end: "3" });
        handleMultineValueEnd(line);
        continue;
      } else {
        currentValue += line;
      }
    }

    DEBUG && console.log({ line, currentKey, currentValue, currentComment, isMultilineValue });
  }
  return output;
}

const REGEX_LINE_COMMENT = /^# ?(.*)$/i;
function extractLineComment(comment: string) {
  return new RegExp(REGEX_LINE_COMMENT).exec(comment)?.[1] ?? "";
}

function gpttest(input: string) {
  let currentComment = "";
  let currentValue = "";
  input.split("\n").reduce<DotEnvComment[]>((envs, line, index, arr) => {
    const isComment = line.startsWith("#");
    const isExport = line.startsWith("export");
    const isOrphanComment = isComment && (arr[index - 1] === "" || arr[index - 1] === undefined);
    const isInlineComment = line.includes("#") && !isComment && !isExport;

    if (!isComment && !isExport) {
      const [key, value] = line.split("=").map(x => x.trim());
      envs.push({ key, value, comment: currentComment });
      currentComment = "";
      currentValue = "";
    } else if (isExport) {
      const [key, value] = line.split("=").map(x => x.trim());
      envs.push({ key: key, value: value, comment: currentComment });
      currentComment = "";
      currentValue = "";
    } else if (!isOrphanComment) {
      if (isInlineComment) {
        currentComment += line.replace(/^#\s?/, "") + "\n";
      } else {
        currentComment += line.slice(1) + "\n";
      }
    }
    return envs;
  }, []);
}
