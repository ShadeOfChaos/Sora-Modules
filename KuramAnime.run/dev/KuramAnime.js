//***** LOCAL TESTING
const results = await searchResults('Solo leveling');
const details = await extractDetails(JSON.parse(results)[1].href);
const episodes = await extractEpisodes(JSON.parse(results)[1].href);
const streamUrl = await extractStreamUrl(JSON.parse(episodes)[0].href);
console.log('STREAMURL: ', streamUrl);
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const SEARCH_URL = 'https://v6.kuramanime.run/anime?search=';
    const REGEX = /data-setbg="([\s\S]+?)"[\s\S]+?<h5><a href="([\s\S]+?)"[\s\S]*?>([\s\S]+?)</g;
    var shows = [];

    try {
        const response = await fetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'id="animeList', 'id="filterLoading');

        const matches = trimmedHtml.matchAll(REGEX);

        for (let match of matches) {
            shows.push({
                title: match[3],
                image: match[1],
                href: match[2]
            });
        }

        return JSON.stringify(shows);
    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    const REGEX = /\/h3>\s*<span>([\s\S]*?)<[\s\S]+?id="synopsisField"[\s\S]*?>([\s\S]*?)<\/p[\s\S]+?Musim:[\s\S]+?a href[\s\S]+?>([\s\S]*?)</;

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'class="anime__details__text', 'id="episodeBatchListsSection"');

        const match = trimmedHtml.match(REGEX);

        const details = {
            description: cleanSynopsis(match[2]),
            aliases: match[1],
            airdate: match[3]
        }

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
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    const REGEX = /<a class[\s\S]*?href='([\s\S]*?)'[\s\S]*?>\s*Ep ([0-9]*)/g;

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'id="episodeLists', 'id="episodeBatchListsSection');

        const episodes = Array.from(trimmedHtml.matchAll(REGEX)).map(m => {
            return {
                href: m[1].trim(),
                number: parseInt(m[2])
            }
        });

        return JSON.stringify(episodes);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    console.log('DEBUG, STAGE 1');

    const BASE_URL = 'https://v6.kuramanime.run/';
    const kpsRegex = /data-kps="([\s\S]*?)"/;
    const envRegex = /([A-Z_]+):[\s]*'([\s\S]*?)'/g;
    const srcRegex = /src="([\s\S]*?)"[\s\S]+?size="([\s\S]*?)"/g;

    try {
        console.log('DEBUG, STAGE 2');
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const kpsMatch = html.match(kpsRegex);

        console.log('DEBUG, STAGE 3');

        if(kpsMatch == null || kpsMatch[1] == null) {
            throw new Error('Failed to capture kps data key');
        }

        const kps = kpsMatch[1]; // f

        console.log('DEBUG, STAGE 4, kps: ' + kps);

        // Gets the 'env' from the txt file [MIX_PREFIX_AUTH_ROUTE_PARAM, MIX_AUTH_ROUTE_PARAM, MIX_AUTH_KEY, MIX_AUTH_TOKEN, MIX_PAGE_TOKEN_KEY, MIX_STREAM_SERVER_KEY]
        const scriptResponse = await fetch(`https://v6.kuramanime.run/assets/js/${ kps }.js`);
        const js = typeof scriptResponse === 'object' ? await scriptResponse.text() : await scriptResponse;

        if(js == null || js == '') {
            throw new Error('Failed to capture env data');
        }

        console.log('DEBUG, STAGE 5');

        let env = {};
        const jsMatched = Array.from(js.matchAll(envRegex));
        for(let [ source, key, value ] of jsMatched) {
            env[key] = value;
        }

        console.log('DEBUG, STAGE 6');

        // Get access token
        const accessTokenResponse = await fetch(`${ BASE_URL }${ env.MIX_PREFIX_AUTH_ROUTE_PARAM }${ env.MIX_AUTH_ROUTE_PARAM }`, {
            method: 'GET',
            headers: {
                "X-Fuck-ID": `${ env.MIX_AUTH_KEY }:${ env.MIX_AUTH_TOKEN }`,
                "X-Request-ID": generateRandomString(6),
                "X-Request-Index": 0,
                // "X-CSRF-TOKEN": "s2pxmYBRqf9ZeYLnitdeeTFSvhZVp8uQABn5mQu3"
            }
        });
        const accessToken = typeof accessTokenResponse === 'object' ? await accessTokenResponse.text() : await accessTokenResponse;

        console.log('DEBUG, STAGE 7, accessToken: ' + accessToken);

        const streamUrlResponse = await fetch(`${ url }?${ env.MIX_PAGE_TOKEN_KEY }=${ accessToken }&${ env.MIX_STREAM_SERVER_KEY }=kuramadrive&page=1`, {
            method: 'GET',
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://v6.kuramanime.run/anime/2475/ore-dake-level-up-na-ken/episode/1",
                "X-Csrf-Token": "A5i9Edt2t0xyckplfLfdYI50GFkZrgjiwzhe6kKi"
            }
        });
        const streamHtml = typeof streamUrlResponse === 'object' ? await streamUrlResponse.text() : await streamUrlResponse;

        console.log('DEBUG, STAGE 8');

        const trimmedStreamHtml = trimText(streamHtml, '<video', '</video>');
        const slimTrimStreamHtml = trimmedStreamHtml.replaceAll('  ', '');

        console.log('DEBUG, STAGE 9, slimTrimStreamHtml: ' + slimTrimStreamHtml);

        const streamMatches = Array.from(slimTrimStreamHtml.matchAll(srcRegex)).map(m => {
            return {
                file: m[1],
                quality: m[2]
            }
        }).sort((a, b) => a?.quality === b?.quality ? 0 : a?.quality > b?.quality ? -1 : 1);

        console.log('DEBUG, STAGE 10, streamUrl: ' + streamMatches[0].file);

        return streamMatches[0].file;
    } catch(e) {
        console.log('DEBUG, STAGE 11, ERROR');
        console.log('Error: ' + e.message);
        return null;
    }
}

async function genericFetch(url, options) {
    const isNode = (typeof process !== 'undefined') && (process?.release?.name === 'node');

    if(isNode) {
        return await fetch(url, options);

    } else {
        const { method, headers, body } = options;
        return await fetchv2(url, headers, method, JSON.parse(body));
    }
}

function trimText(text, startString, endString) {
    const startIndex = text.indexOf(startString);
    const endIndex = text.indexOf(endString, startIndex);
    return text.substring(startIndex, endIndex);
}

function cleanSynopsis(html) {
    return html.replaceAll('<br>', '\n').replaceAll('<i>', '').replaceAll('</i>', '');
}

function generateRandomString(a) {
    let b = "";
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".length;
    for (let d = 0; d < a; d++)
        b += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * c));
    return b
}