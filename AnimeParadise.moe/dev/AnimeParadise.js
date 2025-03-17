// import fs from 'node:fs';

// //***** LOCAL TESTING
// const results = await searchResults();
// const details = await extractDetails();
// const episodes = await extractEpisodes();
// const streamUrl = await extractStreamUrl();
// console.log('STREAMURL:', streamUrl);
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const episodeListUrl = 'https://www.animeonsen.xyz/details/VW2uXR5DvjxlLSw5';

    return JSON.stringify([{ title: 'Test show', image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/ofchaos.jpg', href: 'https://www.animeonsen.xyz/details/VW2uXR5DvjxlLSw5' }]);
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
    const episodeUrl = 'https://www.animeonsen.xyz/watch/VW2uXR5DvjxlLSw5?episode=1';

    return JSON.stringify([{
        href: episodeUrl,
        number: 1
    }]);
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    try {
        const response = await fetch('https://www.animeparadise.moe/watch/deffc3d9-1308-498a-82f2-b3635aecbc42?origin=Y45v9Oh6TpXU1EEY');
        const html = await response;

        const trimmedHtml = trimHtml(html, '__NEXT_DATA__', '</script>');

        const jsonString = trimmedHtml.slice(39);
        const json = JSON.parse(jsonString);

        const streamUrl = json?.props?.pageProps?.episode?.streamLink;
        const subtitles = json?.props?.pageProps?.episode?.subData.find(sub => sub.type === 'vtt' && sub.label === 'English');

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles });
        
    } catch(e) {
        console.log('Error:', e);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

// Trims around the content, leaving only the area between the start and end string
function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
}

// function writeFile(title, content) {
//     fs.writeFile('debug/animeparadise-' + title, content, err => {
//         if (err) {
//             console.log('Failed to write to file', err.message);
//         } else {
//             console.log('Successfully saved file: ', title);
//         }
//     });
// }
