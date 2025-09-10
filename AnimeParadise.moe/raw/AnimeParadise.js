async function areRequiredServersUp() {
    const requiredHosts = ['https://www.animeparadise.moe'];

    try {
        let promises = [];

        for (let host of requiredHosts) {
            promises.push(
                new Promise(async (resolve) => {
                    let response = await soraFetch(host, { method: 'HEAD' });
                    response.host = host;
                    return resolve(response);
                })
            );
        }

        return Promise.allSettled(promises).then((responses) => {
            for (let response of responses) {
                if (response.status === 'rejected' || response.value?.status != 200) {
                    let message = 'Required source ' + response.value?.host + ' is currently down.';
                    console.log(message);
                    return { success: false, error: encodeURIComponent(message), searchTitle: `Error cannot access ${response.value?.host}, server down. Please try again later.` };
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
    var shows = [];
    const serversUp = await areRequiredServersUp();

    if (serversUp.success === false) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
            href: '#' + serversUp.error,
        }]);
    }

    const searchUrl = `${SEARCH_URL}${encodeURI(keyword)}`;

    try {
        const results = await getSearchResultsViaExtraction(searchUrl, keyword);
        for (let result of results) {
            const transferData = JSON.stringify({
                episodeSlugs: result?.ep,
                origin: result?._id,
                anilistId: result?.mappings?.anilist
            });

            shows.push({
                title: result?.title,
                image: result?.posterImage?.large ?? result?.posterImage?.medium ?? result?.posterImage?.small ?? result?.posterImage?.original,
                href: BASE_URL + '/anime/' + result?.link + '|' + transferData
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
async function extractDetails(objString) {
    const encodedDelimiter = '|';
    const [url, jsonString] = decodeURIComponent(objString).split(encodedDelimiter);
    const jsonData = JSON.parse(jsonString || '{}');
    
    if (url.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }
    
    try {
        var anilistResult = await Anilist.lookup({ 'id': jsonData.anilistId });
    } catch(e) {
        console.log('Error in details getting anilist data: ' + e.message);
    }

    const data = anilistResult?.Page?.media?.[0];

    if (data == null) {
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }

    return JSON.stringify([{
        description: data?.description,
        aliases: data?.title?.english,
        airdate: Anilist.convertAnilistDateToDateStr(data?.startDate)
    }]);
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(objString) {
    const encodedDelimiter = '|';
    const [url, jsonString] = decodeURIComponent(objString).split(encodedDelimiter);
    const jsonData = JSON.parse(jsonString || '{}');

    try {
        if (url.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

        var episodes = [];

        const streamsJson = await getStreamsViaExtraction(jsonData.episodeSlugs[0], jsonData.origin);
        if (streamsJson == null) return null;

        for (let stream of streamsJson.episodeList) {
            const transferStream = JSON.stringify({
                stream: stream.streamLink ?? stream?.streamLinkBackup,
                subtitles: stream?.subData
            });

            episodes.push({
                href: transferStream,
                number: parseInt(stream.number)
            });
        }

        return JSON.stringify(episodes);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} objString - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(objString) {
    try {
        const data = JSON.parse(objString);
        return data.stream;

    } catch(e) {
        console.log('Failed to parse streams json.');
        return null;
    }
}

async function getSearchResultsViaExtraction(url, keyword) {
    const baseUrl = 'https://www.animeparadise.moe';

    const searchPageResponse = await soraFetch(url, { method: 'POST' });
    const searchPageHtml = await searchPageResponse.text();

    const fuckYoSearchPageRegex = /src="(\/_next\/static\/chunks\/app\/search\/page-[^"]*.js)"/;
    const searchPageSrc = searchPageHtml.match(fuckYoSearchPageRegex)?.[1];
    if (searchPageSrc == null) return null;

    const searchJsResponse = await soraFetch(`${baseUrl}${searchPageSrc}`);
    const searchJs = await searchJsResponse.text();

    const fuckYoNextActionBsRegex = /createServerReference\)\("([^"]*)"[^"]*"searchAnime"/;
    const nextAction = searchJs.match(fuckYoNextActionBsRegex)?.[1];
    if (nextAction == null) return null;

    const response = await soraFetch(url, {
        method: 'POST',
        headers: {
            "Accept": "text/x-component",
            "Content-Type": "application/json",
            "Next-Action": nextAction,
            "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22search%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D"
        },
        body: JSON.stringify([keyword, { "genres": [], "year": null, "season": null, "page": 1 }])
    });
    const text = await response.text();
    const jsonString = text.slice(text.indexOf('1:{') + 2);
    const json = JSON.parse(jsonString);

    if (json?.error == true) {
        console.error('Error in search', json);
        return null;
    }

    return json?.data?.searchData;
}

async function getStreamsViaExtraction(episodeId, origin) {
    const baseUrl = 'https://www.animeparadise.moe';
    const url = `${baseUrl}/watch/${episodeId}?origin=${origin}`;

    const watchPageResponse = await soraFetch(url, { method: 'POST' });
    const watchPageHtml = await watchPageResponse.text();

    const fuckYoWatchPageRegex = /src="(\/_next\/static\/chunks\/app\/watch\/%5Bid%5D\/page-[^"]*.js)"/;
    let watchPageSrc = watchPageHtml.match(fuckYoWatchPageRegex)?.[1];
    if (watchPageSrc == null) return null;
    // I don't even need this, why is the placeholder's only acceptable value the placeholder urlencoded, wtf am I looking at?
    // watchPageSrc = watchPageSrc.replace('%5Bid%5D', episodeId);

    const watchJsResponse = await soraFetch(`${baseUrl}${watchPageSrc}`);
    const watchJs = await watchJsResponse.text();

    const fuckYoNextActionBsRegex = /createServerReference\)\("([^"]*)"[^"]*"getEpisode"/;
    const nextAction = watchJs.match(fuckYoNextActionBsRegex)?.[1];
    if (nextAction == null) return null;

    const response = await soraFetch(url, {
        method: 'POST',
        headers: {
            "Accept": "text/x-component",
            "Content-Type": "application/json",
            "Next-Action": nextAction,
            "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22watch%22%2C%7B%22children%22%3A%5B%5B%22id%22%2C%228bf78dcf-e00b-433d-b17a-6d087f8d4bff%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D"
        },
        body: JSON.stringify([episodeId, origin])
    });
    const text = await response.text();

    const jsonString = text.slice(text.indexOf('1:{') + 2);
    const json = JSON.parse(jsonString);

    if (json?.error == true) {
        console.error('Error in search', json);
        return null;
    }

    return json;
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}

