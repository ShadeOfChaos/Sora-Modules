const BASE_URLS = ['https://miruro.tv', 'https://miruro.to', 'https://miruro.online'];
const SEARCH_URL = '---/api/search/browse?search=|||&page=1&perPage=5&type=ANIME&sort=SEARCH_MATCH';
// const FORMAT = 'SUB'; // SUB | DUB


// ***** LOCAL TESTING
(async() => {
    const results = await searchResults('Solo Leveling');
    console.log('SEARCH RESULTS: ', results);
    const details = await extractDetails(JSON.parse(results)[0].href);
    console.log('DETAILS: ', details);
    const episodes = await extractEpisodes(JSON.parse(results)[0].href);
    console.log('EPISODES: ', episodes);
    const streamUrl = await extractStreamUrl(JSON.parse(episodes)[0].href);
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
                if(response.status === 'fulfilled' && response.value?.status === 200) {
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
            if(item.nextAiringEpisode != null) {
                ongoing = 1;
            }

            return {
                title: item.title.romaji,
                image: item.bannerImage,
                href: `${ hostUrl }/watch?id=${ item.id }|${ item.id }|${ item.idMal }|${ item.description }|${ item.title.english }, ${ item.title.native }|${ item.startDate.year }-${ item.startDate.month.toString().padStart(2, '0') }-${ item.startDate.day.toString().padStart(2, '0') } to ${ item.endDate.year }-${ item.endDate.month.toString().padStart(2, '0') }-${ item.endDate.day.toString().padStart(2, '0') }|${ item.episodes }|${ ongoing }|${ hostUrl }`
            };
        });

        return JSON.stringify(results);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}


async function extractDetails(objString) {
    // const encodedDelimiter = encodeURIComponent('|');
    const encodedDelimiter = '|'; // For local testing
    let json = {};
    [json.url, json.id, json.malId, json.description, json.aliases, json.airdate, json.episodeCount, json.ongoing, json.host] = decodeURIComponent(objString).split(encodedDelimiter);

    console.log('/////////////////////////////////');
    console.log(JSON.stringify(json));
    console.log('/////////////////////////////////');

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
    // const encodedDelimiter = encodeURIComponent('|');
    const encodedDelimiter = '|'; // For local testing
    let json = {};
    [json.url, json.id, json.malId, json.description, json.aliases, json.airdate, json.episodeCount, json.ongoing, json.host] = decodeURIComponent(objString).split((encodedDelimiter));

    console.log('=================================');
    console.log(JSON.stringify(json));
    console.log('=================================');

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
            if(key === 'ANIMEZ') {
                promises.push(extractAnimez(data, json, episodeNr, 'sub'));
                promises.push(extractAnimez(data, json, episodeNr, 'dub'));
                continue;
            }
            if(key === 'ZORO') {
                promises.push(extractZoro(data, json, episodeNr, 'sub'));
                promises.push(extractZoro(data, json, episodeNr, 'dub'));
                continue;
            }
            if(key === 'ANIMEPAHE') {
                promises.push(extractPahe(data, json, episodeNr, 'sub'));
                promises.push(extractPahe(data, json, episodeNr, 'dub'));
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
            if(stream.subtitles == null) {
                console.log('STREAM:', stream);

                let title = `[English Hardsub] ${ stream.provider }`;

                if(stream.type === 'dub') {
                    title = `[English Dub] ${ stream.provider }`;
                }

                multiStreams.streams.push({
                    title: title,
                    streamUrl: stream.url,
                    headers: { referer: json.host},
                    subtitles: null
                });
                continue;
            }

            for(let subtitle of stream.subtitles) {
                let label = subtitle.label;
                if(subtitle.label.includes(' - ')) {
                    label = subtitle.label.split(' - ')[1];
                }

                let title = `[${ label } Softsub] ${ stream.provider }`;

                multiStreams.streams.push({
                    title: title,
                    streamUrl: stream.url,
                    headers: { referer: json.host},
                    subtitles: {
                        [`${ label } Softsub`]: subtitle.file
                    }
                });

                if(!jpSubsAdded && subtitle.label.toLowerCase() === 'english') {
                    jpSubsAdded = true;

                    let doesSubtitleExist = await soraFetch(`https://asura.ofchaos.com/api/anime/${ json.id }/${ episodeNr }`, { method: 'HEAD', headers: { referer: 'SoraApp' }})

                    if(doesSubtitleExist.status === 200) {
                        multiStreams.streams.push({
                            title: `[Japanese Softsub][Asura] ${ stream.provider }`,
                            streamUrl: stream.url,
                            headers: { referer: json.host},
                            subtitles: {
                                'Japanese Softsub': `https://asura.ofchaos.com/api/anime/${ json.id }/${ episodeNr }`
                            }
                        });
                    }
                }
            }
        }

        return JSON.stringify(multiStreams);

    } catch(e) {
        console.log('Error extracting stream: ' + e.message);
        return null;
    }
}


async function extractAnimez(data, json, episodeNr, category = 'sub') {
    const ongoingString = json.ongoing == 1 ? '&ongoing=true' : '&ongoing=false';
    const animezData = Object.values(data.ANIMEZ)[0];
    const episodeData = animezData.episodeList.episodes[category].find(ep => ep.number == episodeNr);

    if(!episodeData) {
        console.log(`Episode ${ episodeNr } not found in category ${ category } with provider Animez`);
        return null;
    }

    const url = `${ json.host }/api/sources?episodeId=${ episodeData.id }&provider=animez&fetchType=&category=${ category }${ ongoingString }`;

    try {
        const response = await soraFetch(url);
        const data = typeof response === 'object' ? await response.json() : JSON.parse(response);

        if(!data || data.error) {
            throw new Error(`No sources found for episode ${ episodeNr } for provider Animez`);
        }

        let sources = [];
        for(const source of data.streams) {
            let tracks = data.tracks || null;

            if(tracks != null) {
                tracks = tracks.filter(track => track.kind === 'captions');
            }

            sources.push({ provider: 'animez', url: source.url, subtitles: tracks, type: category });
        }

        return sources;

    } catch (error) {
        console.log('Error fetching Animez source: ' + error.message);
        return null;
    }
}


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
        const data = typeof response === 'object' ? await response.json() : JSON.parse(response);

        if(!data || data.error) {
            throw new Error(`No sources found for episode ${ episodeNr } for provider Zoro`);
        }

        let sources = [];
        for(const source of data.streams) {
            let tracks = data.tracks || null;

            if(tracks != null) {
                tracks = tracks.filter(track => track.kind === 'captions');
            }

            sources.push({ provider: 'zoro', url: source.url, subtitles: tracks, type: category });
        }

        return sources;

    } catch (error) {
        console.log('Error fetching Zoro source: ' + error.message);
        return null;
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