// TEMPLATE TODO - Fill in the following variables
const BASE_URL = '';
const SEARCH_URL = '';

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    alert("Warning: This is a template for creating a module, it does NOT function by itself, remove this line when utilizing it. If you see this while using a module, please let the author know.");
    try {
        // TEMPLATE TODO
        // Either find the page url for the search page, fetch it, match it with regex and return the results
        // Or if you're lucky and the site has a search API return JSON use that instead

        const response = await fetch(`${ SEARCH_URL }${ encodeURIComponent(keyword) }`);
        const html = typeof response === 'object' ? await response.text() : await response; // Website response (Pick only one, both will give an error)
        // const data = typeof response === 'object' ? await response.json() : await JSON.parse(response); // API response (Pick only one, both will give an error)


        return JSON.stringify(results);
    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The url to extract the details from
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    try {
        // TEMPLATE TODO
        // Fetch the provided url, match it with regex and return the details
        // Or if you're lucky and the site has an API return JSON use that instead

        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response; // Website response (Pick only one, both will give an error)
        // const data = typeof response === 'object' ? await response.json() : await JSON.parse(response); // API response (Pick only one, both will give an error)


        return JSON.stringify([details]);

    } catch (error) {
        console.log('Details error: ' + error.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The url to extract the episodes from.
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    try {
        // TEMPLATE TODO
        // Fetch the provided url, match it with regex and return the episodes
        // Or if you're lucky and the site has an API return JSON use that instead

        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response; // Website response (Pick only one, both will give an error)
        // const data = typeof response === 'object' ? await response.json() : await JSON.parse(response); // API response (Pick only one, both will give an error)


        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    try {
        // TEMPLATE TODO
        // Fetch the provided url, match it with regex and return the stream URL
        // Or get the iframe through regex, fetch the iframe, match it with regex and return the stream URL
        // Or if you're lucky and the site has an API return JSON use that instead

        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response; // Website response (Pick only one, both will give an error)
        // const data = typeof response === 'object' ? await response.json() : await JSON.parse(response); // API response (Pick only one, both will give an error)


        return streamUrl;

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return null;
    }
}

/**
 * NOTE: Used to trim giant html strings if regex is too slow
 * 
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
 * NOTE: Used to remove data that would otherwise get captured by your regex
 * 
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
 * NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
 * 
 * Extracts and deobfuscates an obfuscated script from the given HTML content.
 * @param {string} html - The HTML content containing the obfuscated script.
 * @returns {string|null} The deobfuscated script, or null if no obfuscated script is found.
 */
function deobfuscate(html) {
    const obfuscatedScript = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
    const unpackedScript = unpack(obfuscatedScript[1]);
    return unpackedScript;
}

/*
 * NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
 *
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
 * NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
 * 
 * Checks if a given source code (JS File) is obfuscated with the p.a.c.k.e.r. algorithm.
 * @param {string} source - The source code (JS File) to check.
 * @returns {boolean} true if the source code is obfuscated with p.a.c.k.e.r., false otherwise.
 */
function detect(source) {
    return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

/**
 * NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
 * 
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

// Uses Sora's fetchv2 on ipad, fallbacks to regular fetch on Windows
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            return null;
        }
    }
}