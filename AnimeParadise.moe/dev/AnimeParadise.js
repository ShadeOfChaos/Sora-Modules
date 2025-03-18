// // //***** LOCAL TESTING
// const results = await searchResults('Solo leveling');
// const details = await extractDetails(JSON.parse(results)[0].href);
// const episodesa = await extractEpisodes(JSON.parse(results)[0].href);
// const streamUrl = await extractStreamUrl(JSON.parse(episodesa)[0].href);
// console.log('STREAMURL:', streamUrl);
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const BASE_URL = 'https://www.animeparadise.moe';
    const SEARCH_URL = 'https://www.animeparadise.moe/search?q=';
    const REGEX = /a href="(\/anime\/[^"]+)[\s\S]+?src="([^"]+)[\s\S]+?div[\s\S]+?[\s\S]+?div[\s\S]+?>([^<]+)/g;
    var shows = [];

    try {
        const response = await fetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const html = await response.text(); // TODO - REVERT

        const matches = html.matchAll(REGEX);

        for (let match of matches) {
            shows.push({
                title: match[3],
                image: match[2],
                href: BASE_URL + match[1]
            });
        }

        return JSON.stringify(shows);
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
    const REGEX = /style_specs_header_year.+?>.+([0-9]{4})[\s\S]+style_specs_container_middle.+?>([\s\S]+?)</g;

    try {
        const response = await fetch(url);
        const html = await response.text();// TODO - revert

        const json = getNextData(html);
        if (json == null) throw('Error parsing NEXT_DATA json');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw('Error obtaining data');

        let aliasArray = data?.synonyms;
        if(aliasArray != null && aliasArray.length > 5) {
            aliasArray = aliasArray.slice(0, 5);
        }
        const aliases = aliasArray.join(', ');

        const details = {
            description: data?.synopsys,
            aliases: aliases,
            airdate: data?.animeSeason?.season + ' ' + data?.animeSeason?.year
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
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    const BASE_URL = 'https://www.animeparadise.moe/watch/';

    try {
        const response = await fetch(url);
        const html = await response.text();// TODO - revert
        var episodes = [];

        const json = getNextData(html);
        if (json == null) throw ('Error parsing NEXT_DATA json');

        const origin = json?.props?.pageProps?.data?._id;

        const episodesList = json?.props?.pageProps?.data?.ep;
        if(episodesList == null) throw('Error obtaining episodes');

        for(let i=0,len=episodesList.length; i<len; i++) {
            let url = `${ BASE_URL }${ episodesList[i] }?origin=${ origin }`;

            episodes.push({
                href: url,
                number: i+1
            })
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.error('Fetch error:', error);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    try {
        const response = await fetch(url);
        const html = await response.text(); // TODO - REVERT

        const json = getNextData(html);
        if (json == null) throw ('Error parsing NEXT_DATA json');

        const streamUrl = json?.props?.pageProps?.episode?.streamLink;
        const subtitles = json?.props?.pageProps?.episode?.subData.find(sub => sub.type === 'ass' && sub.label === 'English');
        console.log('Subs:', subtitles);
        // console.log(json?.props?.pageProps?.episode?.subData);

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles?.src });

    } catch (e) {
        console.log('Error:', e);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

function getNextData(html) {
    const trimmedHtml = trimHtml(html, '__NEXT_DATA__', '</script>');
    const jsonString = trimmedHtml.slice(39);

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.log('Error parsing NEXT_DATA json');
        return null;
    }
}

// Trims around the content, leaving only the area between the start and end string
function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
}