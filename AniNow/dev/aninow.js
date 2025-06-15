//***** LOCAL TESTING
// const results = await searchResults();
// const details = await extractDetails();
// const episodes = await extractEpisodes();
// const streamUrl = await extractStreamUrl();
// console.log('STREAMURL: ', streamUrl);
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    return JSON.stringify([{ title: 'Test show', image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/ofchaos.jpg', href: '#' }]);
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    const details = {
        description: 'Test show',
        aliases: '',
        airdate: ''
    }

    return JSON.stringify([details]);
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    return JSON.stringify([{
        href: '#',
        number: 1
    }]);
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    const REGEX = /data-media-sources="([\s\S]*?)"/;
    const apiUrl = 'https://aninow.to/api/{source}/sources?url=';
    const kwikUrl = apiUrl.replace('{source}', 'kwik');
    const paheUrl = apiUrl.replace('{source}', 'gojo');
    const strixUrl = apiUrl.replace('{source}', 'gojo');
    const zazaUrl = apiUrl.replace('{source}', 'gojo');
    const meggUrl = apiUrl.replace('{source}', 'gojo');
    const defaultUrl = apiUrl.replace('{source}', 'gojo');
    const gDriveUrl = 'https://aninow.to/storage/C:/Users/GraceAshby/OneDrive/aninow/media/';
    const streamPreUrl = 'https://aninow.to';

    try {
        let promises = [];
        let streams = [];

        const res = await soraFetch('https://aninow.to/w/my-hero-academia-vigilantes/e/1');
        const html = await res.text();

        const match = html.match(REGEX);
        if(match[1] == null) throw new Error("No mediasources found");

        const sources = JSON.parse(decodeHtmlEntities(decodeURI(match[1]))).map(source => {
            source.url = encodeURIComponent(source.url);
            return source;
        });

        for(let source of sources) {
            if(source.type.toLowerCase() != 'stream') continue;
            if(source?.provider == null) continue;

            let fetchUrl = null;
            let provider = source.provider.toLowerCase();

            console.log('Provider: ', provider, source.language);
            if(provider == 'pahe') {
                if(source?.kwikurl != null) {
                    if(source.language.toLowerCase() != 'english') continue;
                    fetchUrl = kwikUrl + source.kwikurl;

                } else {
                    fetchUrl = paheUrl + source.url;
                }
            
            } else if(provider == 'strix') {
                fetchUrl = strixUrl + source.url;
            
            } else if(provider == 'zaza') {
                fetchUrl = zazaUrl + source.url;
            
            } else if(provider == 'megg') {
                fetchUrl = meggUrl + source.url;
            
            } else if(provider == 'google-drive') {
                fetchUrl = gDriveUrl + decodeURIComponent(source.url);
            
            } else {
                fetchUrl = defaultUrl + source.url;

            }

            promises.push(processFetchUrl(fetchUrl, source));
        }

        
        const results = await Promise.allSettled(promises);
        
        for(let result of results) {
            if(result.status != 'fulfilled') continue;

            let mediaSource = result.value;
            let language = getLanguage(mediaSource.info.language, mediaSource.subtitles != null);
            
            for(let source of mediaSource.sources) {
                streams.push({
                    title: `[${ language }] ${ mediaSource.info.provider } (${ source.quality })`,
                    streamUrl: streamPreUrl + source.url,
                    headers: mediaSource.info.headers,
                    subtitles: mediaSource.subtitles
                });
            }
        }

        return JSON.stringify(streams);

    } catch(e) {
        console.log('Error extracting stream: ' + e.message);
        return null;
    }
}

function decodeHtmlEntities(text) {
    let tempString = text;

    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&apos;"
    }

    for (const [decoded, encoded] of Object.entries(entities)) {
        tempString = tempString.replaceAll(encoded, decoded);
    }

    return tempString;
}

function getLanguage(language, hasSubtitles) {
    let lang = language.toLowerCase();
    if(lang == 'dub') return 'English DUB';
    if(lang == 'sub') return 'English SUB';
    if(lang == 'jpn') return 'English SUB';
    else if(hasSubtitles) return `${ language } SUB`;
    return `${ language } DUB`;
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

async function processFetchUrl(url, source) {
    return new Promise(async (resolve, reject) => {
        try {
            const res = await soraFetch(url);
            if(res.status == 200 && res.ok) {
                let data = await res.json();
                data.info = source;
                return resolve(data);
            }
            
            return reject(null);
        } catch(e) {
            console.log('[processFetchUrl] Error:' + e.message);
            return reject(null);
        }  
    });
}