const SOURCE_URL = "https://anicrush.to";
const SOURCE_API_URL = "https://api.anicrush.to";
const SOURCE_STATIC_URL = "https://static.gniyonna.com/media/poster";

function getImage(path, type = "poster") {
    const pathToReverse = path.split('/')[2];

    let reversedPath = '';
    for (let i = pathToReverse.length - 1; i >= 0; i--) {
        reversedPath += pathToReverse[i];
    }

    const extension = reversedPath.split('.').pop();
    const imageUrl = `${ SOURCE_STATIC_URL }/${type === "poster" ? "300x400" : "900x600"}/100/${ reversedPath }.${ extension }`;

    return imageUrl;
}

function getRandomUserAgent() {
    const userAgents = [{
        "name": "Chrome",
        "version": "120",
        "platform": "Windows",
        "device": "Desktop",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      {
        "name": "Firefox",
        "version": "120",
        "platform": "Windows",
        "device": "Desktop",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/120.0",
      },
      {
        "name": "Safari",
        "version": "17",
        "platform": "MacOS",
        "device": "Desktop",
        "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
      {
        "name": "Edge",
        "version": "120",
        "platform": "Windows",
        "device": "Desktop",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      },
      {
        "name": "Chrome",
        "version": "120",
        "platform": "Android",
        "device": "Mobile",
        "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
      {
        "name": "Safari",
        "version": "17",
        "platform": "iOS",
        "device": "Mobile",
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      }];

      return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getCommonHeaders() {
    return {
        "User-Agent": getRandomUserAgent(),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "DNT": "1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "x-site": "anicrush",
        "X-Requested-With": "XMLHttpRequest"
    }
}


/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    try {
        const page = 1;
        const limit = 24;
        const response = await fetch(`${ SOURCE_API_URL }/shared/v2/movie/list?keyword=${encodeURIComponent(keyword)}&page=${ page }&limit=${ limit }`, {
            method: 'GET',
            headers: getCommonHeaders()
        });
        const data = await response.json();

        if(data?.status == false || data?.result?.movies?.length <= 0) {
            throw('No results found');
        }

        const results = data.result.movies.map(movie => {
            const href = `${ SOURCE_API_URL }/shared/v2/movie/getById/${ movie.id }`

            return { title: movie.name, image: getImage(movie.poster_path), href: href }
        });

        return JSON.stringify(results);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The url to extract the details from
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: getCommonHeaders()
        });
        const data = await response.json();

        if(data?.status == false || data?.result == null) {
            throw('No results found');
        }

        const details = {
            description: data.result?.overview,
            aliases: buildAliasString(data.result),
            airdate: data.result?.aired_from + ' - ' + data.result?.aired_to
        }

        return JSON.stringify([details]);

    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }

    // Encapsulating this away
    function buildAliasString(resultObj) {
        let string = '';

        if (resultObj?.name) {
            string += resultObj.name;
        }

        if (resultObj?.name_english) {
            
            if (string != '') string += ', ';
            string += resultObj.name_english;
        }

        if (resultObj?.name_japanese) {
            if (string != '') string += ', ';
            string += resultObj.name_japanese;
        }

        if (resultObj?.name_synonyms) {
            if (string != '') string += ', ';
            string += resultObj.name_synonyms;
        }

        return string;
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
        var episodes = [];
        const id = url.split('/').at(-1);

        const response = await fetch(`${ SOURCE_API_URL }/shared/v2/episode/list?_movieId=${ id }`, {
            method: 'GET',
            headers: getCommonHeaders()
        });
        const data = await response.json();

        if(data?.status == false || data?.result == null) {
            throw('No results found');
        }

        for(let episodeList in data.result) {
            for(let episode of data.result[episodeList]) {
                episodes.push({
                    href: episode.id,
                    number: episode.number
                });
            }
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error('Fetch error:', error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {

        return streamUrl;

    } catch (error) {
        console.error('Fetch error:', error);
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
                throw Error("Unsupported base encoding.");
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
        throw Error("Malformed p.a.c.k.e.r. symtab.");
    }
    let unbase;
    try {
        unbase = new Unbaser(radix);
    }
    catch (e) {
        throw Error("Unknown p.a.c.k.e.r. encoding.");
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
                    throw Error("Corrupted p.a.c.k.e.r. data.");
                }
            }
        }
        throw Error("Could not make sense of p.a.c.k.e.r data (unexpected code structure)");
    }
    function _replacestrings(source) {
        return source;
    }
}