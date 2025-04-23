const baseUrl = "https://hikaritv.gg/";
const searchUrl = "https://api.hikari.gg/api/anime/?sort=created_at&order=asc&page=1&search=";
const detailsUrl = "https://api.hikari.gg/api/anime/uid/";
const episodesUrl = "https://api.hikari.gg/api/episode/uid/";
// const watchUrl = "https://hikari.gg/watch/";
const embedUrl = "https://api.hikari.gg/api/embed/";

// // //***** LOCAL TESTING
const results = await searchResults('Solo leveling');
console.log('RESULTS:', results);
const details = await extractDetails(JSON.parse(results)[0].href);
console.log('DETAILS:', details);
const eps = await extractEpisodes(JSON.parse(results)[0].href);
console.log('EPISODES:', eps);
const streamUrl = await extractStreamUrl(JSON.parse(eps)[0].href);
console.log('STREAMURL:', streamUrl);
//***** LOCAL TESTING

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await soraFetch(searchUrl + encodedKeyword);
        const json = await response.json();

        const jsonResults = json.results || [];

        // uid = Hikari internal slug
        if(jsonResults.length <= 0) throw("No results found");
        const results = jsonResults.map(result => {
            return {
                title: result.ani_name,
                image: result.ani_poster,
                href: result.uid + '/',
            };
        });

        return JSON.stringify(results);
    } catch (error) {
        console.log('soraFetch error:', error);
        return JSON.stringify([]);
    }
}

async function extractDetails(slug) {
    try {
        const response = await soraFetch(detailsUrl + slug);
        const json = await response.json();

        const details = {
            description: '',
            aliases: '',
            airdate: ''
        }

        let airDate = '';
        if(json?.ani_aired) {
            if(json?.ani_aired_fin) {
                airDate = `${ json.ani_aired } - ${ json.ani_aired_fin }`;
            } else {
                airDate = json.ani_aired;
            }
        } else {
            if(json?.ani_release) {
                airDate = json.ani_release;
            } else {
                airDate = 'Aired: Unknown';
            }
        }

        details.description = json.ani_synopsis ?? 'No description available';
        details.aliases = json.ani_synonyms ?? '';
        details.airdate = airDate;

        return JSON.stringify([details]);

    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: '',
            airdate: 'Aired: Unknown'
        }]);
    }
}

async function extractEpisodes(slug) {
    try {
        const response = await soraFetch(episodesUrl + slug);
        const json = await response.json();

        const episodes = json.map(ep => {
            return {
                // href: watchUrl + slug + ep.ep_id_name,
                href: embedUrl + slug + ep.ep_id_name,
                number: parseInt(ep.ep_id_name),
                title: ep.ep_name,
            }
        });

        return JSON.stringify(episodes);        
    } catch (error) {
        console.error('soraFetch error:', error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        const json = await response.json();

        console.log('=============================');
        console.log(json);

    } catch(error) {
        console.error('soraFetch error:', error);
        return null;
    }

    

    return;


    
    const validServers = ['streamwish'];
    try {
        const iframeRegex = /src="([^"]*)/;

        const urlArr = url.split('&');
        const uid = urlArr[1].split('=')[1];
        const episode = urlArr[2].split('=')[1];

        const embedServerUrl = `https://hikaritv.gg/ajax/embedserver/${uid}/${episode}`;

        const embedServerResponse = await soraFetch(embedServerUrl);
        const embedServerData = await JSON.parse(embedServerResponse);

        const embedId = embedServerData.embedFirst;

        // Get all 'valid' and 'functioning' options
        // Streamwish - valid
        // Por Sub & Por Dub - Portuguese (new and rare as of 2025-03-13)
        // PlayerX - Invalid, too much work to figure out how to get the stream URL , though if someone figures it out, I'd love to know (Ask for debug data to get started)
        // Filemoon - Invalid, too much work to figure out how to get the stream URL , though if someone figures it out, I'd love to know (Ask for debug data to get started)
        const trimmedHtml = cutHtml(embedServerData.html, 'servers-dub', 'clearfix');

        const regex = /" id=[\\]?"embed-([0-9]*).+>[\n\s]+([^<]+)/g;
        const matches = trimmedHtml.matchAll(regex);
        const validMatches = [];

        for(let match of matches) {
            let server = match[2].trim().toLowerCase();

            if(validServers.includes(server)) {
                if(match[1] == embedServerData?.embedFirst) {
                    embedId = match[1];
                    break;
                }
                validMatches.push(match[1]);
            }
        }

        if(embedId == null) {
            if(validMatches.size < 0) {
                throw('No valid server found');
            }
            embedId = validMatches[0]; // First entries are sub, later entries are multi
        }

        const embedUrl = `https://hikaritv.gg/ajax/embed/${uid}/${episode}/${embedId}`;

        const embedResponse = await soraFetch(embedUrl);
        const embedData = await JSON.parse(embedResponse);

        const iframeString = embedData[0];
        const iframeMatch = iframeString.match(iframeRegex);

        if (iframeMatch == null) {
            return null;
        }

        const streamPageUrl = iframeMatch[1];

        const StreamPageResponse = await soraFetch(streamPageUrl);
        const streamPage = await StreamPageResponse;
        const unpackedScript = deobfuscate(streamPage);

        const streamRegex = /file:"(https[^"]*)/;
        const streamMatch = unpackedScript.match(streamRegex);

        if (streamMatch == null) {
            return null;
        }

        const streamUrl = streamMatch[1];

        return streamUrl;

    } catch (error) {
        console.error('soraFetch error:', error);
        return null;
    }
}

// Trims around the content, leaving only the area between the start and end string
function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
}

// Cuts out the content between start and end string
function cutHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);

    // Nothing to cut out
    if(startIndex <= 0) return html;

    const startContent = html.substring(0, startIndex);
    const endContent = html.substring(endIndex);

    let tmpContent = startContent + endContent;

    return tmpContent;
}

function deobfuscate(html) {
    const obfuscatedScript = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
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

function detect(source) {
    return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

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