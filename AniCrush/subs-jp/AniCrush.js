async function areRequiredServersUp() {
    const requiredHosts = ['https://anicrush.to', 'https://ac-api.ofchaos.com', 'https://asura.ofchaos.com'];

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
 * Given an image path, returns the URL to the resized image on AniCrush's CDN.
 * @param {string} path - The image path to transform.
 * @param {string} [type="poster"] - The type of image requested (poster or banner).
 * @returns {string} - The URL to the resized image.
 */
function getImage(path, type = "poster") {
    const SOURCE_STATIC_URL = "https://static.gniyonna.com/media/poster";
    const pathToReverse = path.split('/')[2];

    let reversedPath = '';
    for (let i = pathToReverse.length - 1; i >= 0; i--) {
        reversedPath += pathToReverse[i];
    }

    const extension = path.split('.').pop();
    const imageUrl = `${ SOURCE_STATIC_URL }/${type === "poster" ? "300x400" : "900x600"}/100/${ reversedPath }.${ extension }`;

    return imageUrl;
}

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const BASE_URL = 'https://anicrush.to';
    const UTILITY_URL = 'https://api.anicrush.to/shared/v2';
    let shows = [];

    const serversUp = await areRequiredServersUp();

    if(serversUp.success === false) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
            href: '#' + serversUp.error,
        }]);
    }

    try {
        const asuraList = await GetAnimes();

        const page = 1;
        const limit = 24;
        const response = await soraFetch(`${ UTILITY_URL }/movie/list?keyword=${encodeURIComponent(keyword)}&page=${ page }&limit=${ limit }`, { headers: GetAniCrushHeaders() });
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data?.status == false || data?.result?.movies?.length <= 0) {
            throw new Error('No results found');
        }

        const moviesData = await getAniCrushAnilistId(data.result.movies);
        
        for(let entry of moviesData) {
            if(!asuraList.includes(entry.anilistId)) {
                continue;
            }

            const href = `${ BASE_URL }/watch/${ entry.slug }.${ entry.id }`;

            // Href value:
            // [url, origin, anilistId, detatilsUrl, episodesUrl]
            shows.push({
                title: entry.name,
                image: getImage(entry.poster_path),
                href: `${ href }|AniCrush|${ entry.anilistId }|https://api.anicrush.to/shared/v2/movie/getById/${ entry.id }|https://api.anicrush.to/shared/v2/episode/list?_movieId=${ entry.id }`
            });
        }

        return JSON.stringify(shows);

    } catch (error) {
        console.log('[ASURA][aniCrushSearch] Fetch error: ' + error?.message);
        return [];
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} objString - The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(objString) {
    if(objString.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }

    const encodedDelimiter = encodeURIComponent('|');
    let json = {};
    [json.url, json.origin, json.anilistId, json.detailsUrl, json.episodesUrl] = objString.split(encodedDelimiter);

    try {
        const response = await soraFetch(json.detailsUrl, { headers: GetAniCrushHeaders() });
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data?.status == false || data?.result == null) {
            throw new Error('Error obtaining details from AniCrush API');
        }

        return JSON.stringify([{
            description: data.result.overview,
            aliases: buildAliasString(data.result?.name, data.result?.name_english, data.result?.name_japanese, data.result?.name_synonyms),
            airdate: data.result?.aired_from + ' - ' + data.result?.aired_to
        }]);

    } catch (error) {
        console.log('[ASURA][ExtractDetails] Details error: ' + error?.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Extracts the episodes from the given url
 * @param {string} objString - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(objString) {
    const encodedDelimiter = encodeURIComponent('|');
    let json = {};
    [json.url, json.origin, json.anilistId, json.detailsUrl, json.episodesUrl] = objString.split(encodedDelimiter);

    try {
        if(objString.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

        if(json?.episodesUrl == null) {
            throw new Error('No episodes found');
        }

        const url = json.episodesUrl;
        const SOURCE_API_URL = 'https://api.anicrush.to/shared/v2';
        const movieId = url.split('=')[1];
        const serverId = 4;
        const format = 'sub';
        var episodes = [];

        const response = await soraFetch(url, { headers: GetAniCrushHeaders() });
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data?.status == false || data?.result == null) {
            throw new Error('No results found');
        }

        for(let episodeList in data.result) {
            for(let episode of data.result[episodeList]) {
                episodes.push({
                    href: `${ SOURCE_API_URL }/episode/sources?_movieId=${ movieId }&ep=${ episode.number }&sv=${ serverId }&sc=${ format }|${ json.anilistId }`,
                    number: parseInt(episode.number)
                });
            }
        }

        return JSON.stringify(episodes);

    } catch(error) {
        console.log('[ASURA][extractEpisodes] Episodes error: ' + error?.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(objString) {
    const SOURCE_BASE_URL = "https://anicrush.to";
    const UTILITY_URL = "https://ac-api.ofchaos.com";
    const delimiter = '|';
    const [url, anilistId] = objString.split(delimiter);

    try {
        if(url == null || anilistId == null) {
            throw new Error('No data returned from Sora in extractStreamUrl');
        }

        const epIndex = url.indexOf('ep=') + 3;
        const ep = url.substring(epIndex, url.indexOf('&', epIndex));

        const sourceResponse = await soraFetch(url, { headers: GetAniCrushHeaders() });
        const sourceData = typeof sourceResponse === 'object' ? await sourceResponse.json() : await JSON.parse(sourceResponse);

        if(
            sourceData.status == false || 
            sourceData.result == null || 
            sourceData.result.link == "" ||
            sourceData.result.link == null
        ) {
            throw new Error('No source found');
        }

        const source = sourceData.result.link;

        const hlsUrl = `${ UTILITY_URL }/api/anime/embed/convert/v2?embedUrl=${ encodeURIComponent(source) }`;
        const hlsResponse = await soraFetch(hlsUrl);
        const hlsData = typeof hlsResponse === 'object' ? await hlsResponse.json() : await JSON.parse(hlsResponse);

        if(hlsData?.status == false || hlsData?.result == null || hlsData?.error != null) {
            throw new Error('No stream found');
        }

        if(hlsData.result?.sources?.length <= 0) {
            throw new Error('No source found');
        }

        let streamSource = null;
        let mp4Source = null;

        for(let source of hlsData.result.sources) {
            if(source.type === 'hls') {
                streamSource = source;
                break;
            }
            if(source.type === 'mp4') {
                mp4Source = source;
            }
        }

        if(streamSource == null) {
            if(mp4Source == null) {
                throw new Error('No valid stream found');
            }
            streamSource = mp4Source;
        }

        const streamUrl = streamSource?.file;
        const subtitles = GetSubtitles(anilistId, ep);

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles });

    } catch(error) {
        console.log('[ASURA][extractStreamUrl] Stream URL error: ' + error?.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

/**
 * Given an array of movies, fetches the Anilist ID for each of them using the AniCrush API.
 * @param {Array<Object>} movies - Array of movie objects, each containing an `id` property.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of movie objects, each containing an `anilistId` property.
 */
async function getAniCrushAnilistId(movies) {
    const UTILITY_URL = 'https://api.anicrush.to/shared/v2/movie/getById/';

    return new Promise((resolve) => {
        let promises = [];

        for(let movie of movies) {
            let result = new Promise(async (resolve, reject) => {
                let res = await soraFetch(`${ UTILITY_URL }${ movie.id }`, { headers: GetAniCrushHeaders() });
                let data = typeof res === 'object' ? await res.json() : await JSON.parse(res);

                if(data?.result == null || data.result?.al_id == null) {
                    reject(null);
                }

                movie.anilistId = data.result.al_id;

                resolve(movie);
            });

            promises.push(result);
        }

        Promise.allSettled(promises).then((results) => {
            resolve(results.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value));
        })
    });
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

/**
 * Fetches a list of anime from the Asura API.
 * 
 * @returns {Promise<Array>} A promise that resolves to an array of anime objects.
 * If an error occurs during the fetch or parsing process, an empty array is returned.
 * 
 * @throws Will throw an error if the API response is invalid or cannot be parsed.
 * 
 * The function sends a request to the Asura API to retrieve a list of anime.
 * It expects a successful response with a non-null result array.
 * Any errors during the fetch or parsing are caught and logged, returning an empty array.
 */
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
        console.log('[ASURA][GetAnimes] Error: ' + error?.message);
        return [];
    }
}

/**
 * Returns the URL to fetch subtitles for the given anime and episode number
 * @param {number} anilistId - The Anilist ID of the anime
 * @param {number} episodeNr - The episode number to fetch subtitles for
 * @returns {string|null} The URL to fetch subtitles from, or null if an error occurred
 */
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

/**
 * Returns an object containing the headers required to make a request to the AniCrush API.
 * @returns {Object} An object containing the headers
 */
function GetAniCrushHeaders() {
    return {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'x-site': 'anicrush',
        'Referer': 'https://anicrush.to/',
        'Origin': 'https://anicrush.to',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty'
    }
}

/**
 * Builds a string containing the title of an anime in various languages
 * @param {string} romajiTitle - The title of the anime in romaji
 * @param {string} englishTitle - The title of the anime in english
 * @param {string} japaneseTitle - The title of the anime in japanese
 * @param {string} synonyms - Other titles the anime is known by
 * @returns {string} A comma-separated string containing the titles
 */
function buildAliasString(romajiTitle, englishTitle, japaneseTitle, synonyms) {
    let string = '';

    if (romajiTitle) {
        string += romajiTitle;
    }

    if (englishTitle) {
        
        if (string != '') string += ', ';
        string += englishTitle;
    }

    if (japaneseTitle) {
        if (string != '') string += ', ';
        string += japaneseTitle;
    }

    if (synonyms) {
        if (string != '') string += ', ';
        string += synonyms;
    }

    return string;
}