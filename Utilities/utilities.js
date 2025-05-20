const fs = require('node:fs');

// Adjust to your own liking
const CONFIG = {
    outputDirectory: 'debug/', // Null to disable file writing, will use console.log instead, might not fit in terminal buffer
    trim: { // Removes area above trimUntill and removes area below trimAfter (first occurance after trimUntil)
        shouldTrim: false,
        trimUntil: "",
        trimAfter: ""
    },
    cut: { // Removes area in the middle, using trimAfter as the starting point and trimUntill as the ending point (first occurance after trimAfter)
        shouldCut: false,
        trimAfter: "",
        trimUntill: ""
    }
};




(async() => {
/** START OF USER CODE **/
    // NOTE: Code in this code block runs when the file is run through node
    




    

/** END OF USER CODE **/
})();











/**
 * Writes the given content to a file with the given title
 * @param {string} title The title of the file to write
 * @param {string} content The content to write to the file
 */
function writeFile(title, content) {
    fs.writeFile(CONFIG.outputDirectory + title, content, err => {
        if (err) {
            console.log('Failed to write to file', err.message);
        } else {
            console.log('Successfully saved file: ', title);
        }
    });
}

/**
 * Reads the file with the given filename and returns its content as a string
 * @param {string} filename The filename to read
 * @returns {Promise<string>} A promise that resolves with the content of the file
 */
function readFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile('debug/' + filename, 'utf8', (err, data) => {
            if (err) {
                console.log('Readfile error: ', err);
                return reject(err);
            }
            return resolve(data);
        });
    });
}

/**
 * Trims around the content, leaving only the area between the start and end string
 * @param {string} text The text to trim
 * @param {string} startString The string to start at (inclusive)
 * @param {string} endString The string to end at (exclusive)
 * @returns The trimmed text
 */
function trimText(text, startString, endString) {
    const startIndex = text.indexOf(startString);
    const endIndex = text.indexOf(endString, startIndex);
    return text.substring(startIndex, endIndex);
}


/**
 * Cuts out the content between start and end string and returns the surrounding text
 * @param {string} text The text to cut from
 * @param {string} startString The string to cut from (inclusive)
 * @param {string} endString The string to cut to (exclusive)
 * @returns The cut text
 */
function cutText(text, startString, endString) {
    const startIndex = text.indexOf(startString);
    const endIndex = text.indexOf(endString, startIndex);

    // Nothing to cut out
    if(startIndex <= 0) return text;

    const startContent = text.substring(0, startIndex);
    const endContent = text.substring(endIndex);

    let tmpContent = startContent + endContent;

    return tmpContent;
}

/**
 * Extracts and deobfuscates an obfuscated script from the given HTML content.
 * @param {string} html - The HTML content containing the obfuscated script.
 * @returns {string|null} The deobfuscated script, or null if no obfuscated script is found.
 */
function deobfuscate(html) {
    const obfuscatedScript = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
    if(!obfuscatedScript) return null;

    const unpackedScript = unpack(obfuscatedScript[1]);
    return unpackedScript;
}

/*
 * DEOBFUSCATOR CODE
 */
class Unbaser {
    constructor(base) {
        this.ALPHABET = {
            62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            95: "' !\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
        };
        this.dictionary = {};
        this.base = base;
        if (36 < base && base < 62) {
            this.ALPHABET[base] = this.ALPHABET[base] ||
                this.ALPHABET[62].substr(0, base);
        }
        if (2 <= base && base <= 36) {
            this.unbase = (value) => parseInt(value, base);
        }
        else {
            try {
                [...this.ALPHABET[base]].forEach((cipher, index) => {
                    this.dictionary[cipher] = index;
                });
            }
            catch (er) {
                throw new Error('Unsupported base encoding.');
            }
            this.unbase = this._dictunbaser;
        }
    }
    _dictunbaser(value) {
        let ret = 0;
        [...value].reverse().forEach((cipher, index) => {
            ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
        });
        return ret;
    }
}

/**
 * Checks if a given source code (JS File) is obfuscated with the p.a.c.k.e.r. algorithm.
 * @param {string} source - The source code (JS File) to check.
 * @returns {boolean} true if the source code is obfuscated with p.a.c.k.e.r., false otherwise.
 */
function detect(source) {
    return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

/**
 * Unpacks a given source code (JS File) that is obfuscated with the p.a.c.k.e.r. algorithm.
 * @param {string} source - The source code (JS File) to unpack.
 * @returns {string} The unpacked source code.
 * @throws {Error} If the source code is not obfuscated with p.a.c.k.e.r. or if the data is corrupted.
 */
function unpack(source) {
    let { payload, symtab, radix, count } = _filterargs(source);
    if (count != symtab.length) {
        throw new Error('Malformed p.a.c.k.e.r. symtab.');
    }
    let unbase;
    try {
        unbase = new Unbaser(radix);
    }
    catch (e) {
        throw new Error('Unknown p.a.c.k.e.r. encoding.');
    }
    function lookup(match) {
        const word = match;
        let word2;
        if (radix == 1) {
            word2 = symtab[parseInt(word)];
        }
        else {
            word2 = symtab[unbase.unbase(word)];
        }
        return word2 || word;
    }
    source = payload.replace(/\b\w+\b/g, lookup);
    return _replacestrings(source);
    function _filterargs(source) {
        const juicers = [
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
        ];
        for (const juicer of juicers) {
            const args = juicer.exec(source);
            if (args) {
                let a = args;
                if (a[2] == "[]") {
                }
                try {
                    return {
                        payload: a[1],
                        symtab: a[4].split("|"),
                        radix: parseInt(a[2]),
                        count: parseInt(a[3]),
                    };
                }
                catch (ValueError) {
                    throw new Error('Corrupted p.a.c.k.e.r. data.');
                }
            }
        }
        throw new Error('Could not make sense of p.a.c.k.e.r data (unexpected code structure)');
    }
    function _replacestrings(source) {
        return source;
    }
}