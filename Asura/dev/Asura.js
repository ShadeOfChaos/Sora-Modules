// // //***** LOCAL TESTING
(async () => {
    const results = await searchResults('Cowboy Bebop');
    console.log('RESULTS:', results);
    const details = await extractDetails(JSON.parse(results)[1].href);
    console.log('DETAILS:', details);
    const eps = await extractEpisodes(JSON.parse(results)[1].href);
    console.log('EPISODES:', eps);
    const streamUrl = await extractStreamUrl(JSON.parse(eps)[0].href);
    console.log('STREAMURL:', streamUrl);
})();
//***** LOCAL TESTING


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
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    return JSON.stringify([{"title":"Cowboy Bebop: Tengoku no Tobira","image":"https://static.gniyonna.com/media/poster/300x400/100/264adb9a8499b57ced3d5a3a42b4288d.jpg","href":"https://anicrush.to/watch/cowboy-bebop-the-movie.KCEeG4"},{"title":"Cowboy Bebop","image":"https://static.gniyonna.com/media/poster/300x400/100/1cebf74a66cf12613424e36fa935e5ec.jpg","href":"https://anicrush.to/watch/cowboy-bebop.JwEcEt"}]);

    // let p = [];

    // const asuraList = await GetAnimes();

    // const anicrush = aniCrushSearch(keyword, asuraList);
    // const animeparadise = animeParadiseSearch(keyword, asuraList);

    // p.push(anicrush);
    // p.push(animeparadise);

    // return Promise.allSettled(p).then((results) => {
    //     // Merge results
    //     let mergedResults = [];
    //     for (let result of results) {
    //         if (result.status === 'fulfilled') {
    //             mergedResults = mergedResults.concat(result.value);
    //         }
    //     }
        

    //     return JSON.stringify(mergedResults);
    // });
    // const result = await multiSearch(keyword);
    // console.log('[ASURA][searchResults] SEARCH RESULTS:' + result);
    // return result;
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(json) {
    console.log('[ASURA][extractDetails] RUNNING EXTRACT DETAILS');

    return JSON.stringify([{
        description: 'Description: DEBUGGING',
        aliases: 'Aliases: DEBUGGING',
        airdate: 'Aired: DEBUGGING'
    }]);
    /*
    try {
        if(json == null || json == '') {
            console.log("0. extractDetails: " + parsedJson.anilistId);
            throw('No data returned from Sora');
        }

        const parsedJson = JSON.parse(json);

        if(parsedJson?.detailsUrl == 'https://graphql.anilist.co') {
            console.log("1. anilistId: " + parsedJson.anilistId);
            const result = await getDetailsFromAnilist(parsedJson.anilistId);
            console.log("2. result: " + result);
            return result;
        }

        if(parsedJson?.origin == 'AniCrush') {
            console.log("3. Anicrush url: " + parsedJson.detailsUrl);
            const result = await getDetailsFromAniCrush(parsedJson.detailsUrl);
            console.log("4. result: " + result);
            return result;
        }

    } catch (error) {
        console.log('[ASURA][ExtractDetails] Error');
        console.log('[ASURA][ExtractDetails] Details error: ' + error?.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
    */
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(json) {
    console.log('[ASURA][extractEpisodes] RUNNING EXTRACT EPISODES');
    return JSON.stringify([{"href": "TEST", number: 1}]);
    /*
    try {
        if(json == null || json == '') {
            console.log("5. No data returned from Sora: " + json);
            throw('No data returned from Sora');
        }

        const parsedJson = JSON.parse(json);

        if(parsedJson?.episodesUrl == null) {
            console.log("6. No episodes found json: " + json);
            throw('No episodes found');
        }

        console.log("[ASURA] ====================================== [ASURA]");
        console.log("[ASURA] DEBUG JSON: " + json);
        console.log("[ASURA] DEBUG PARSEDJSON ORIGIN: " + parsedJson?.origin);
        console.log("[ASURA] ====================================== [ASURA]");

        if(parsedJson?.origin == 'AnimeParadise') {
            console.log("7. AnimeParadise json: " + json);
            const result = await extractEpisodesFromAnimeParadise(parsedJson);
            console.log("8. AnimeParadise result: " + result);
            return result;
        }

        if(parsedJson?.origin == 'AniCrush') {
            console.log("9. AniCrush json: " + json);
            const result = await extractEpisodesFromAniCrush(parsedJson);
            console.log("10. AniCrush result: " + result);
            return result;
        }

    } catch(error) {
        console.log('[ASURA][extractEpisodes] Error');
        console.log('[ASURA][extractEpisodes] Episodes error: ' + error?.message);
        return JSON.stringify([]);
    }
    */
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(json) {
    return JSON.stringify({ stream: null, subtitles: null });
    /*
    try {
        if(json == null || json == '') {
            throw('No data returned from Sora in extractStreamUrl');
        }
        
        const parsedJson = JSON.parse(json);
        const url = parsedJson?.url;

        if(url.startsWith('https://www.animeparadise.moe')) {
            return await extractStreamUrlFromAnimeParadise(parsedJson);
        }

        if(url.startsWith('https://api.anicrush.to')) {
            return await extractStreamUrlFromAniCrush(parsedJson);
        }

        throw('Failed to extract stream URL from: ' + url);

    } catch(error) {
        console.log('[ASURA][extractStreamUrl] Stream URL error: ' + error?.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
    */
}

// function getNextData(html) {
//     const trimmedHtml = trimHtml(html, '__NEXT_DATA__', '</script>');
//     const jsonString = trimmedHtml.slice(39);

//     try {
//         return JSON.parse(jsonString);
//     } catch (e) {
//         console.log('[ASURA][getNextData] Error parsing NEXT_DATA json');
//         return null;
//     }
// }

// Trims around the content, leaving only the area between the start and end string
// function trimHtml(html, startString, endString) {
//     const startIndex = html.indexOf(startString);
//     const endIndex = html.indexOf(endString, startIndex);
//     return html.substring(startIndex, endIndex);
// }

async function GetAnimes() {
    const baseUrl = 'https://asura.ofchaos.com/api/anime';
    const referer = 'SoraApp';
    try {
        const response = await soraFetch(baseUrl, { headers: { 'Referer': referer } });
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(json == null)                 throw('Error parsing Asura json');
        if(json?.success !== true)       throw(json?.error);
        if(json?.result?.length == null) throw('Error obtaining data from Asura API');

        return json?.result;

    } catch(error) {
        console.log('[ASURA][GetAnimes] Error: ' + error?.message);
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

        if(json == null)                 throw('Error parsing Asura json');
        if(json?.success !== true)       throw(json?.error);
        if(json?.result?.length == null) throw('Error obtaining data from Asura API');

        return json?.result;

    } catch(error) {
        console.log('[ASURA][GetEpisodes] Error: ' + error?.message);
        return [];
    }
}

// function GetSubtitles(anilistId, episodeNr) {
//     if(
//         anilistId == null ||
//         isNaN(parseInt(anilistId)) ||
//         episodeNr == null ||
//         isNaN(parseInt(episodeNr))
//     ) {
//         return null;
//     }

//     const baseUrl = 'https://asura.ofchaos.com/api/anime';

//     return `${ baseUrl }/${ anilistId }/${ episodeNr }`;
// }

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

// TODO - Remove this function when the multiSearch is working
// async function multiSearch(keyword) {
//     let p = [];

//     const asuraList = await GetAnimes();

//     const anicrush = aniCrushSearch(keyword, asuraList);
//     const animeparadise = animeParadiseSearch(keyword, asuraList);

//     p.push(anicrush);
//     p.push(animeparadise);

//     return Promise.allSettled(p).then((results) => {
//         // Merge results
//         let mergedResults = [];
//         for (let result of results) {
//             if (result.status === 'fulfilled') {
//                 mergedResults = mergedResults.concat(result.value);
//             }
//         }

//         // return JSON.stringify(mergedResults);
//         return JSON.stringify(result.value); // Return the first result for testing purposes
//     });
// }

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

            shows.push({
                // title: 'AnimeParadise: ' + entry.title,
                title: entry.title,
                image: entry.posterImage.original,
                href: JSON.stringify({
                    url: ANIME_URL + entry.link,
                    origin: 'AnimeParadise',
                    anilistId: entry.mappings.anilist,
                    detailsUrl: `https://graphql.anilist.co`,
                    episodesUrl: `https://api.animeparadise.moe/anime/${ entry._id }/episode`
                })
            });
        }

        return shows;
    } catch (error) {
        console.log('[ASURA][animeParadiseSearch] Fetch error: ' + error?.message);
        return [];
    }
}

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
            throw('No results found');
        }

        const moviesData = await getAniCrushAnilistId(data.result.movies);
        
        for(let entry of moviesData) {
            if(!asuraList.includes(entry.anilistId)) {
                continue;
            }

            const href = `${ BASE_URL }/watch/${ entry.slug }.${ entry.id }`;

            shows.push({
                // title: 'AniCrush: ' + entry.name,
                title: entry.name,
                image: getAniCrushImage(entry.poster_path),
                href: JSON.stringify({
                    url: href,
                    origin: 'AniCrush',
                    anilistId: entry.anilistId,
                    detailsUrl: `https://api.anicrush.to/shared/v2/movie/getById/${ entry.id }`,
                    episodesUrl: `https://api.anicrush.to/shared/v2/episode/list?_movieId=${ entry.id }`
                })
            });
        }

        return shows;

    } catch (error) {
        console.log('[ASURA][aniCrushSearch] Fetch error: ' + error?.message);
        return [];
    }
}

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

