const BASE_URLS = ['https://miruro.tv', 'https://miruro.to', 'https://miruro.online'];
const SEARCH_URL = '---/api/search/browse?search=|||&page=1&perPage=100&type=ANIME&sort=SEARCH_MATCH';

// ***** LOCAL TESTING
(async() => {
    // const results = await searchResults('Solo leveling');
    // const results = await searchResults('Mizu zokusei no mahou tsukai'); // AnimeKai ongoing test
    // const results = await searchResults('Sentai Daishikkaku 2'); // Animekai finished test
    const results = await searchResults('My hero aca'); // Animekai finished test
    // console.log('SEARCH RESULTS: ', results);
    const details = await extractDetails(JSON.parse(results)[0].href); // First search result
    // console.log('DETAILS: ', details);
    // console.log(JSON.parse(results));
    const episodes = await extractEpisodes(JSON.parse(results)[0].href); // First search result
    // console.log('EPISODES: ', episodes);
    // const streamUrl = await extractStreamUrl(JSON.parse(episodes)[0].href); // Episode 1
    const streamUrl = await extractStreamUrl(JSON.parse(episodes)[1].href); // Sentai episode 12
    console.log('STREAMURL: ', streamUrl);
})();
//***** LOCAL TESTING


async function areRequiredServersUp() {
    const anyOfRequired = BASE_URLS;

    try {
        let promises = [];

        for(let host of anyOfRequired) {
            promises.push(
                new Promise(async (resolve) => {
                    let response = await soraFetch(host, { method: 'HEAD' });
                    response.host = host;
                    return resolve(response);
                })
            );
        }

        return Promise.allSettled(promises).then((responses) => {
            let serversUp = [];

            for(let response of responses) {
                if(response?.status === 'fulfilled' && response?.value?.status === 200) {
                    serversUp.push(response.value.host);
                }
            }

            if(serversUp.length <= 0) {
                let message = 'Required source ' + response.value?.host + ' is currently down.';
                console.log(message);
                return { success: false, error: encodeURIComponent(message), searchTitle: `Error cannot access any Miruro server, server down. Please try again later.` };
            }

            return { success: true, error: null, searchTitle: null, availableHosts: serversUp };

        })

    } catch (error) {
        console.log('Server up check error: ' + error.message);
        return { success: false, error: encodeURIComponent('#Failed to access required servers'), searchTitle: 'Error cannot access any Miruro server, server down. Please try again later.' };
    }
}


async function searchResults(keyword) {
    console.log('Running Miruro v0.9.4+');
    const serversUp = await areRequiredServersUp();

    if(serversUp.success === false) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
            href: '#' + serversUp.error,
        }]);
    }

    const hostUrl = serversUp.availableHosts[0];

    try {
        const response = await soraFetch(SEARCH_URL.replace('---', hostUrl).replace('|||', encodeURIComponent(keyword)));
        const json = typeof response === 'object' ? await response.json() : JSON.parse(response);

        if(!json || json.length === 0) {
            throw new Error('No results found');
        }

        const results = json.map(item => {
            let ongoing = 0;
            let episodeCount = item.episodes;
            
            if(item.nextAiringEpisode != null) {
                ongoing = 1;

                if(episodeCount == null) {
                    let nextEpisode = item?.nextAiringEpisode?.episode;
                    if(nextEpisode != null) {
                        episodeCount = parseInt(nextEpisode) - 1;
                    }
                }
            }

            let itemDateString = getDateStringFromSearchResult(item);
            let image = item.coverImage?.extraLarge ?? item.coverImage?.large ?? item.coverImage?.medium ?? item.bannerImage ?? item.coverImage?.small;

            console.log(item.title);

            return {
                title: item.title.english,
                image: image,
                href: `${ hostUrl }/watch?id=${ item.id }|${ item.id }|${ item.idMal }|${ item.description }|${ item.title.english }, ${ item.title.native }|${ itemDateString }|${ episodeCount }|${ ongoing }|${ hostUrl }`
            };
        });

        return JSON.stringify(results);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}


async function extractDetails(objString) {
    const encodedDelimiter = '|';
    let json = {};
    [json.url, json.id, json.malId, json.description, json.aliases, json.airdate, json.episodeCount, json.ongoing, json.host] = decodeURIComponent(objString).split(encodedDelimiter);

    if(objString.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }

    return JSON.stringify([{
        description: json.description ?? '',
        aliases: json.aliases ?? '',
        airdate: json.airdate ?? 'Airdates unknown'
    }]);
}


