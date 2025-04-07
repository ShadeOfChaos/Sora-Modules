const Asura = {
    referer: 'SoraApp',
    baseUrl: 'https://asura.ofchaos.com/api/anime',

    async GetAnimes() {
        try {
            const response = await fetch(Asura.baseUrl, {
                method: 'GET',
                headers: {
                    'Referer': Asura.referer
                },
            });
            const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

            if(json == null)                 throw('Error parsing Asura json');
            if(json?.success !== true)       throw(json?.error || 'Error obtaining data from Asura API');
            if(json?.result?.length == null) throw('Error obtaining data from Asura API');

            return json?.result;

        } catch(error) {
            console.log('[ASURA][GetAnimes] Error: ' + error.message);
            return [];
        }
    },

    async GetEpisodes(anilistId) {
        if(anilistId == null || parseInt(anilistId) == NaN) {
            return [];
        }

        try {
            const response = await fetch(`${ Asura.baseUrl }/${ anilistId }`, {
                method: 'GET',
                headers: {
                    'Referer': Asura.referer
                },
            });
            const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

            if(json == null)                 throw('Error parsing Asura json');
            if(json?.success !== true)       throw(json?.error || 'Error obtaining data from Asura API');
            if(json?.result?.length == null) throw('Error obtaining data from Asura API');

            return json?.result;

        } catch(error) {
            console.log('[ASURA][GetEpisodes] Error: ' + error.message);
            return [];
        }
    },

    GetSubtitles(anilistId, episodeNr) {
        if(
            anilistId == null ||
            parseInt(anilistId) == NaN ||
            episodeNr == null ||
            parseInt(episodeNr) == NaN
        ) {
            return null;
        }

        return `${ Asura.baseUrl }/${ anilistId }/${ episodeNr }`;
    }
};

// //***** LOCAL TESTING
// const results = await searchResults('cowboy bebop');
// console.log('RESULTS:', results);
// const details = await extractDetails(JSON.parse(results)[0].href);
// console.log('DETAILS:', details);
// const episodesa = await extractEpisodes(JSON.parse(results)[0].href);
// // console.log('EPISODES:', episodesa);
// const streamUrl = await extractStreamUrl(JSON.parse(episodesa)[0].href);
// console.log('STREAMURL:', streamUrl);
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const ANIME_URL = 'https://www.animeparadise.moe/anime/';
    const SEARCH_URL = 'https://www.animeparadise.moe/search?q=';
    var shows = [];

    try {
        const response = await fetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw('Error parsing NEXT_DATA json');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw('Error obtaining data');

        const animesWithSubtitles = await Asura.GetAnimes();
        
        for(let entry of data) {
            if(!animesWithSubtitles.includes(entry.mappings.anilist.toString())) {
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
        console.log('Fetch error:', error);
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

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

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
        const html = typeof response === 'object' ? await response.text() : await response;
        var episodes = [];

        const json = getNextData(html);
        if (json == null) throw ('Error parsing NEXT_DATA json');

        const origin = json?.props?.pageProps?.data?._id;

        const episodesList = json?.props?.pageProps?.data?.ep;
        if(episodesList == null) throw('Error obtaining episodes');

        const episodesWithSubtitles = await Asura.GetEpisodes(json.props.pageProps.data?.mappings?.anilist);

        for(let i=0,len=episodesList.length; i<len; i++) {
            if(!episodesWithSubtitles.includes(i.toString())) {
                continue;
            }

            let url = `${ BASE_URL }${ episodesList[i] }?origin=${ origin }`;

            episodes.push({
                href: url,
                number: i+1
            })
        }

        return JSON.stringify(episodes);
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
    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw ('Error parsing NEXT_DATA json');

        const streamUrl = json?.props?.pageProps?.episode?.streamLink;
        const subtitles = Asura.GetSubtitles(json.props.pageProps?.animeData?.mappings?.anilist, json.props.pageProps.episode?.number);
        if(subtitles == null) throw('Invalid data while attempting to get subtitles');

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles });

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