// async function getDetailsFromAnilist(anilistId) {
//     const BASE_URL = 'https://graphql.anilist.co';
//     const query = `
//     query ($id: Int!) {
//         Media (id: $id, type: ANIME) {
//             id
//             title {
//                 romaji
//                 english
//                 native
//             }
//             description
//             startDate {
//                 year
//                 month
//                 day
//             }
//             endDate {
//                 year
//                 month
//                 day
//             }
//         }
//     }`;

//     try {
//         const response = await soraFetch(BASE_URL, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Accept': 'application/json'
//             },
//             body: JSON.stringify({
//                 query: query,
//                 variables: {
//                     id: anilistId
//                 }
//             })
//         });
//         const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

//         if(json?.data?.Media == null) {
//             throw('Error retrieving Anilist data');
//         }

//         const media = json.data.Media;

//         return JSON.stringify([{
//             description: json.data?.Media?.description,
//             aliases: buildAliasString(media.title.romaji, media.title.english, media.title.native, null),
//             airdate: aniListDateBuilder(media.startDate, media.endDate)
//         }]);

//     } catch(error) {
//         console.log('[ASURA][getDetailsFromAnilist] Fetch error: ' + error?.message);
//         return JSON.stringify([{
//             description: 'Error loading description',
//             aliases: 'Duration: Unknown',
//             airdate: 'Aired: Unknown'
//         }]);
//     }
// }