// Anilist (not really) singleton
class Anilist {
    static async search(keyword, filters = {}) {
        const query = `query (
                $search: String,
                $page: Int,
                $perPage: Int,
                $sort: [MediaSort],
                $genre_in: [String],
                $tag_in: [String],
                $type: MediaType,
                $format: MediaFormat,
                $status: MediaStatus,
                $countryOfOrigin: CountryCode,
                $isAdult: Boolean,
                $season: MediaSeason,
                $startDate_like: String,
                $source: MediaSource,
                $averageScore_greater: Int,
                $averageScore_lesser: Int
            ) {
                Page(page: $page, perPage: $perPage) {
                media(
                    search: $search,
                    type: $type,
                    sort: $sort,
                    genre_in: $genre_in,
                    tag_in: $tag_in,
                    format: $format,
                    status: $status,
                    countryOfOrigin: $countryOfOrigin,
                    isAdult: $isAdult,
                    season: $season,
                    startDate_like: $startDate_like,
                    source: $source,
                    averageScore_greater: $averageScore_greater,
                    averageScore_lesser: $averageScore_lesser
                ) {
                    id
                    idMal
                    averageScore
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    nextAiringEpisode {
                        airingAt
                        timeUntilAiring
                        episode
                    }
                    status
                    genres
                    format
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
                    popularity
                    coverImage {
                        color
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "page": 1,
            "perPage": 50,
            "sort": [
                "SEARCH_MATCH",
                "TITLE_ENGLISH_DESC",
                "TITLE_ROMAJI_DESC"
            ],
            "search": keyword,
            "type": "ANIME",
            ...filters
        }

        // console.log(filters, variables);

        return Anilist.anilistFetch(query, variables);
    }

    static async lookup(filters) {
        const query = `query (
                $id: Int,
                $idMal: Int
            ) {
                Page(page: 1, perPage: 1) {
                media(
                    id: $id,
                    idMal: $idMal
                ) {
                    id
                    idMal
                    averageScore
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    nextAiringEpisode {
                        airingAt
                        timeUntilAiring
                        episode
                    }
                    status
                    genres
                    format
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
                    popularity
                    coverImage {
                        color
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "type": "ANIME",
            ...filters
        }

        return Anilist.anilistFetch(query, variables);
    }

    static async getLatest() {

    }

    static async anilistFetch(query, variables) {
        const url = 'https://graphql.anilist.co/';
        const extraTimeoutMs = 250;

        try {
            const response = await soraFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (response.status !== 200) {
                if (response.status === 429) {
                    console.info('=== RATE LIMIT EXCEEDED, SLEEPING AND RETRYING ===');
                    const retryTimeout = response.headers.get('Retry-After');
                    const timeout = Math.ceil((parseInt(retryTimeout))) * 1000 + extraTimeoutMs;
                    await sleep(timeout);
                    return await AnilistFetch(query, variables);

                }

                console.error('Error fetching Anilist data:', response.statusText);
                return null;
            }

            const json = await response.json();
            if (json?.errors) {
                console.error('Error fetching Anilist data:', json.errors);
            }

            return json?.data;

        } catch (error) {
            console.error('Error fetching Anilist data:', error);
            return null;
        }
    }

    static convertAnilistDateToDateStr(dateObject) {
        if (dateObject.year == null) {
            return null;
        }
        if (dateObject.month == null || parseInt(dateObject.month) < 1) {
            dateObject.month = 1;
        }
        if (dateObject.day == null || parseInt(dateObject.day) < 1) {
            dateObject.day = 1;
        }
        return dateObject.year + "-" + (dateObject.month).toString().padStart(2, '0') + "-" + (dateObject.day).toString().padStart(2, '0');
    }


    // Yes it's stupid, but I kinda love it which is why I'm not optimizing this
    static nextAnilistAirDateToCountdown(timestamp) {
        if (timestamp == null) return null;

        const airDate = new Date((timestamp * 1000));
        const now = new Date();

        if (now > airDate) return null;

        let [days, hourRemainder] = (((airDate - now) / 1000) / 60 / 60 / 24).toString().split('.');
        let [hours, minRemainder] = (parseFloat("0." + hourRemainder) * 24).toString().split('.');
        let minutes = Math.ceil((parseFloat("0." + minRemainder) * 60));

        return `Next episode will air in ${days} days, ${hours} hours and ${minutes} minutes at ${airDate.getFullYear()}-${(airDate.getMonth() + 1).toString().padStart(2, '0')}-${(airDate.getDate()).toString().padStart(2, '0')} ${airDate.getHours()}:${airDate.getMinutes()}`;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}