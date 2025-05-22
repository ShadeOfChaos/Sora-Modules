async function areRequiredServersUp() {
    const requiredHosts = ['https://www.animeparadise.moe'];

    try {
        let promises = [];

        for(let host of requiredHosts) {
            promises.push(
                new Promise(async (resolve) => {
                    let response = await soraFetch(host, { method: 'HEAD' });
                    response.host = host;
                    return resolve(response);
                })
            );
        }

        return Promise.allSettled(promises).then((responses) => {
            for(let response of responses) {
                if(response.status === 'rejected' || response.value?.status != 200) {
                    let message = 'Required source ' + response.value?.host + ' is currently down.';
                    console.log(message);
                    return { success: false, error: encodeURIComponent(message), searchTitle: `Error cannot access ${ response.value?.host }, server down. Please try again later.` };
                }
            }

            return { success: true, error: null, searchTitle: null };
        })

    } catch (error) {
        console.log('Server up check error: ' + error.message);
        return { success: false, error: encodeURIComponent('#Failed to access required servers'), searchTitle: 'Error cannot access one or more servers, server down. Please try again later.' };
    }
}

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
    const serversUp = await areRequiredServersUp();

    if(serversUp.success === false) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
            href: '#' + serversUp.error,
        }]);
    }

    try {
        const response = await soraFetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const html = typeof response === 'object' ? await response.text() : await response;

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
    const REGEX = /style_specs_header_year.+?>.+([0-9]{4})[\s\S]+style_specs_container_middle.+?>([\s\S]+?)</g;
    if(url.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }

    try {
        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw new Error('Error obtaining data');

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
    const BASE_URL = 'https://www.animeparadise.moe/watch/';

    try {
        if(url.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;
        var episodes = [];

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json');

        const origin = json?.props?.pageProps?.data?._id;

        const episodesList = json?.props?.pageProps?.data?.ep;
        if(episodesList == null) throw new Error('Error obtaining episodes');
        
        // We use this to fetch all the data from the JSON from episode 1, rather than fetching the data for each episode
        episodes = await getEpisodesWithLanguageSubs(`${ BASE_URL }${ episodesList[0] }?origin=${ origin }`, 'Spanish', 'vtt');
        if(episodes.length <= 0) throw new Error('No episodes with Spanish subtitles found.');

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
    try {
        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json');

        const streamUrl = json?.props?.pageProps?.episode?.streamLink;
        const subtitles = json?.props?.pageProps?.episode?.subData.find(sub => sub.type === 'vtt' && sub.label === 'Spanish');
        if(subtitles == null) throw new Error('No Spanish subtitles found');

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles?.src });

    } catch (e) {
        console.log('Error extracting stream: ' + e.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

async function getEpisodesWithLanguageSubs(episodeUrl, language = 'English', type = 'vtt') {
    const BASE_URL = 'https://www.animeparadise.moe/watch/';

    try {
        const response = await soraFetch(episodeUrl);
        const html = typeof response === 'object' ? await response.text() : await response;
        var episodes = [];

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json');

        const origin = json?.props?.pageProps?.animeData?._id;
        const episodesList = json?.props?.pageProps?.episodeList;

        for(let ep of episodesList) {
            let subtitles = ep.subData.find(sub => sub.type === type && sub.label === language);
            if(subtitles == null) continue;

            episodes.push({
                href: `${ BASE_URL }${ ep?.uid }?origin=${ origin }`,
                number: parseInt(ep.number)
            });
        }

        return episodes;
    } catch(e) {
        console.log('Error retrieving episodes with appropriate subtitles: ' + e.message);
        return [];
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