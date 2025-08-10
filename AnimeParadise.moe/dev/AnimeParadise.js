//***** LOCAL TESTING
// (async () => {
// const results = await searchResults('One Piece');
// // console.log('RESULTS: ', results);
// const details = await extractDetails(JSON.parse(results)[0].href);
// // console.log('DETAILS: ', details);
// const episodesa = await extractEpisodes(JSON.parse(results)[0].href);
// // console.log('EPISODES: ', episodesa);
// const streamUrl = await extractStreamUrl(JSON.parse(episodesa)[0].href);
// console.log('STREAMURL: ', streamUrl);
// })();
//***** LOCAL TESTING

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

    const searchUrl = `${SEARCH_URL}${encodeURI(keyword)}`;

    try {
        const response = await soraFetch(searchUrl);
        const html = typeof response === 'object' ? await response.text() : await response;

        const matches = html.matchAll(REGEX);
        if(matches?.length != null) {
            for (let match of matches) {
                shows.push({
                    title: match[3],
                    image: match[2],
                    href: BASE_URL + match[1]
                });
            }

        } else {
            const results = await getSearchResultsViaExtraction(searchUrl, keyword);
            for (let result of results) {
                console.log(result);

                const transferData = JSON.stringify({
                    episodeSlugs: result?.ep,
                    origin: result?._id,
                    anilistId: result?.mappings?.anilist
                });

                shows.push({
                    title: result?.title,
                    image: result?.posterImage?.large ?? result?.posterImage?.medium ?? result?.posterImage?.small ?? result?.posterImage?.original,
                    href: '+' + BASE_URL + '/anime/' + result?.link + '|' + transferData
                });
            }
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
    if(url.startsWith('+')) {
        const transferData = url.split('|')[1];
        const jsonData = JSON.parse(transferData);

        const anilistResult = await Anilist.lookup({'id': jsonData.anilistId});
        const data = anilistResult?.Page?.media?.[0];

        if(data == null) {
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
    if(url.startsWith('+')) {
        var transferData = url.split('|')[1];
        var jsonData = JSON.parse(transferData);
        var url = url.split('|')[0].slice(1);
    }

    try {
        if(url.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;
        var episodes = [];

        const json = getNextData(html);
        if(json != null) {
            url = url.split('|')[0].slice(1);

            const origin = json?.props?.pageProps?.data?._id;

            const episodesList = json?.props?.pageProps?.data?.ep;
            if(episodesList == null) throw new Error('Error obtaining episodes');

            for(let i=0,len=episodesList.length; i<len; i++) {
                let url = `${ BASE_URL }${ episodesList[i] }?origin=${ origin }`;

                episodes.push({
                    href: url,
                    number: i+1
                })
            }
        } else {
            const streamsJson = await getStreamsViaExtraction(jsonData.episodeSlugs[0], jsonData.origin);
            if(streamsJson == null) return null;

            for(let stream of streamsJson.episodeList) {
                const transferStream = JSON.stringify({
                    stream: stream.streamLink ?? stream?.streamLinkBackup,
                    subtitles: stream?.subData
                });

                episodes.push({
                    href: transferStream,
                    number: stream.number
                });
            }
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
    const baseUrl = 'https://www.animeparadise.moe';

    if(url.startsWith('{')) {
        const data = JSON.parse(url);
        return JSON.stringify({ stream: data.stream, subtitles: data.subtitles.find(sub => sub.type === 'vtt' && sub.label === 'English') });
    }

    try {
        const response = await soraFetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json != null)  {

            const streamUrl = json?.props?.pageProps?.episode?.streamLink;
            const subtitles = json?.props?.pageProps?.episode?.subData.find(sub => sub.type === 'vtt' && sub.label === 'English');

            return JSON.stringify({ stream: streamUrl, subtitles: subtitles?.src });

        } else {
            url = `${ baseUrl }/watch/${ episodeId }?origin=${ origin }`;
        }

    } catch (e) {
        console.log('Error extracting stream: ' + e.message);
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

 async function getSearchResultsViaExtraction(url, keyword) {
    const baseUrl = 'https://www.animeparadise.moe';

    const searchPageResponse = await fetch(url, { method: 'POST' });
    const searchPageHtml = await searchPageResponse.text();

    const fuckYoSearchPageRegex = /src="(\/_next\/static\/chunks\/app\/search\/page-[^"]*.js)"/;
    const searchPageSrc = searchPageHtml.match(fuckYoSearchPageRegex)?.[1];
    if(searchPageSrc == null) return null;

    const searchJsResponse = await fetch(`${ baseUrl }${ searchPageSrc }`);
    const searchJs = await searchJsResponse.text();

    const fuckYoNextActionBsRegex = /createServerReference\)\("([^"]*)"[^"]*"searchAnime"/;
    const nextAction = searchJs.match(fuckYoNextActionBsRegex)?.[1];
    if(nextAction == null) return null;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "Accept": "text/x-component",
            "Content-Type": "application/json",
            "Next-Action": nextAction,
            "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22search%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D"
        },
        body: JSON.stringify([keyword,{"genres":[],"year":null,"season":null,"page":1}])
    });
    const text = await response.text();
    const jsonString = text.slice(text.indexOf('1:{') + 2);
    const json = JSON.parse(jsonString);
    
    if(json?.error == true) {
        console.error('Error in search', json);
        return null;
    }

    return json?.data?.searchData;
}

async function getStreamsViaExtraction(episodeId, origin) {
    const baseUrl = 'https://www.animeparadise.moe';
    const url = `${ baseUrl }/watch/${ episodeId }?origin=${ origin }`;

    const watchPageResponse = await fetch(url, { method: 'POST' });
    const watchPageHtml = await watchPageResponse.text();

    const fuckYoWatchPageRegex = /src="(\/_next\/static\/chunks\/app\/watch\/%5Bid%5D\/page-[^"]*.js)"/;                                     
    let watchPageSrc = watchPageHtml.match(fuckYoWatchPageRegex)?.[1];
    if(watchPageSrc == null) return null;
    // I don't even need this, why is the placeholder's only acceptable value the placeholder urlencoded, wtf am I looking at?
    // watchPageSrc = watchPageSrc.replace('%5Bid%5D', episodeId);

    const watchJsResponse = await fetch(`${ baseUrl }${ watchPageSrc }`);
    const watchJs = await watchJsResponse.text();
    
    const fuckYoNextActionBsRegex = /createServerReference\)\("([^"]*)"[^"]*"getEpisode"/;
    const nextAction = watchJs.match(fuckYoNextActionBsRegex)?.[1];
    if(nextAction == null) return null;

    const response = await fetch(url, {
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
    
    if(json?.error == true) {
        console.error('Error in search', json);
        return null;
    }

    return json;
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