// async function getDetailsFromAniCrush(detailsUrl) {
//     try {
//         const response = await soraFetch(detailsUrl, { headers: GetAniCrushHeaders() });
//         const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

//         if(data?.status == false || data?.result == null) {
//             throw('Error obtaining details from AniCrush API');
//         }

//         return JSON.stringify([{
//             description: data.result.overview,
//             aliases: buildAliasString(data.result?.name, data.result?.name_english, data.result?.name_japanese, data.result?.name_synonyms),
//             airdate: data.result?.aired_from + ' - ' + data.result?.aired_to
//         }]);

//     } catch (error) {
//         console.log('[ASURA][getDetailsFromAniCrush] Fetch error: ' + error?.message);
//         return JSON.stringify([{
//             description: 'Error loading description',
//             aliases: 'Duration: Unknown',
//             airdate: 'Aired: Unknown'
//         }]);
//     }
// }

// async function extractEpisodesFromAnimeParadise(json) {
//     const BASE_URL = 'https://www.animeparadise.moe/watch/';

//     try {
//         const response = await soraFetch(json.episodesUrl);
//         const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

//         if(data?.data == null) {
//             throw('Error retrieving AnimeParadise episodes json');
//         }

//         const episodes = data?.data.map(ep => {
//             return {
//                 href: /*JSON.stringify({
//                     url: */`${ BASE_URL }${ ep.uid }?origin=${ ep.origin }`,
//                     /*anilistId: data.anilistId
//                 }),*/
//                 number: parseInt(ep.number)
//             }
//         });

//         return JSON.stringify(episodes);

//     } catch(error) {
//         console.log('[ASURA][extractEpisodesFromAnimeParadise] Fetch error: ' + error?.message);
//         return JSON.stringify([]);
//     }
// }

// async function extractEpisodesFromAniCrush(json) {
//     const url = json.episodesUrl;
//     const SOURCE_API_URL = 'https://api.anicrush.to/shared/v2';
//     const movieId = url.split('=')[1];

//     try {
//         const serverId = 4;
//         const format = 'sub';
//         var episodes = [];

//         const response = await soraFetch(url, { headers: GetAniCrushHeaders() });
//         const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

//         if(data?.status == false || data?.result == null) {
//             throw('No results found');
//         }

//         for(let episodeList in data.result) {
//             for(let episode of data.result[episodeList]) {
//                 episodes.push({
//                     href: /*JSON.stringify({
//                         url: */`${ SOURCE_API_URL }/episode/sources?_movieId=${ movieId }&ep=${ episode.number }&sv=${ serverId }&sc=${ format }`,
//                         /*anilistId: json.anilistId
//                     }),*/
//                     number: parseInt(episode.number)
//                 });
//             }
//         }

