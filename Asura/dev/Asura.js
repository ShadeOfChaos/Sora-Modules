// // //***** LOCAL TESTING
// (async () => {
//     const results = await searchResults('Cowboy Bebop');
//     console.log('RESULTS: ', results);
//     const details = await extractDetails(JSON.parse(results)[2].href);
//     console.log('DETAILS: ', details);
//     const eps = await extractEpisodes(JSON.parse(results)[2].href);
//     console.log('EPISODES: ', eps);
//     const streamUrl = await extractStreamUrl(JSON.parse(eps)[0].href);
//     console.log('STREAMURL: ', streamUrl);
// })();
//***** LOCAL TESTING


/**
 * Given an image path, returns the URL to the resized image on AniCrush's CDN.
 * @param {string} path - The image path to transform.
 * @param {string} [type="poster"] - The type of image requested (poster or banner).
 * @returns {string} - The URL to the resized image.
 */
function getAniCrushImage(path, type = "poster") {
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
 * Searches for anime using the given keyword across multiple sources and returns the combined results.
 * 
 * @param {string} keyword - The keyword to search for.
 * @returns {Promise<string>} A promise that resolves with a JSON string containing merged search results 
 *                            from multiple sources, in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    let p = [];

    const asuraList = await GetAnimes();

    const anicrush = aniCrushSearch(keyword, asuraList);
    const animeparadise = animeParadiseSearch(keyword, asuraList);

    p.push(anicrush);
    p.push(animeparadise);

    return Promise.allSettled(p).then((results) => {
        // Merge results
        let mergedResults = [];
        for (let result of results) {
            if (result.status === 'fulfilled') {
                mergedResults = mergedResults.concat(result.value);
            }
        }
        

        return JSON.stringify(mergedResults);
    });
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} objString - The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(objString) {
    const encodedDelimiter = encodeURIComponent('|');
    let json = {};
    [json.url, json.origin, json.anilistId, json.detailsUrl, json.episodesUrl] = objString.split(encodedDelimiter);

    try {
        if(json?.detailsUrl == 'https://graphql.anilist.co') {
            const result = await getDetailsFromAnilist(json.anilistId);
            return result;
        }

        if(json?.origin == 'AniCrush') {
            const result = await getDetailsFromAniCrush(json.detailsUrl);
            return result;
        }

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
        if(json?.episodesUrl == null) {
            throw new Error('No episodes found');
        }

        if(json?.origin == 'AnimeParadise') {
            return await extractEpisodesFromAnimeParadise(json);
        }

        if(json?.origin == 'AniCrush') {
            return await extractEpisodesFromAniCrush(json);
        }

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
    const delimiter = '|';
    const [url, anilistId] = objString.split(delimiter);

    try {
        if(url == null || anilistId == null) {
            throw new Error('No data returned from Sora in extractStreamUrl');
        }

        if(url.startsWith('https://www.animeparadise.moe')) {
            return await extractStreamUrlFromAnimeParadise(url, anilistId);
        }

        if(url.startsWith('https://api.anicrush.to')) {
            return await extractStreamUrlFromAniCrush(url, anilistId);
        }

        throw new Error('Failed to extract stream URL from: ' + url);

    } catch(error) {
        console.log('[ASURA][extractStreamUrl] Stream URL error: ' + error?.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

/**
 * Extracts and parses the JSON data from the given HTML string from AnimeParadise.moe.
 * 
 * The function searches for the JSON data within the HTML content
 * that is wrapped between the '__NEXT_DATA__' and '</script>' tags,
 * trims the HTML to extract the JSON string, and then parses it into
 * an object.
 * 
 * @param {string} html - The HTML content containing the JSON data.
 * @returns {Object|null} The parsed JSON object if successful, or null if an error occurs during parsing.
 */
function getNextData(html) {
    const trimmedHtml = trimHtml(html, '__NEXT_DATA__', '</script>');
    const jsonString = trimmedHtml.slice(39);

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.log('[ASURA][getNextData] Error parsing NEXT_DATA json');
        return null;
    }
}

/**
 * Trims around the content, leaving only the area between the start and end string
 * @param {string} html The text to trim
 * @param {string} startString The string to start at (inclusive)
 * @param {string} endString The string to end at (exclusive)
 * @returns The trimmed text
 */
function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
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
 * Uses Sora's fetchv2 on ipad, fallbacks to regular fetch on Windows
 *
 * @param {string} url The URL to make the request to.
 * @param {object} [options] The options to use for the request.
 * @param {object} [options.headers] The headers to send with the request.
 * @param {string} [options.method='GET'] The method to use for the request.
 * @param {string} [options.body=null] The body of the request.
 *
 * @returns {Promise<Response|null>} The response from the server, or null if the
 * request failed.
 */
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
 * Searches AnimeParadise for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @param {number[]} [asuraList] A list of Anilist IDs to filter the results by (optional)
 * @returns {Promise<AnimeSearchResult[]>} A promise that resolves with a list of AnimeSearchResults
 */
async function animeParadiseSearch(keyword, asuraList = []) {
    const ANIME_URL = 'https://www.animeparadise.moe/anime/';
    const SEARCH_URL = 'https://api.animeparadise.moe/search?q='
    let shows = [];

    try {
        const response = await soraFetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        for(let entry of json?.data) {
            if(!asuraList.includes(entry.mappings.anilist)) {
                continue;
            }

            // Href value:
            // [url, origin, anilistId, detatilsUrl, episodesUrl]
            shows.push({
                title: '[AP] ' + entry.title,
                image: entry.posterImage.original,
                href: `${ ANIME_URL }${ entry.link }|AnimeParadise|${ entry.mappings.anilist }|https://graphql.anilist.co|https://api.animeparadise.moe/anime/${ entry._id }/episode`
            });
        }

        return shows;
    } catch (error) {
        console.log('[ASURA][animeParadiseSearch] Fetch error: ' + error?.message);
        return [];
    }
}

/**
 * Searches AniCrush for anime with the given keyword and returns matching results.
 * Filters results based on the given list of Anilist IDs.
 * 
 * @param {string} keyword - The keyword to search for in AniCrush.
 * @param {Array<number>} [asuraList=[]] - An optional array of Anilist IDs to filter the results.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of show objects, each containing title, image, and href.
 * If an error occurs during the fetch operation, an empty array is returned.
 */
async function aniCrushSearch(keyword, asuraList = []) {
    const BASE_URL = 'https://anicrush.to';
    const UTILITY_URL = 'https://api.anicrush.to/shared/v2';
    let shows = [];

    try {
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
                title: '[AC] ' + entry.name,
                image: getAniCrushImage(entry.poster_path),
                href: `${ href }|AniCrush|${ entry.anilistId }|https://api.anicrush.to/shared/v2/movie/getById/${ entry.id }|https://api.anicrush.to/shared/v2/episode/list?_movieId=${ entry.id }`
            });
        }

        return shows;

    } catch (error) {
        console.log('[ASURA][aniCrushSearch] Fetch error: ' + error?.message);
        return [];
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

/**
 * Retrieves the details of a show from Anilist given its id.
 * @param {int} anilistId The id of the show to retrieve.
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function getDetailsFromAnilist(anilistId) {
    const BASE_URL = 'https://graphql.anilist.co';
    const query = `query ($id: Int!) {
        Media (id: $id, type: ANIME) {
            id
            title {
                romaji
                english
                native
            }
            description
            startDate {
                year
                month
                day
            }
            endDate {
                year
                month
                day
            }
        }
    }`;

    try {
        const response = await soraFetch(BASE_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: {
                query: query,
                variables: {
                    "id": anilistId
                }
            }
        });
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(json?.data?.Media == null) {
            throw new Error('Error retrieving Anilist data');
        }

        const media = json.data.Media;

        return JSON.stringify([{
            description: json.data?.Media?.description,
            aliases: buildAliasString(media.title.romaji, media.title.english, media.title.native, null),
            airdate: aniListDateBuilder(media.startDate, media.endDate)
        }]);

    } catch(error) {
        console.log('[ASURA][getDetailsFromAnilist] Fetch error: ' + error?.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Retrieves detailed information about an anime from the AniCrush API.
 * @param {string} detailsUrl - The URL to fetch the details from.
 * @returns {Promise<string>} A promise that resolves with a JSON string containing 
 * the anime details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`.
 * If an error occurs during the fetch operation, a default error object is returned in JSON format.
 */
async function getDetailsFromAniCrush(detailsUrl) {
    try {
        const response = await soraFetch(detailsUrl, { headers: GetAniCrushHeaders() });
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
        console.log('[ASURA][getDetailsFromAniCrush] Fetch error: ' + error?.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Extracts episodes from the AnimeParadise API using the provided JSON object.
 * @param {Object} json - An object containing the URL to fetch the episodes from and the Anilist ID of the anime.
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodesFromAnimeParadise(json) {
    const BASE_URL = 'https://www.animeparadise.moe/watch/';

    try {
        const response = await soraFetch(json.episodesUrl);
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data?.data == null) {
            throw new Error('Error retrieving AnimeParadise episodes json');
        }

        const episodes = data?.data.map(ep => {
            return {
                href: `${ BASE_URL }${ ep.uid }?origin=${ ep.origin }|${ json.anilistId }`,
                number: parseInt(ep.number)
            }
        });

        return JSON.stringify(episodes);

    } catch(error) {
        console.log('[ASURA][extractEpisodesFromAnimeParadise] Fetch error: ' + error?.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the episodes from the given url.
 * @param {Object} json - Object containing the url to fetch the episodes from and the Anilist ID of the anime.
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodesFromAniCrush(json) {
    const url = json.episodesUrl;
    const SOURCE_API_URL = 'https://api.anicrush.to/shared/v2';
    const movieId = url.split('=')[1];

    try {
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
        console.log('[ASURA][extractEpisodesFromAniCrush] Fetch error: ' + error?.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @param {number} anilistId - The Anilist ID of the anime.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrlFromAnimeParadise(url, anilistId) {
    try {
        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json');

        const streamUrl = json?.props?.pageProps?.episode?.streamLink;
        const subtitles = GetSubtitles(json.props.pageProps?.animeData?.mappings?.anilist, json.props.pageProps.episode?.number);

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles });

    } catch (error) {
        console.log('[ASURA][extractStreamUrlFromAnimeParadise] Error extracting stream url: ' + error?.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @param {number} anilistId - The Anilist ID of the anime.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrlFromAniCrush(url, anilistId) {
    const SOURCE_BASE_URL = "https://anicrush.to";
    const UTILITY_URL = "https://ac-api.ofchaos.com";

    try {
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

        const hlsUrl = `${ UTILITY_URL }/api/anime/embed/convert?embedUrl=${ encodeURIComponent(source) }&host=${ encodeURIComponent(SOURCE_BASE_URL) }`;
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

    } catch (error) {
        console.log('[ASURA][extractStreamUrlFromAniCrush] Fetch error: ' + error?.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
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

/**
 * Constructs a formatted date range string from the given start and end dates.
 * 
 * @param {Object} startDate - The start date object with `year`, `month`, and `day` properties.
 * @param {Object} endDate - The end date object with `year`, `month`, and `day` properties.
 * @returns {string} A formatted string representing the date range in the format "YYYY-MM-DD - YYYY-MM-DD".
 */
function aniListDateBuilder(startDate, endDate) {
    let startMonth = startDate.month < 10 ? '0' + startDate.month : startDate.month;
    let startDay = startDate.day < 10 ? '0' + startDate.day : startDate.day;
    let endMonth = endDate.month < 10 ? '0' + endDate.month : endDate.month;
    let endDay = endDate.day < 10 ? '0' + endDate.day : endDate.day;


    return `${ startDate.year }-${ startMonth }-${ startDay } - ${ endDate.year }-${ endMonth }-${ endDay }`;
}