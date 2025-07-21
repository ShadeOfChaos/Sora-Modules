async function areRequiredServersUp() {
    const requiredHosts = ['https://anicrush.to', 'https://ac-api.ofchaos.com'];

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
    const UTILITY_URL = 'https://ac-api.ofchaos.com';
    const serversUp = await areRequiredServersUp();

    if(serversUp.success === false) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
            href: '#' + serversUp.error,
        }]);
    }

    try {
        const page = 1;
        const limit = 24;
        const response = await soraFetch(`${ UTILITY_URL }/api/anime/search?keyword=${encodeURIComponent(keyword)}&page=${ page }&limit=${ limit }`);
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data?.status == false || data?.result?.movies?.length <= 0) {
            throw new Error('No results found');
        }

        const results = data.result.movies.map(movie => {
            const href = `${ BASE_URL }/watch/${ movie.slug }.${ movie.id }`;

            return { title: movie?.name_english || movie.name, image: getImage(movie.poster_path), href: href }
        });

        return JSON.stringify(results);
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
    const UTILITY_URL = "https://ac-api.ofchaos.com";

    if(url.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }

    const movieId = url.split('.').pop();

    try {
        const response = await soraFetch(`${ UTILITY_URL }/api/anime/info/${ movieId }`);
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data?.status == false || data?.result == null) {
            throw new Error('No results found');
        }

        const details = {
            description: data.result?.overview,
            aliases: buildAliasString(data.result),
            airdate: data.result?.aired_from + ' - ' + data.result?.aired_to
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

    // Encapsulating this away
    function buildAliasString(resultObj) {
        let string = '';

        if (resultObj?.name) {
            string += resultObj.name;
        }

        if (resultObj?.name_english) {
            
            if (string != '') string += ', ';
            string += resultObj.name_english;
        }

        if (resultObj?.name_japanese) {
            if (string != '') string += ', ';
            string += resultObj.name_japanese;
        }

        if (resultObj?.name_synonyms) {
            if (string != '') string += ', ';
            string += resultObj.name_synonyms;
        }

        return string;
    }
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    const SOURCE_API_URL = "https://api.anicrush.to";
    const UTILITY_URL = "https://ac-api.ofchaos.com";

    try {
        if(url.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

        const movieId = url.split('.').pop();
    
        const serverId = 4;
        const format = 'dub';
        var episodes = [];

        const response = await soraFetch(`${ UTILITY_URL }/api/anime/episodes?movieId=${ movieId }`);
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        if(data?.status == false || data?.result == null) {
            throw new Error('No results found');
        }

        for(let episodeList in data.result) {
            for(let episode of data.result[episodeList]) {
                episodes.push({
                    href: `${ SOURCE_API_URL }/shared/v2/episode/sources?_movieId=${ movieId }&ep=${ episode.number }&sv=${ serverId }&sc=${ format }`,
                    number: episode.number
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
    const SOURCE_BASE_URL = "https://anicrush.to";
    const UTILITY_URL = "https://ac-api.ofchaos.com";

    try {
        if(url.indexOf('?') <= 0) {
            throw new Error('Invalid url provided');
        }

        const paramString = url.split('?')[1];
        const params = paramString.split('&');
        let id = '';
        let episode = 1;
        let server = 4;
        let format = 'dub';

        for(let paramStr of params) {
            let param = paramStr.split('=');
            switch(param[0]) {
                case '_movieId':
                    id = param[1];
                    break;
                case 'ep':
                    episode = param[1];
                    break;
                case 'sv':
                    server = param[1];
                    break;
                case 'sc':
                    format = param[1];
                    break;
            }
        }

        if(id == '') {
            throw new Error('Invalid _movieId provided');
        }

        const serversResponse = await soraFetch(`${ UTILITY_URL }/api/anime/servers/${ id }?episode=${ episode }`);
        const serversData = typeof serversResponse === 'object' ? await serversResponse.json() : await JSON.parse(serversResponse);

        if(serversData.status == false || serversData.result == null) {
            throw new Error('No servers found');
        }

        if (
            serversData?.status !== true  ||
            serversData?.result == null ||
            serversData.result[format] == null ||
            serversData.result[format].length <= 0
        ) {
            throw new Error('No server found');
        }

        const serverObjects = serversData.result[format];
        let serverObject = serverObjects.find(s => s.server == server);

        if(serverObject != null) {
            server = serverObject.server;
        } else {
            serverObject = serverObjects[0].server;
        }

        const sourceResponse = await soraFetch(`${ UTILITY_URL }/api/anime/sources?movieId=${ id }&episode=${ episode }&server=${ server }&format=${ format }`);
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

        // Older version which might or might not work, new method incorporates getting the embed from the source
        // const hlsUrl = `${ UTILITY_URL }/api/anime/hls/${ id }?episode=${ episode }&server=${ server }&format=${ format }`;
        // const hlsResponse = await soraFetch(hlsUrl);
        // const hlsData = await JSON.parse(hlsResponse);

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

        if(hlsData.result?.tracks?.length <= 0) {
            return JSON.stringify({ stream: streamSource?.file, subtitles: null });
        }

        let reserveSubtitles = null;
        let subtitles = null;

        for(let track of hlsData.result.tracks) {
            if(track.kind === 'captions') {
                if(!track?.label.startsWith('English')) {
                    continue;
                }
                if(track?.default === true) {
                    subtitles = track;
                    break;
                }
                reserveSubtitles = track;
            }
        }

        if(subtitles == null) {
            if(reserveSubtitles != null) {
                subtitles = reserveSubtitles;
            }
        }

        const streamUrl = {
            stream: streamSource?.file,
            subtitles: subtitles?.file
        };

        return JSON.stringify(streamUrl);

    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify({ stream: null, subtitles: null });
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