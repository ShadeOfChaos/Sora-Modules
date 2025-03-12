async function searchResults(keyword) {
    try {
        const baseUrl = "https://watch.hikaritv.xyz/";
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetch(`https://watch.hikaritv.xyz/search?keyword=${encodedKeyword}&language=ani_sub`);
        const html = await response;

        // Cut down on regex-workload
        const trimmedHtml = trimHtml(html, 'class="film_list-wrap', 'class="pre-pagination');

        const regex = /<div class="flw-item"[\s\S]*?src="(.+)"[\s\S]*?href="([^"]+)[\s\S]*?dynamic-name">[\s]*([^<]+)/g;
        const results = Array.from(trimmedHtml.matchAll(regex), match => {
            return { image: match[1], href: baseUrl + match[2], title: match[3].trim() }
        }) || [];

        return JSON.stringify(results);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetch(url);
        const html = await response;
        // Cut down on regex-workload
        const trimmedHtml = trimHtml(html, 'class="anisc-info-wrap', '<script');


        const details = {
            description: '',
            aliases: '',
            airdate: ''
        }

        const descriptionRegex = /<h3>Description:<\/h3>[\s\n]*<p>([^<]+)/;
        const descriptionMatch = trimmedHtml.match(descriptionRegex);

        if (descriptionMatch != null) {
            details.description = descriptionMatch[1];
        }

        const sidebarRegex = /(Japanese|English|Synonyms|Aired):<\/span>[\s\n]*<span class="name">([^<]+)/g;
        const sidebarMatch = Array.from(trimmedHtml.matchAll(sidebarRegex), m => {
            let obj = {};
            obj[m[1]] = m[2];
            return obj;
        }) || [];

        if (sidebarMatch.length <= 0) {
            return JSON.stringify([details]);
        }

        const result = Object.assign({}, ...sidebarMatch);

        details.airdate = result?.Aired || '';
        details.aliases = buildAliasString(result);

        return JSON.stringify([details]);

        // Encapsulating this away
        function buildAliasString(resultObj) {
            let string = '';

            if (resultObj?.Japanese) {
                string += resultObj.Japanese;
            }

            if (resultObj?.English) {
                if (string != '') string += ', ';
                string += resultObj.English;
            }

            if (resultObj?.Synonyms) {
                if (string != '') string += ', ';
                string += resultObj.Synonyms;
            }

            return string;
        }
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const episodes = [];
        const baseUrl = "https://watch.hikaritv.xyz/";
        let episodesBaseUrl = '';

        const response = await fetch(url);
        const html = await response;
        // Cut down on regex-workload
        const trimmedHtml = trimHtml(html, 'class="anisc-detail', 'btn-play');

        const regex = /SUB: ([0-9]+)[\s\S]*<a href="\/([^"]+)/;
        const match = trimmedHtml.match(regex);

        if (match == null) {
            return JSON.stringify(episodes);
        }

        episodesBaseUrl = baseUrl + match[2].slice(0, -1);

        for (let i = 1, len = match[1]; i <= len; i++) {
            let episodeUrl = episodesBaseUrl + i;

            episodes.push({
                href: episodeUrl,
                number: i
            });
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error('Fetch error:', error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const iframeRegex = /src="([^"]*)/;

        const urlArr = url.split('&');
        const uid = urlArr[1].split('=')[1];
        const episode = urlArr[2].split('=')[1];

        const embedServerUrl = `https://watch.hikaritv.xyz/ajax/embedserver/${uid}/${episode}`;

        const embedServerResponse = await fetch(embedServerUrl);
        const embedServerData = await JSON.parse(embedServerResponse);

        const embedId = embedServerData.embedFirst;
        const embedUrl = `https://watch.hikaritv.xyz/ajax/embed/${uid}/${episode}/${embedId}`;

        const embedResponse = await fetch(embedUrl);
        const embedData = await JSON.parse(embedResponse);

        const iframeString = embedData[0];
        const iframeMatch = iframeString.match(iframeRegex);

        if (iframeMatch == null) {
            return null;
        }

        const streamPageUrl = iframeMatch[1];

        const StreamPageResponse = await fetch(streamPageUrl);
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
        console.error('Fetch error:', error);
        return null;
    }
}

function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
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