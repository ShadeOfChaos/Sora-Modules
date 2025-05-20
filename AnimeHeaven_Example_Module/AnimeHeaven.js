// This is an example module for people learning how to create their own modules for Sora/Sulfur
const BASE_URL = "https://animeheaven.me/";
const SEARCH_URL = "https://animeheaven.me/search.php?s=";

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const REGEX = /coverimg' src='([\s\S]*?)'[\s\S]*?href='([\s\S]*?)'[\s\S]*?>([\s\S]*?)</g;

    try {
        const response = await soraFetch(`${ SEARCH_URL }${ encodeURIComponent(keyword) }`);
        const html = typeof response === 'object' ? await response.text() : await response;

        const matches = html.matchAll(REGEX);
        const matchesArray = Array.from(matches);
        const results = matchesArray.map(match => {
            return {
                title: match[3],
                image: BASE_URL +match[1],
                href: BASE_URL + match[2]
            }
        });

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
    const REGEX = /infotitlejp c'>([\s\S]*?)<[\s\S]*?infodes c'>([\s\S]*?)<[\s\S]*?Year:[\s\S]*?>([\s\S]*?)</;

    try {
        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const match = html.match(REGEX);
        const details = {
            description: match[2],
            aliases: match[1],
            airdate: match[3],
        };

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
    const REGEX = /href='(episode[\s\S]*?)'[\s\S]*?watch2[\s\S]*?>([\s\S]*?)</g;

    try {
        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const matches = html.matchAll(REGEX);
        const matchesArray = Array.from(matches);
        const episodes = matchesArray.map(match => {
            return {
                number: parseInt(match[2]),
                href: BASE_URL + match[1]
            }
        }).reverse(); // Reversing the resulting episodes array since the website lists episodes in descending order and Sora does not sort the episodes

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
    const REGEX = /source src='([\s\S]*?)'/g;

    try {
        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const matches = html.matchAll(REGEX);
        const matchesArray = Array.from(matches);
        const sources = matchesArray.map(match => match[1]);

        const streamUrl = sources[0]; // No quality options on this site, so we pick the first option

        return streamUrl;

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return null;
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