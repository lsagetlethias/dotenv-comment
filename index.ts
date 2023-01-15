import { readFile } from 'fs/promises';

// rules:
// - the comment can be multiline but an empty line break it
// - the comment can have multiple "#" in it without breaking it
// - a multiline value which have a line starting with "#" shouldn't be considered as comment
// - a comment should only have its first space after each "#" to be trimmed
// - a comment can also start without this first space
// - an inline comment have low priority over an "above" comment and should therefore be ignored
// - a multiline env can have an inline comment only at its last line
// - the "export" keyword should still work to declare an env
// - orphan comment are separated by empty new lines and should be ignored
// - a multiline value can have a line starting with "#" without beeing considered as comment
// - the output should be an array of objects, each object having key, value, and comment properties
// - the first "#" in a comment should be stripped and the following mandatory space should be trimmed
// - multiple "#" in a comment line should have only the first one stripped, the rest is part of the comment
// - multiple lines starting with "#" in a comment should be considered as one multiline comment with each first "#" stripped
// - the output should be formatted as a JSON array of objects with key, value, and comment properties
// - the output should match the given output example.

interface DotEnvComment {
    key: string;
    value: string;
    comment: string;
}

(async () => {
    const input = await readFile("./input.env", "utf-8");
    const output = require("./output.json");

    const lines = input.split("\n");
    const result: DotEnvComment[] = [];

    const az = gpttest(input);

    console.log(az);
})();

function parseEnvFile(fileContent: string) {
    // Split the file into an array of lines
    const lines = fileContent.split('\n');

    // Initialize variables to keep track of the current comment and value
    let currentComment = '';
    let currentValue = '';
    let currentKey = '';

    let isMultilineValue = false;
    let isMultilineComment = false;
    let isExport = false;

    // Initialize an array to store the final output
    const output: DotEnvComment[] = [];

    // Iterate through each line in the file
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let nextLine = lines[i + 1];
        let previousLine = lines[i - 1];

        if (line.startsWith("#") && !isMultilineValue) {
            currentComment += extractLineComment(line);
        }

        if (!nextLine && currentComment) {
            if (currentKey) {
                output.push({
                    key: currentKey,
                    value: currentValue,
                    comment: currentComment,
                })
            }
            currentComment = "";
        }

        if (!currentComment && !isMultilineValue && line.includes("=")) {
            const [possibleKey, ...possibleValueArray] = line.split("=");
            currentKey = possibleKey.toUpperCase();
            currentValue = possibleValueArray.join("=").trim();

            if (currentKey.startsWith("EXPORT ")) {
                currentKey = currentKey.substring(6).trim();
                isExport = true;
            }

            if (currentValue.startsWith('"')) {
                isMultilineValue = true;
                currentValue = currentValue.substring(1);

                if (currentValue.includes('"')) {
                    const [endValue, ...possibleInlineComment] = currentValue.split('"');
                    currentValue = endValue;

                    let joinedPossibleInlineComment = possibleInlineComment.join('"').trim();
                    if (joinedPossibleInlineComment.startsWith("#") && !currentComment) {
                        currentComment = extractLineComment(joinedPossibleInlineComment);
                    }
                }
            } else {
                const [trimmedValue, inlineComment] = currentValue.split("#");
                currentValue = trimmedValue.trim();
                currentComment = extractLineComment(`#${inlineComment}`);
            }
        }

        if (isMultilineValue && line.includes('"')) {
            // end of a multiline value
            const [lastValuePart, ...possibleInlineComment] = line.split('"')
            currentValue += lastValuePart;
            isMultilineValue = false;

            let joinedPossibleInlineComment = possibleInlineComment.join('"').trim();
            if (joinedPossibleInlineComment.startsWith("#") && !currentComment) {
                currentComment = extractLineComment(joinedPossibleInlineComment);
            }
        }
    }
    return output;
}

const REGEX_LINE_COMMENT = /^# ?(.*)$/i;
function extractLineComment(comment: string) {
    return new RegExp(REGEX_LINE_COMMENT).exec(comment)?.[1] ?? "";
}

function gpttest(input: string) {
    const lines = input.split("\n");
    const envs = [];
    let comment = "";

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // if the line starts with "#" it is a comment
        if (line.startsWith("#")) {
            // if a line ends with " #" it is an inline comment
            if (line.endsWith(" #")) {
                line = line.slice(0, line.lastIndexOf(" #"));
            }

            // strip the first "#" and trim the following space
            line = line.replace(/^#\s?/, "");

            // if the comment variable is not empty and the line is not empty
            // it means that the comment is multiline
            if (comment !== "" && line !== "") {
                comment += "\n";
            }

            comment += line;

            // if the next line is not a comment or the end of the input
            // it means that the comment is finished and should be added
            // to the previous env variable
            if (i + 1 < lines.length && !lines[i + 1].startsWith("#") && envs[envs.length - 1]) {
                envs[envs.length - 1].comment = comment.trim();
                comment = "";
            }

            continue;
        }

        // if the line starts with "export" it is a variable declaration
        if (line.startsWith("export")) {
            line = line.replace("export", "").trim();
        }

        // if the line is empty, it means that there is an orphan comment
        if (line.trim() === "") {
            continue;
        }

        // split the line into key and value
        const [key, value] = line.split("=");

        envs.push({
            key: key.trim(),
            value: value.trim(),
            comment: ""
        });
    }

    return envs;
}