//         return JSON.stringify(episodes);

//     } catch(error) {
//         console.log('[ASURA][extractEpisodesFromAniCrush] Fetch error: ' + error?.message);
//         return JSON.stringify([]);
//     }
// }

// async function extractStreamUrlFromAnimeParadise(streamData) {
//     try {
//         const response = await soraFetch(streamData.url);
//         const html = typeof response === 'object' ? await response.text() : await response;

//         const json = getNextData(html);
//         if (json == null) throw ('Error parsing NEXT_DATA json');

//         const streamUrl = json?.props?.pageProps?.episode?.streamLink;
//         const subtitles = GetSubtitles(json.props.pageProps?.animeData?.mappings?.anilist, json.props.pageProps.episode?.number);

//         return JSON.stringify({ stream: streamUrl, subtitles: subtitles });

//     } catch (error) {
//         console.log('[ASURA][extractStreamUrlFromAnimeParadise] Error extracting stream url: ' + error?.message);
//         return JSON.stringify({ stream: null, subtitles: null });
//     }
// }

// async function extractStreamUrlFromAniCrush(streamData) {
//     const url = streamData.url;
//     const SOURCE_BASE_URL = "https://anicrush.to";
//     const UTILITY_URL = "https://ac-api.ofchaos.com";

//     try {
//         const epIndex = url.indexOf('ep=') + 3;
//         const ep = url.substring(epIndex, url.indexOf('&', epIndex));

//         const sourceResponse = await soraFetch(url, { headers: GetAniCrushHeaders() });
//         const sourceData = typeof sourceResponse === 'object' ? await sourceResponse.json() : await JSON.parse(sourceResponse);

//         if(
//             sourceData.status == false || 
//             sourceData.result == null || 
//             sourceData.result.link == "" ||
//             sourceData.result.link == null
//         ) {
//             throw('No source found');
//         }

//         const source = sourceData.result.link;

//         const hlsUrl = `${ UTILITY_URL }/api/anime/embed/convert?embedUrl=${ encodeURIComponent(source) }&host=${ encodeURIComponent(SOURCE_BASE_URL) }`;
//         const hlsResponse = await soraFetch(hlsUrl);
//         const hlsData = typeof hlsResponse === 'object' ? await hlsResponse.json() : await JSON.parse(hlsResponse);

//         if(hlsData?.status == false || hlsData?.result == null || hlsData?.error != null) {
//             throw('No stream found');
//         }

//         if(hlsData.result?.sources?.length <= 0) {
//             throw('No source found');
//         }

//         let streamSource = null;
//         let mp4Source = null;

//         for(let source of hlsData.result.sources) {
//             if(source.type === 'hls') {
//                 streamSource = source;
//                 break;
//             }
//             if(source.type === 'mp4') {
//                 mp4Source = source;
//             }
//         }

//         if(streamSource == null) {
//             if(mp4Source == null) {
//                 throw('No valid stream found');
//             }
//             streamSource = mp4Source;
//         }

//         const streamUrl = streamSource?.file;
//         const subtitles = GetSubtitles(streamData.anilistId, ep);

//         return JSON.stringify({ stream: streamUrl, subtitles: subtitles });

//     } catch (error) {
//         console.log('[ASURA][extractStreamUrlFromAniCrush] Fetch error: ' + error?.message);
//         return JSON.stringify({ stream: null, subtitles: null });
//     }
// }

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

// function buildAliasString(romajiTitle, englishTitle, japaneseTitle, synonyms) {
//     let string = '';

//     if (romajiTitle) {
//         string += romajiTitle;
//     }

//     if (englishTitle) {
        
//         if (string != '') string += ', ';
//         string += englishTitle;
//     }

//     if (japaneseTitle) {
//         if (string != '') string += ', ';
//         string += japaneseTitle;
//     }

//     if (synonyms) {
//         if (string != '') string += ', ';
//         string += synonyms;
//     }

//     return string;
// }

// function aniListDateBuilder(startDate, endDate) {
//     let startMonth = startDate.month < 10 ? '0' + startDate.month : startDate.month;
//     let startDay = startDate.day < 10 ? '0' + startDate.day : startDate.day;
//     let endMonth = endDate.month < 10 ? '0' + endDate.month : endDate.month;
//     let endDay = endDate.day < 10 ? '0' + endDate.day : endDate.day;


//     return `${ startDate.year }-${ startMonth }-${ startDay } - ${ endDate.year }-${ endMonth }-${ endDay }`;
// }