async function extractEpisodes(objString) {
    const encodedDelimiter = '|';
    let json = {};
    [json.url, json.id, json.malId, json.description, json.aliases, json.airdate, json.episodeCount, json.ongoing, json.host] = decodeURIComponent(objString).split((encodedDelimiter));

    if(objString.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

    try {
        let episodes = [];
        
        for(let i = 1; i < parseInt(json.episodeCount)+1; i++) {
            episodes.push({
                href: `${ json.host }/watch?id=${ json.id }&ep=${ i }|${ json.id }|${ json.malId }|${ i }|${ json.ongoing }|${ json.host }`,
                number: i
            });
        }

        return JSON.stringify(episodes);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}


async function extractStreamUrl(objString) {
    let json = {};
    [json.url, json.id, json.malId, episodeNr, json.ongoing, json.host] = objString.split('|');

    let episodesApiUrl = `${ json.host }/api/episodes?malId=${ json.malId }`;
    if(json.ongoing == 1) {
        episodesApiUrl += '&ongoing=true';
    }

    try {
        const response = await soraFetch(episodesApiUrl);
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data.error) throw new Error('No episode data found');

        let promises = [];

        for(const key in data) {
            // AnimeZ.org website is down
            // if(key === 'ANIMEZ') {
            //     promises.push(extractAnimez(data, json, episodeNr, 'sub'));
            //     promises.push(extractAnimez(data, json, episodeNr, 'dub'));
            //     continue;
            // }
            if(key === 'ANIMEPAHE') {
                promises.push(extractPahe(data, json, episodeNr, 'sub'));
                promises.push(extractPahe(data, json, episodeNr, 'dub'));
                continue;
            }
            if(key === 'ANIMEKAI') {
                promises.push(extractKai(data, json, episodeNr, 'sub'));
                promises.push(extractKai(data, json, episodeNr, 'dub'));
                continue;
            }
            
            if(key === 'ZORO') {
                // START - // TODO REMOVE WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT
                // promises.push(extractZoro(data, json, episodeNr, 'sub'));
                // END - // TODO REMOVE WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT
                promises.push(extractZoro(data, json, episodeNr, 'dub'));
                continue;
            }
        }

        const promiseResults = await Promise.allSettled(promises);
        const filteredResults = promiseResults.filter(result => result.status === 'fulfilled' && result.value !== null);
        const streams = filteredResults.map(result => {
            if(result.value instanceof Array) {
                return result.value[0];
            }
            return result.value;
        });

        if(streams.length === 0) {
            console.log('No streams found for episode ' + episodeNr);
            return null;
        }

        let multiStreams = {
            streams: []
        };

        let jpSubsAdded = false;
        
        for(let stream of streams) {
            let headers = {};
            if(stream.referer != null) {
                headers.referer = stream.referer;
            }
            if(stream.origin != null) {
                headers.origin = stream.origin;
            }

           headers.provider = stream.provider;

            if(stream.subtitles == null || stream.subtitles?.length === 0) {
                let title = `[English Hardsub] ${ stream.provider }`;

                if(stream.type === 'dub') {
                    title = `[English Dub] ${ stream.provider }`;
                }

                multiStreams.streams.push({
                    title: title,
                    streamUrl: stream.url,
                    headers: headers,
                    subtitles: null
                });
                continue;
            }

            // START - // TODO REMOVE WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT
            continue; // Skips subtitles
            // END - // TODO REMOVE WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT

            for(let subtitle of stream.subtitles) {
                let label = subtitle.label;
                if(subtitle.label.includes(' - ')) {
                    label = subtitle.label.split(' - ')[1];
                }

                let title = `[${ label } Softsub] ${ stream.provider }`;

                if(stream.type === 'dub') {
                    title = `[${ label } Sub & Dub] ${ stream.provider }`;
                }

                multiStreams.streams.push({
                    title: title,
                    streamUrl: stream.url,
                    headers: headers,
                    subtitles: subtitle.file
                });

                if(!jpSubsAdded && subtitle.label.toLowerCase() === 'english') {
                    jpSubsAdded = true;

                    let doesSubtitleExist = await soraFetch(`https://asura.ofchaos.com/api/anime/${ json.id }/${ episodeNr }`, { method: 'HEAD', headers: { referer: 'SoraApp' }})

                    if(doesSubtitleExist.status === 200) {
                        multiStreams.streams.push({
                            title: `[Japanese Softsub][Asura] ${ stream.provider }`,
                            streamUrl: stream.url,
                            headers: headers,
                            subtitles: `https://asura.ofchaos.com/api/anime/${ json.id }/${ episodeNr }`
                        });
                    }
                }
            }
        }

        // Verify if streamsUrls are valid / have not been removed
        let validStreams = [];
        for(let stream of multiStreams.streams) {
            const response = await soraFetch(stream.streamUrl, { method: 'HEAD', headers: stream.headers });
            if(response?.status === 200) {
                validStreams.push(stream);
            }
        }
        multiStreams.streams = validStreams;

        return JSON.stringify(multiStreams);

    } catch(e) {
        console.log('Error extracting stream: ' + e.message);
        return null;
    }
}


// async function extractAnimez(data, json, episodeNr, category = 'sub') {
//     const ongoingString = json.ongoing == 1 ? '&ongoing=true' : '&ongoing=false';
//     const animezData = Object.values(data.ANIMEZ)[0];
//     const episodeData = animezData.episodeList.episodes[category].find(ep => ep.number == episodeNr);

//     if(!episodeData) {
//         console.log(`Episode ${ episodeNr } not found in category ${ category } with provider Animez`);
//         return null;
//     }

//     const url = `${ json.host }/api/sources?episodeId=${ episodeData.id }&provider=animez&fetchType=&category=${ category }${ ongoingString }`;

//     try {
//         const response = await soraFetch(url);

//         if(getResponseHeader(response, 'Content-Type') !== 'application/json; charset=utf-8') {
//             throw new Error(`Animez source temporarily unavailable for episode ${ episodeNr }`);
//         }

//         const data = typeof response === 'object' ? await response.json() : JSON.parse(response);

//         if(!data || data.error) {
//             throw new Error(`No sources found for episode ${ episodeNr } for provider Animez`);
//         }

//         let sources = [];
//         for(const source of data.streams) {
//             let tracks = data.tracks || null;

//             if(tracks != null) {
//                 tracks = tracks.filter(track => track.kind === 'captions');
//             }

//             sources.push({ provider: 'animez', url: source.url, subtitles: tracks, type: category, referer: source.url });
//         }

//         return sources;

//     } catch (error) {
//         console.log('Error fetching Animez source: ' + error.message);
//         return null;
//     }
// }


async function extractPahe(data, json, episodeNr, category = 'sub') {
    const ongoingString = json.ongoing == 1 ? '&ongoing=true' : '&ongoing=false';
    const paheData = Object.values(data.ANIMEPAHE)[0];
    let paheEpisodes = paheData.episodeList.sort((a, b) => a.number - b.number);
    
    // Season 1 currentEpisodes is never higher than totalEpisodes
    if(paheData.currentEpisode > paheData.totalEpisodes) {
        for(let nr=1; nr<=paheEpisodes.length; nr++) {
            let i = nr-1;
            paheEpisodes[i].number = nr;
        }
    }

    const episodeData = paheEpisodes.find(ep => ep.number == parseInt(episodeNr));
    const episodeId = `${ paheData.id }/ep-${ episodeNr }`;

    if(category == 'dub' && episodeData.audio != 'eng') {
        console.log(`Episode ${ episodeNr } is not available in dub for provider AnimePahe`);
        return null;
    }

    if(!episodeData) {
        console.log(`Episode ${ episodeNr } not found in category ${ category } with provider AnimePahe`);
        return null;
    }

    const url = `${ json.host }/api/sources?episodeId=${ episodeId }&provider=animepahe&fetchType=&category=${ category }${ ongoingString }`;

    try {
        const response = await soraFetch(url);

        if(getResponseHeader(response, 'Content-Type') !== 'application/json; charset=utf-8') {
            throw new Error(`AnimePahe source temporarily unavailable for episode ${ episodeNr }`);
        }

        const data = typeof response === 'object' ? await response.json() : JSON.parse(response);

        if(!data || data.error) {
            throw new Error(`No sources found for episode ${ episodeNr } for provider AnimePahe`);
        }

        let sources = [];
        for(const source of data.streams) {
            let tracks = data.tracks || null;

            if(tracks != null) {
                tracks = tracks.filter(track => track.kind === 'captions');
            }

            sources.push({ provider: 'animepahe', url: source.url, subtitles: tracks, type: category });
        }

        return sources;

    } catch (error) {
        console.log('Error fetching AnimePahe source: ' + error.message);
        return null;
    }
    
}

async function extractKai(data, json, episodeNr, category = 'sub') {
    const ongoingString = json.ongoing == 1 ? '&ongoing=true' : '&ongoing=false';
    const kaiData = Object.values(data.ANIMEKAI)[0];
    const kaiEpisodesList = kaiData?.episodeList;

    if(kaiEpisodesList?.episodes == null) {
        console.log(`No episodes found in category ${ category } with provider AnimeKai`);
        return null;
    }

    const episodeData = kaiData.episodeList.episodes.find(ep => ep.number == episodeNr);

    if(!episodeData) {
        console.log(`Episode ${ episodeNr } not found in category ${ category } with provider AnimeKai`);
        return null;
    }

    let url = `${ json.host }/api/sources?episodeId=${ episodeData.id }&provider=animekai&fetchType=m3u8&category=${ category }${ ongoingString }`;

    try {
        let response = await soraFetch(url);

        if(response.status === 500) {
            let correctedOngoingString = json.ongoing == 0 ? '&ongoing=true' : '&ongoing=false';
            url = url.replace(ongoingString, correctedOngoingString);
            response = await soraFetch(url);
        }

        if(getResponseHeader(response, 'Content-Type') !== 'application/json; charset=utf-8') {
            throw new Error(`AnimeKai source temporarily unavailable for episode ${ episodeNr }`);
        }

        const data = typeof response === 'object' ? await response.json() : JSON.parse(response);

        if(!data || data.error) {
            throw new Error(`No sources found for episode ${ episodeNr } for provider AnimeKai`);
        }

        let sources = [];
        for(const source of data.streams) {
            // START - // TODO REMOVE COMMENT WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT
            let tracks = null;
            // let tracks = data.tracks || null;
            // END - // TODO REMOVE COMMENT WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT

            if(tracks != null) {
                tracks = tracks.filter(track => track.kind === 'captions');
            }

            sources.push({ provider: 'animekai', url: source.url, subtitles: tracks, type: category });
        }

        return sources;

    } catch (error) {
        console.log('Error fetching AnimeKai source: ' + error.message);
        return null;
    }
}

async function extractZoro(data, json, episodeNr, category = 'sub') {
    const ongoingString = json.ongoing == 1 ? '&ongoing=true' : '&ongoing=false';
    const zoroData = Object.values(data.ZORO)[0];
    const episodeData = zoroData.episodeList.episodes.find(ep => ep.number == episodeNr);

    if(!episodeData) {
        console.log(`Episode ${ episodeNr } not found in category ${ category } with provider Zoro`);
        return null;
    }

    const url = `${ json.host }/api/sources?episodeId=${ episodeData.id }&provider=zoro&fetchType=&category=${ category }${ ongoingString }`;

    try {
        const response = await soraFetch(url);

        if(getResponseHeader(response, 'Content-Type') !== 'application/json; charset=utf-8') {
            throw new Error(`Zoro source temporarily unavailable for episode ${ episodeNr }`);
        }

        const data = typeof response === 'object' ? await response.json() : JSON.parse(response);

        if(!data || data.error) {
            throw new Error(`No sources found for episode ${ episodeNr } for provider Zoro`);
        }

        let sources = [];
        for(const source of data.streams) {
            // START - // TODO REMOVE COMMENT WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT
            let tracks = null;
            // let tracks = data.tracks || null;
            // END - // TODO REMOVE COMMENT WHEN SORA ADDS EITHER MULTIPLE SOFTSUB SUPPORT WITH DEFAULTS OR ADDS SUBTITLE PER STREAM SUPPORT

            if(tracks != null) {
                tracks = tracks.filter(track => track.kind === 'captions');
            }

            const referer = 'https://megacloud.club/';

            sources.push({ provider: 'zoro', url: source.url, subtitles: tracks, type: category, referer: referer });
        }

        return sources;

    } catch (error) {
        console.log('Error fetching Zoro source: ' + error.message);
        return null;
    }
}

function getDateStringFromSearchResult(item) {
    let startYear = item.startDate?.year;
    let startMonth = item.startDate?.month;
    let startDay = item.startDate?.day;
    let endYear = item.endDate?.year;
    let endMonth = item.endDate?.month;
    let endDay = item.endDate?.day;

    let startYearString = null;
    let endYearString = null;

    if(startYear != null) {
        if(startMonth != null && startDay != null) {
            startYearString = `${ startYear }-${ startMonth.toString().padStart(2, '0') }-${ startDay.toString().padStart(2, '0') }`;
        }
        startYearString = `${ startYear }`;
    }

    if(endYear != null) {
        if(endMonth != null && endDay != null) {
            endYearString = `${ item.endDate.year }-${ endMonth.toString().padStart(2, '0') }-${ endDay.toString().padStart(2, '0') }`;
        }
        endYearString = `${ endYear }`;
    }

    if(startYearString != null && endYearString != null) {
        return `${ startYearString } to ${ endYearString }`;
    }
    if(startYearString != null) {
        return startYearString;
    }
    if(endYearString != null) {
        return endYearString;
    }
    
    return 'Unknown airdate';
}


function getResponseHeader(res, key) {
    try {
        return res.headers.get(key);
    } catch(e) {
        return res.headers[key];
    }
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