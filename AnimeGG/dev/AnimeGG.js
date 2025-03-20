const BASE_URL = 'https://www.animegg.org';
const SEARCH_URL = 'https://www.animegg.org/search/?q=';
const UTILITY_URL = 'https://ac-api.ofchaos.com';
const FORMAT = 'SUB'; // SUB | DUB

//***** LOCAL TESTING
(async() => {
    const results = await searchResults('Sentai red');
    const details = await extractDetails(JSON.parse(results)[0].href);
    // console.log('DETAILS:', details);
    const episodes = await extractEpisodes(JSON.parse(results)[0].href);
    // console.log('EPISODES:', episodes);
    const streamUrl = await extractStreamUrl(JSON.parse(episodes)[0].href);
    console.log('STREAMURL:', streamUrl);
})();
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const REGEX = /a href="([\s\S]+?)"[\s\S]+?img src="([\s\S]+?)"[\s\S]+?h2>([\s\S]+?)</g;

    try {
        const response = await fetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'class="moose page"', 'class="container"');
        
        const matchesArray = Array.from(trimmedHtml.matchAll(REGEX)).map(m => {
            return {
                title: m[3],
                image: m[2],
                href: BASE_URL + m[1]
            }
        });

        return JSON.stringify(matchesArray);

    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    // const REGEX = /Alternate Titles: ([\s\S]+?)<[\s\S]+?ptext">([\s\S]+?)</;
    const REGEX = /(?:Alternate Titles: ([\s\S]+?)<[\s\S]+?ptext">([\s\S]+?)<)|(?:ptext">([\s\S]+?)<)/;

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, '"media-body"', 'class="upbit"');
        const match = trimmedHtml.match(REGEX);

        const details = {
            description: match[3] != null ? match[3] : match[2],
            aliases: match[1] != null ? match[1] : '',
            airdate: 'Aired: Unknown'
        };

        return JSON.stringify([details]);
    } catch(error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: '',
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
    const INIT_REGEX = /<div>([\s\S]+?)<\/div>/g;
    const INNER_REGEX = /a href="([\s\S]+?)" class="anm_det_pop"[\s\S]+?anititle">Episode ([0-9]+)/;
    let subbed_episodes = [];
    let dubbed_episodes = [];

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'class="newmanga"', '</ul>');

        const matchesArray = Array.from(trimmedHtml.matchAll(INIT_REGEX));

        for(let match of matchesArray) {
            let fragment = match[1];
            let innerMatch = fragment.match(INNER_REGEX);

            if(fragment.indexOf('#subbed') > 0) {
                subbed_episodes.push({ href: `${ BASE_URL }${ innerMatch[1] }#subbed`, number: parseInt(innerMatch[2]) });
            }
            if(fragment.indexOf('#dubbed') > 0) {
                dubbed_episodes.push({ href: `${ BASE_URL }${ innerMatch[1] }#dubbed`, number: parseInt(innerMatch[2]) });
            }
        }

        if(FORMAT === 'SUB') {
            return JSON.stringify(subbed_episodes.reverse());
        }

        return JSON.stringify(dubbed_episodes.reverse());

    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    const SUB_REGEX = /subbed-Animegg[\s\S]+?src="([\s\S]+?)"/;
    const DUB_REGEX = /dubbed-Animegg[\s\S]+?src="([\s\S]+?)"/;
    const SOURCES_REGEX = /file: "([\s\S]+?)", label: "([\s\S]+?)", bk: "([\s\S]+?)", isBk: (false|true)/g;

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'tab-content', 'class="container"');
        
        const embedUrl = FORMAT === 'SUB' ? trimmedHtml.match(SUB_REGEX)[1] : trimmedHtml.match(DUB_REGEX)[1];

        const embedResponse = await fetch(`${ BASE_URL }${ embedUrl }`);
        const embedHtml = typeof embedResponse === 'object' ? await embedResponse.text() : await embedResponse;

        const trimmedEmbed = trimText(embedHtml, 'var videoSources = ', ';');

        const sources = Array.from(trimmedEmbed.matchAll(SOURCES_REGEX)).map(m => {
            return {
                file: `${ BASE_URL }${ m[1] }`,
                quality: parseInt(m[2].replace('p', '')),
                bk: decodeURIComponent(atob(m[3])),
                // bk: m[3],
                isBk: m[4] === 'true' ? true : false
            }
        }).sort((a, b) => a?.quality === b?.quality ? 0 : a?.quality > b?.quality ? -1 : 1);

        console.log(sources[0].bk);
        
        return sources[0]?.bk;

    } catch(e) {
        console.log('Error:', e);
        return null;
    }
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

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("atob failed: The input is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
            ? output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
            : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}