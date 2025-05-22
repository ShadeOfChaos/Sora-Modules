async function areRequiredServersUp() {
    const requiredHosts = ['https://www.animeparadise.moe', 'https://asura.ofchaos.com'];

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
    const ANIME_URL = 'https://www.animeparadise.moe/anime/';
    const SEARCH_URL = 'https://www.animeparadise.moe/search?q=';
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

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw new Error('Error obtaining data');

        const animesWithSubtitles = await GetAnimes();
        
        for(let entry of data) {
            if(!animesWithSubtitles.includes(entry.mappings.anilist)) {
                continue;
            }

            shows.push({
                title: entry.title,
                image: entry.posterImage.original,
                href: ANIME_URL + entry.link
            });
        }

        return JSON.stringify(shows);
    } catch (error) {
        console.log('Test');
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

        const episodesWithSubtitlesJson = await GetEpisodes(json.props.pageProps.data?.mappings?.anilist);
        const episodesWithSubtitles = episodesWithSubtitlesJson.map((entry) => entry?.episode);

        for(let i=1,len=episodesList.length; i<=len; i++) {
            if(!episodesWithSubtitles.includes(i)) {
                continue;
            }

            let url = `${ BASE_URL }${ episodesList[i] }?origin=${ origin }`;

            episodes.push({
                href: url,
                number: i
            })
        }

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
        const subtitles = GetSubtitles(json.props.pageProps?.animeData?.mappings?.anilist, json.props.pageProps.episode?.number);
        if(subtitles == null) throw new Error('Invalid data while attempting to get subtitles');

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles });

    } catch (error) {
        console.log('Error extracting stream url: ' + error.message);
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

async function GetAnimes() {
    const baseUrl = 'https://asura.ofchaos.com/api/anime';
    const referer = 'SoraApp';
    try {
        const response = await soraFetch(baseUrl, { headers: { 'Referer': referer } });
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(json == null)                 throw new Error('Error parsing Asura json');
        if(json?.success !== true)       throw new Error(json?.error);
        if(json?.result?.length == null) throw new Error('Error obtaining data from Asura API');

        return json?.result;

    } catch(error) {
        console.log('[ASURA][GetAnimes] Error: ' + error.message);
        return [];
    }
}

async function GetEpisodes(anilistId) {
    if(anilistId == null || isNaN(parseInt(anilistId))) {
        return [];
    }

    const baseUrl = 'https://asura.ofchaos.com/api/anime';
    const referer = 'SoraApp';

    try {
        const response = await soraFetch(`${ baseUrl }/${ anilistId }`, { headers: { 'Referer': referer } });
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(json == null)                 throw new Error('Error parsing Asura json');
        if(json?.success !== true)       throw new Error(json?.error);
        if(json?.result?.length == null) throw new Error('Error obtaining data from Asura API');

        return json?.result;

    } catch(error) {
        console.log('[ASURA][GetEpisodes] Error: ' + error.message);
        return [];
    }
}

function GetSubtitles(anilistId, episodeNr) {
    if(
        anilistId == null ||
        isNaN(parseInt(anilistId)) ||
        episodeNr == null ||
        isNaN(parseInt(episodeNr))
    ) {
        return null;
    }

    const baseUrl = 'https://asura.ofchaos.com/api/anime';

    return `${ baseUrl }/${ anilistId }/${ episodeNr }`;
}

// Uses Sora's fetchv2 on ipad, fallbacks to regular fetch on Windows
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